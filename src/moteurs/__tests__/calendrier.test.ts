// Moteur calendaire (M1), montée en production (M2) et horizon libre (M17) : cas vérifiés à la main.
import { calculerFinances, type EntreeFinance } from "../finance";

const vente = (extra: object = {}) => ({
  id: "v",
  libelle: "Vente",
  typeRevenu: "principal",
  quantite: { pessimiste: 100, realiste: 100, optimiste: 100 },
  prixUnitaire: 1_200,
  base: "an" as const,
  ...extra,
});
const invest = (extra: object = {}) => ({ id: "i", libelle: "Matériel", typeCharge: "infrastructures", quantite: 1, prixUnitaire: 1_200_000, nature: "fixe" as const, classe: "investissement" as const, dureeVieAns: 4, ...extra });
const realiste = (e: EntreeFinance) => calculerFinances(e).scenarios.realiste;

describe("M1 : grille mensuelle, investissements et prêts datés", () => {
  it("un achat au mois 7 est amorti au prorata : 5 mois la première année, 12 ensuite, sans renouvellement avant 48 mois", () => {
    const s = realiste({ charges: [invest({ moisAcquisition: 7 })], revenus: [], horizonAnnees: 2 });
    expect(s.annees.map((a) => a.amortissements)).toEqual([125_000, 300_000]);
    expect(s.investissementsDates).toEqual([{ ligneId: "i", libelle: "Matériel", mois: 7, an: 1, montant: 1_200_000, renouvellement: false }]);
    expect(s.tresorerieMensuelle[7].sorties).toBe(1_200_000);
    expect(s.tresorerieMensuelle[0].sorties).toBe(0);
  });

  it("un bien de 2 ans acheté au démarrage est renouvelé au mois 24 quand l'horizon est de 60 mois, sauf renouvellement refusé", () => {
    const avec = realiste({ charges: [invest({ dureeVieAns: 2 })], revenus: [], horizonMois: 60 });
    expect(avec.investissementsDates.map((i) => i.mois)).toEqual([0, 24, 48]);
    expect(avec.annees.map((a) => a.amortissements)).toEqual([600_000, 600_000, 600_000, 600_000, 600_000]);
    const sans = realiste({ charges: [invest({ dureeVieAns: 2, renouvellement: false })], revenus: [], horizonMois: 60 });
    expect(sans.investissementsDates).toHaveLength(1);
    expect(sans.annees.map((a) => a.amortissements)).toEqual([600_000, 600_000, 0, 0, 0]);
  });

  it("un achat après la fin de l'horizon n'est pas compté et le moteur le dit", () => {
    const s = realiste({ charges: [invest({ moisAcquisition: 30 })], revenus: [], horizonAnnees: 2 });
    expect(s.investissementsDates).toEqual([]);
    expect(s.avertissements[0]).toContain("mois 30");
  });

  it("un crédit tiré au mois 6 : tirage au mois 6, échéances de 7 à 18", () => {
    const s = realiste({ charges: [], revenus: [], horizonAnnees: 2, credit: { montant: 1_200_000, tauxAnnuel: 0, dureeMois: 12 }, moisTirageCredit: 6 });
    expect(s.tresorerieMensuelle[6].entrees).toBe(1_200_000);
    expect(s.tresorerieMensuelle[7].sorties).toBe(100_000);
    expect(s.tresorerieMensuelle[18].sorties).toBe(100_000);
    expect(s.tresorerieMensuelle[19].sorties).toBe(0);
    expect(s.annees.map((a) => a.remboursementCapital)).toEqual([600_000, 600_000]);
  });

  it("point bas avec et sans financement, daté", () => {
    const s = realiste({ charges: [invest({ dureeVieAns: 10 })], revenus: [], horizonAnnees: 2, apport: 1_200_000 });
    expect(s.pointBasTresorerie).toEqual({ montant: 0, mois: 0, an: 1, moisDansAn: 0 });
    expect(s.pointBasSansFinancement).toEqual({ montant: -1_200_000, mois: 0, an: 1, moisDansAn: 0 });
    const tard = realiste({ charges: [{ ...invest({ dureeVieAns: 10 }), moisAcquisition: 14 }], revenus: [], horizonAnnees: 2, apport: 500_000 });
    expect(tard.pointBasTresorerie).toMatchObject({ montant: -700_000, mois: 14, an: 2, moisDansAn: 2 });
  });

  it("répéter une année type sur 3 ans donne les mêmes années, et la trésorerie mensuelle couvre 36 mois", () => {
    const s = realiste({
      charges: [{ id: "c", libelle: "Charge", typeCharge: "intrants", quantite: 1, prixUnitaire: 240_000, base: "an", nature: "variable", classe: "exploitation" }],
      revenus: [vente({ moisVente: [6] })],
      horizonAnnees: 3,
    });
    expect(s.annees.map((a) => a.chiffreAffaires)).toEqual([120_000, 120_000, 120_000]);
    expect(s.tresorerieMensuelle).toHaveLength(37);
    expect(s.tresorerieMensuelleAn1).toEqual(s.tresorerieMensuelle.slice(0, 13));
    expect(s.tresorerieMensuelle[18].entrees).toBe(120_000);
    expect(s.grille.lignes.find((l) => l.id === "v")?.mensuel[30]).toBe(120_000);
  });

  it("le profil de cycle (R1) place les ventes sur les mois du cycle, cycle après cycle", () => {
    const s = realiste({ charges: [], revenus: [vente({ base: "cycle", calendrier: { debutMois: 4, parts: [0.5, 0.5] }, quantite: { pessimiste: 100, realiste: 100, optimiste: 100 } })], horizonAnnees: 2 });
    const ligne = s.grille.lignes.find((l) => l.id === "v")!.mensuel;
    const mois = ligne.map((v, m) => [m, v]).filter(([, v]) => v !== 0);
    expect(mois).toEqual([[4, 60_000], [5, 60_000], [16, 60_000], [17, 60_000]]);
  });

  it("le profil de cycle de 18 mois reste coupé à l'horizon", () => {
    const parts = Array.from({ length: 18 }, (_, i) => (i === 17 ? 1 : 0));
    const s = realiste({ charges: [], revenus: [vente({ base: "cycle", calendrier: { parts } })], horizonAnnees: 1 });
    expect(s.annees[0].chiffreAffaires).toBe(0);
  });
});

