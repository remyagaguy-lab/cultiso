/** @jest-environment node */
// M3 : revenu du ménage, capacité de remboursement, CAF disponible, seuil de commercialisation, trésorerie avec prélèvements.
// Tous les chiffres attendus sont calculés à la main à partir du cas « 2 ha de tomate » (test-utils/tomate.ts) :
// excédent brut 1 830 000 par an, charges décaissées 1 320 000, CA réaliste 3 150 000 pour 21 000 kg vendus.
import { calculerFinances, retraitsPossibles, statutCombine } from "../finance";
import { tomate2ha } from "../test-utils/tomate";

// Ménage : 900 000 de coût de vie, 300 000 de revenus extérieurs, donc 600 000 à prendre sur l'exploitation (50 000 par mois).
const menage = { prelevementsAnnuels: 900_000, revenusExterieursAnnuels: 300_000 };
// Apport qui couvre exactement la motopompe et le BFR (600 000 + 855 000).
const finance = { ...tomate2ha, apport: 1_455_000, menage };

describe("M3 : capacité de remboursement et revenu du ménage", () => {
  it("capacité, solde résiduel et CAF disponible sans crédit", () => {
    const a1 = calculerFinances(finance).scenarios.realiste.annees[0];
    expect(a1.prelevementsNets).toBe(600_000);
    expect(a1.margeAvantInteretsSalairesAmortissements).toBe(1_830_000);
    expect(a1.capaciteRemboursement).toBe(1_230_000);
    expect(a1.annuites).toBe(0);
    expect(a1.soldeResiduel).toBe(1_230_000);
    expect(a1.cafDisponible).toBe(1_230_000);
  });

  it("avec un crédit : les annuités (intérêts + capital) sont retirées de la capacité", () => {
    const r = calculerFinances({ ...finance, credit: { montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 12 } });
    const [a1, a2] = r.scenarios.realiste.annees;
    expect(a1.annuites).toBe(1_134_715);
    // La capacité part de la marge avant intérêts : le crédit ne la change pas.
    expect(a1.capaciteRemboursement).toBe(1_230_000);
    expect(a1.soldeResiduel).toBe(95_285);
    expect(a1.cafDisponible).toBe(1_830_000 - 1_134_715 - 600_000);
    expect(a2.soldeResiduel).toBe(1_230_000);
    expect(r.scenarios.realiste.verdict.menageCouvert).toBe(true);
  });

  it("ménage non couvert : le statut tombe à « limite »", () => {
    const r = calculerFinances({
      ...finance,
      menage: { prelevementsAnnuels: 1_500_000, revenusExterieursAnnuels: 300_000 },
      credit: { montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 12 },
    });
    const s = r.scenarios.realiste;
    expect(s.annees[0].capaciteRemboursement).toBe(630_000);
    expect(s.annees[0].soldeResiduel).toBe(-504_715);
    expect(s.verdict.menageCouvert).toBe(false);
    expect(s.verdict.rentabilite).toBe("rentable");
    expect(s.statut).toBe("limite");
  });

  it("salaires des employés : en charges fixes, réintégrés puis retirés de la capacité", () => {
    const a1 = calculerFinances({ ...finance, salairesAnnuels: 240_000 }).scenarios.realiste.annees[0];
    expect(a1.salaires).toBe(240_000);
    expect(a1.chargesFixes).toBe(360_000);
    expect(a1.excedentBrut).toBe(1_590_000);
    expect(a1.margeAvantInteretsSalairesAmortissements).toBe(1_830_000);
    expect(a1.capaciteRemboursement).toBe(990_000);
  });

  it("impôts : retirés du résultat et de la capacité", () => {
    const a1 = calculerFinances({ ...finance, impotsAnnuels: 100_000 }).scenarios.realiste.annees[0];
    expect(a1.impots).toBe(100_000);
    expect(a1.resultat).toBe(1_530_000);
    expect(a1.capaciteRemboursement).toBe(1_130_000);
    expect(a1.soldeResiduel).toBe(1_130_000);
  });

  it("sans ménage renseigné : rien n'est prélevé et le ménage n'est pas évalué", () => {
    const s = calculerFinances({ ...tomate2ha, apport: 1_455_000 }).scenarios.realiste;
    expect(s.annees[0].prelevementsNets).toBe(0);
    expect(s.verdict.menageCouvert).toBeNull();
    expect(s.statut).toBe("rentable");
  });
});