describe("M2 : montée en production et hausses par ligne", () => {
  const atelier = { atelierId: "a" };

  it("coefficients de rendement par année : 0, 50 %, plein régime, et la dernière valeur se prolonge", () => {
    const s = realiste({ charges: [], revenus: [vente(atelier)], montee: [{ atelierId: "a", coefficientsRendement: [0, 0.5, 1] }], horizonAnnees: 4 });
    expect(s.annees.map((a) => a.chiffreAffaires)).toEqual([0, 60_000, 120_000, 120_000]);
    expect(s.seuilCommercialisation.an).toBe(2);
  });

  it("le taux d'utilisation pèse sur les ventes et sur les charges variables, pas sur les fixes", () => {
    const charges = [
      { id: "cv", libelle: "Aliment", typeCharge: "intrants", quantite: 1, prixUnitaire: 40_000, base: "an" as const, nature: "variable" as const, classe: "exploitation" as const, atelierId: "a" },
      { id: "cf", libelle: "Gardien", typeCharge: "main_oeuvre", quantite: 1, prixUnitaire: 10_000, base: "an" as const, nature: "fixe" as const, classe: "exploitation" as const, atelierId: "a" },
    ];
    const s = realiste({ charges, revenus: [vente(atelier)], montee: [{ atelierId: "a", tauxUtilisation: [0.5, 1] }], horizonAnnees: 2 });
    expect(s.annees.map((a) => [a.chiffreAffaires, a.chargesVariables, a.chargesFixes])).toEqual([[60_000, 20_000, 10_000], [120_000, 40_000, 10_000]]);
  });

  it("rendement de l'an 1 réduit pour un débutant : seulement l'an 1", () => {
    const s = realiste({ charges: [], revenus: [vente(atelier)], montee: [{ atelierId: "a", debutant: { coefficientAn1: 0.8 } }], horizonAnnees: 2 });
    expect(s.annees.map((a) => a.chiffreAffaires)).toEqual([96_000, 120_000]);
  });

  it("une culture pérenne qui produit à partir de l'an 3 ne vend rien avant, mais ses charges courent", () => {
    const charge = { id: "c", libelle: "Entretien", typeCharge: "intrants", quantite: 1, prixUnitaire: 30_000, base: "an" as const, nature: "fixe" as const, classe: "exploitation" as const };
    const s = realiste({ charges: [charge], revenus: [vente({ perenne: { anneeEntreeProduction: 3 } })], horizonAnnees: 4 });
    expect(s.annees.map((a) => a.chiffreAffaires)).toEqual([0, 0, 120_000, 120_000]);
    expect(s.annees.map((a) => a.chargesFixes)).toEqual([30_000, 30_000, 30_000, 30_000]);
    expect(s.pointBasTresorerie.montant).toBe(-60_000);
  });

  it("hausse par année et par ligne : la ligne garde sa hausse, les autres suivent l'entrée", () => {
    const charges = [
      { id: "a", libelle: "Aliment", typeCharge: "intrants", quantite: 1, prixUnitaire: 100_000, base: "an" as const, nature: "variable" as const, classe: "exploitation" as const, hausseAnnuelle: 0.2 },
      { id: "b", libelle: "Eau", typeCharge: "energie", quantite: 1, prixUnitaire: 100_000, base: "an" as const, nature: "variable" as const, classe: "exploitation" as const },
    ];
    const s = realiste({ charges, revenus: [vente({ hausseParAn: [0.1] })], hausseCharges: 0.05, horizonAnnees: 3 });
    expect(s.annees.map((a) => a.chargesVariables)).toEqual([200_000, 120_000 + 105_000, 144_000 + 110_250]);
    expect(s.annees.map((a) => a.chiffreAffaires)).toEqual([120_000, 132_000, 132_000]); // hausseParAn ne couvre que le passage an 1 -> an 2 ; ensuite la hausse des prix de l'entrée (0) s'applique
  });
});

describe("M17 : horizon libre", () => {
  const ligne = { id: "c", libelle: "Charge", typeCharge: "intrants", quantite: 1, prixUnitaire: 1_000, nature: "variable" as const, classe: "exploitation" as const };

  it("par défaut : le plus long entre un cycle, la durée du crédit et le plein régime, arrondi à l'année", () => {
    expect(calculerFinances({ charges: [ligne], revenus: [] }).horizon).toMatchObject({ mois: 12, origine: "defaut", indicateursAnnuels: false });
    const credit = calculerFinances({ charges: [ligne], revenus: [], credit: { montant: 1_000_000, tauxAnnuel: 0.1, dureeMois: 40 } }).horizon;
    expect(credit).toMatchObject({ mois: 48, creditMois: 40, indicateursAnnuels: true });
    const plein = calculerFinances({ charges: [ligne], revenus: [], montee: [{ atelierId: "a", coefficientsRendement: [0, 0, 0.5, 1, 1] }] }).horizon;
    expect(plein).toMatchObject({ mois: 60, pleinRegimeMois: 60 });
    const cycle = calculerFinances({ charges: [], revenus: [vente({ base: "cycle", calendrier: { parts: Array.from({ length: 18 }, (_, i) => (i === 17 ? 1 : 0)) } })] }).horizon;
    expect(cycle).toMatchObject({ mois: 24, cycleMois: 18 });
  });

  it("en mois, en cycles ou en années ; les mois l'emportent", () => {
    expect(calculerFinances({ charges: [ligne], revenus: [], horizonAnnees: 5 }).horizon).toMatchObject({ mois: 60, origine: "annees", anneesCompletes: 5 });
    expect(calculerFinances({ charges: [ligne], revenus: [], horizonCycles: 2 }).horizon).toMatchObject({ mois: 24, origine: "cycles" });
    expect(calculerFinances({ charges: [ligne], revenus: [], horizonMois: 30, horizonAnnees: 5 }).horizon).toMatchObject({ mois: 30, origine: "mois", annees: 3, anneesCompletes: 2 });
  });

  it("VAN, TRI et délai ne sortent que sur au moins deux années complètes ; la dernière année partielle compte dans le résultat", () => {
    const e = { charges: [invest({ dureeVieAns: 10 })], revenus: [vente()] };
    const court = realiste({ ...e, horizonMois: 18 });
    expect(court).toMatchObject({ van: null, tri: null, delaiRecuperationAns: null, indicateursAnnuels: false });
    expect(court.annees.map((a) => [a.mois, a.chiffreAffaires])).toEqual([[12, 120_000], [6, 60_000]]);
    const assez = realiste({ ...e, horizonMois: 24 });
    expect(assez.van).not.toBeNull();
    expect(assez.indicateursAnnuels).toBe(true);
  });

  it("refuse un horizon de plus de 120 mois", () => {
    expect(() => calculerFinances({ charges: [], revenus: [], horizonMois: 121 })).toThrow();
  });
});