describe("M3 : seuil de commercialisation (DOC-00106 p. 5)", () => {
  it("prix minimum qui couvre charges décaissées, annuités et prélèvements", () => {
    const s = calculerFinances(finance).scenarios.realiste.seuilCommercialisation;
    // 1 200 000 + 120 000 + 600 000 = 1 920 000 à couvrir avec 21 000 kg vendus : 91,43 FCFA/kg.
    expect(s.besoinAnnuel).toBe(1_920_000);
    expect(s.chiffreAffaires).toBe(3_150_000);
    expect(s.coefficientPrix).toBeCloseTo(1_920_000 / 3_150_000, 4);
    expect(s.parLigne).toEqual([{ ligneId: "tomate", libelle: "Tomate fraîche", quantiteVendue: 21_000, prixActuel: 150, prixSeuil: 91.43 }]);
    expect(s.an).toBe(1);
  });

  it("retient l'année la plus exigeante (annuités de l'an 1)", () => {
    const s = calculerFinances({ ...finance, credit: { montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 12 } }).scenarios.realiste.seuilCommercialisation;
    expect(s.an).toBe(1);
    expect(s.besoinAnnuel).toBe(1_920_000 + 1_134_715);
    expect(s.parLigne[0].prixSeuil).toBe(Math.round(((1_920_000 + 1_134_715) / 21_000) * 100) / 100);
  });

  it("sans vente, pas de coefficient", () => {
    const s = calculerFinances({ ...finance, revenus: [] }).scenarios.realiste.seuilCommercialisation;
    expect(s.coefficientPrix).toBeNull();
    expect(s.parLigne).toEqual([]);
  });
});

describe("M3 : trésorerie mensuelle de l'an 1 avec le ménage", () => {
  // Horizon d'un an : sur plusieurs années, les mois déficitaires et le retrait possible couvrent tout l'horizon (moteur 2.0.0).
  const s = calculerFinances({ ...finance, horizonAnnees: 1 }).scenarios.realiste;
  const t = s.tresorerieMensuelleAn1;

  it("prélèvements nets mois par mois et cumul", () => {
    expect(t[0]).toMatchObject({ entrees: 1_455_000, sorties: 600_000, prelevementsNets: 0, cumul: 855_000 });
    expect(t[1].prelevementsNets).toBe(50_000);
    // Fin mars : creux d'exploitation (−855 000) et 3 mois de prélèvements (−150 000).
    expect(t[3].cumul).toBe(-150_000);
    expect(t[12].cumul).toBe(855_000 + 1_830_000 - 600_000);
  });

  it("mois déficitaires, trésorerie négative et point bas", () => {
    expect(s.moisDeficitaires).toEqual([1, 2, 3, 6, 7, 8, 9, 10, 11, 12]);
    expect(s.moisTresorerieNegative).toEqual([3]);
    expect(s.pointBasTresorerie).toEqual({ montant: -150_000, mois: 3, an: 1, moisDansAn: 3 });
    expect(s.verdict.tresorerieToujoursPositive).toBe(false);
    expect(s.statut).toBe("limite");
  });

  it("retrait possible : ce qu'on peut sortir sans rendre la trésorerie négative ensuite", () => {
    expect(t[0].retraitPossible).toBe(0);
    expect(t[3].retraitPossible).toBe(0);
    expect(t[4].retraitPossible).toBe(t[4].cumul);
    expect(t[12].retraitPossible).toBe(2_085_000);
    expect(retraitsPossibles([100, 50, 80, -10, 40])).toEqual([0, 0, 0, 0, 40]);
    expect(retraitsPossibles([100, 50, 80])).toEqual([50, 50, 80]);
  });

  it("150 000 d'apport en plus : trésorerie jamais négative, plan « rentable »", () => {
    const ok = calculerFinances({ ...finance, apport: 1_605_000 }).scenarios.realiste;
    expect(ok.verdict).toEqual({ rentabilite: "rentable", tresorerieToujoursPositive: true, menageCouvert: true });
    expect(ok.statut).toBe("rentable");
  });

  it("prélèvements concentrés sur certains mois", () => {
    const c = calculerFinances({ ...finance, menage: { ...menage, moisPrelevements: [4, 5] } }).scenarios.realiste.tresorerieMensuelleAn1;
    // Revenus extérieurs : 25 000 par mois tous les mois ; prélèvements : 450 000 en avril et en mai.
    expect(c[1].prelevementsNets).toBe(-25_000);
    expect(c[4].prelevementsNets).toBe(425_000);
  });
});

describe("statut combiné", () => {
  it("la rentabilité prime, la trésorerie et le ménage dégradent", () => {
    expect(statutCombine({ rentabilite: "deficitaire", tresorerieToujoursPositive: true, menageCouvert: true })).toBe("deficitaire");
    expect(statutCombine({ rentabilite: "rentable", tresorerieToujoursPositive: true, menageCouvert: null })).toBe("rentable");
    expect(statutCombine({ rentabilite: "rentable", tresorerieToujoursPositive: true, menageCouvert: false })).toBe("limite");
    expect(statutCombine({ rentabilite: "rentable", tresorerieToujoursPositive: false, menageCouvert: true })).toBe("limite");
  });
});
