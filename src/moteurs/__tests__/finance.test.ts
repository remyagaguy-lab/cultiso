/** @jest-environment node */
import { ErreurMoteur } from "../commun";
import { calculerFinances, delaiRecuperation, tri, van } from "../finance";
import { tomate2ha } from "../test-utils/tomate";

// Cas de référence (2 ha de tomate) : voir test-utils/tomate.ts.

describe("moteur financier", () => {
  const r = calculerFinances(tomate2ha);
  const reel = r.scenarios.realiste;

  it("compte de résultat de l'an 1 (scénario réaliste)", () => {
    expect(reel.annees).toHaveLength(3);
    expect(reel.annees[0]).toEqual({
      an: 1,
      mois: 12,
      investissements: 600_000,
      chiffreAffaires: 3_150_000,
      chargesVariables: 1_200_000,
      chargesFixes: 120_000,
      margeBrute: 1_950_000,
      excedentBrut: 1_830_000,
      amortissements: 200_000,
      interets: 0,
      taxeInterets: 0,
      fraisFinanciers: 0,
      repriseSubventions: 0,
      travailFamilial: 0,
      resultatApresTravailFamilial: 1_630_000,
      impots: 0,
      resultat: 1_630_000,
      cafNette: 1_830_000,
      remboursementCapital: 0,
      fluxTresorerie: 1_830_000,
      // Sans ménage, salaires ni crédit : la capacité de remboursement est l'excédent brut.
      salaires: 0,
      margeAvantInteretsSalairesAmortissements: 1_830_000,
      annuites: 0,
      prelevementsNets: 0,
      capaciteRemboursement: 1_830_000,
      soldeResiduel: 1_830_000,
      cafDisponible: 1_830_000,
    });
    expect(r.investissementTotal).toBe(600_000);
  });

  it("VAN à 12 %, TRI et délai de récupération", () => {
    expect(reel.van).toBe(3_795_351);
    const flux = [-600_000, 1_830_000, 1_830_000, 1_830_000];
    const triExact = tri(flux) as number;
    expect(Math.abs(van(flux, triExact))).toBeLessThan(1);
    expect(reel.tri).toBeCloseTo(triExact, 4);
    expect(reel.delaiRecuperationAns).toBe(0.33);
  });

  it("seuil de rentabilité et mois où il est atteint", () => {
    expect(reel.seuilRentabilite.chiffreAffaires).toBe(516_923);
    expect(reel.seuilRentabilite.moisAtteint).toBe(4); // premières ventes en avril
  });

  it("trésorerie mensuelle, BFR et besoin de financement", () => {
    expect(reel.tresorerieMensuelleAn1).toHaveLength(13);
    expect(reel.tresorerieMensuelleAn1[0]).toEqual({ mois: 0, entrees: 0, sorties: 600_000, prelevementsNets: 0, solde: -600_000, cumul: -600_000, retraitPossible: 0 });
    // Creux de trésorerie d'exploitation fin mars : 300 000 + 400 000 + 3 × (41 667 + 10 000).
    expect(reel.besoinFondsRoulement).toBe(855_000);
    expect(r.besoinFinancement).toBe(1_455_000);
    expect(reel.tresorerieMensuelleAn1[12].cumul).toBe(1_830_000 - 600_000);
  });

  it("trois scénarios et leur statut", () => {
    expect(r.scenarios.pessimiste.annees[0].chiffreAffaires).toBe(2_100_000);
    expect(r.scenarios.optimiste.annees[0].chiffreAffaires).toBe(3_780_000);
    // Rentable, mais sans apport la motopompe met la trésorerie à −600 000 au démarrage : statut « limite » (M3).
    expect(r.scenarios.pessimiste.verdict).toEqual({ rentabilite: "rentable", tresorerieToujoursPositive: false, menageCouvert: null });
    expect(r.scenarios.pessimiste.statut).toBe("limite");
    expect(calculerFinances({ ...tomate2ha, apport: 1_455_000 }).scenarios.pessimiste.statut).toBe("rentable");
    expect(reel.rentabilite).toBeCloseTo(1_630_000 / 1_520_000, 4);
  });

  it("projet déficitaire : pas de TRI, pas de récupération", () => {
    const d = calculerFinances({ ...tomate2ha, revenus: [{ ...tomate2ha.revenus[0], prixUnitaire: 50 }] });
    expect(d.scenarios.realiste.annees[0].excedentBrut).toBe(-270_000);
    expect(d.scenarios.realiste.statut).toBe("deficitaire");
    expect(d.scenarios.realiste.tri).toBeNull();
    expect(d.scenarios.realiste.delaiRecuperationAns).toBeNull();
    expect(d.scenarios.realiste.seuilRentabilite.moisAtteint).toBeNull();
  });

  it("projet limite : rentabilité entre −5 % et +5 %", () => {
    // CA réaliste = 1 520 000 × 1,02 ≈ charges + 2 %.
    const prix = (1_520_000 * 1.02) / (30_000 * 0.7);
    const l = calculerFinances({ ...tomate2ha, revenus: [{ ...tomate2ha.revenus[0], prixUnitaire: prix }] });
    expect(l.scenarios.realiste.statut).toBe("limite");
  });

  it("crédit : intérêts en charges, capital en trésorerie", () => {
    const c = calculerFinances({ ...tomate2ha, apport: 455_000, credit: { montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 12 } });
    const a1 = c.scenarios.realiste.annees[0];
    expect(a1.interets).toBe(134_715);
    expect(a1.resultat).toBe(1_630_000 - 134_715);
    expect(a1.remboursementCapital).toBe(1_000_000);
    expect(a1.fluxTresorerie).toBe(1_830_000 - 134_715 - 1_000_000);
    expect(c.scenarios.realiste.annees[1].interets).toBe(0);
    expect(c.scenarios.realiste.tresorerieMensuelleAn1[0].entrees).toBe(1_455_000);
    expect(c.besoinFinancement).toBe(1_000_000);
    // VAN et TRI sont calculés avant financement : identiques au cas sans crédit.
    expect(c.scenarios.realiste.van).toBe(reel.van);
  });

  it("hausse des prix et des charges d'une année sur l'autre", () => {
    const h = calculerFinances({ ...tomate2ha, haussePrix: 0.1, hausseCharges: 0.05 });
    expect(h.scenarios.realiste.annees[1].chiffreAffaires).toBe(3_465_000);
    expect(h.scenarios.realiste.annees[1].chargesVariables).toBe(1_260_000);
  });

  it("amortissement arrêté à la fin de la durée de vie", () => {
    const sansRenouvellement = { ...tomate2ha, horizonAnnees: 5, charges: tomate2ha.charges.map((c) => (c.id === "pompe" ? { ...c, renouvellement: false } : c)) };
    const a = calculerFinances(sansRenouvellement);
    expect(a.scenarios.realiste.annees.map((x) => x.amortissements)).toEqual([200_000, 200_000, 200_000, 0, 0]);
  });

  it("renouvellement : la motopompe de 3 ans est rachetée au mois 36 et amortie ensuite", () => {
    const a = calculerFinances({ ...tomate2ha, horizonAnnees: 5 }).scenarios.realiste;
    expect(a.annees.map((x) => x.amortissements)).toEqual([200_000, 200_000, 200_000, 200_000, 200_000]);
    expect(a.investissementsDates.map((i) => [i.mois, i.montant, i.renouvellement])).toEqual([[0, 600_000, false], [36, 600_000, true]]);
    expect(a.annees.map((x) => x.investissements)).toEqual([600_000, 0, 600_000, 0, 0]);
    expect(a.tresorerieMensuelle).toHaveLength(61);
    expect(a.tresorerieMensuelle[36].sorties).toBeGreaterThanOrEqual(600_000);
  });

  it("plusieurs cycles par an", () => {
    const deux = calculerFinances({
      charges: [{ id: "a", libelle: "Aliment", typeCharge: "intrants", quantite: 1, prixUnitaire: 100_000, cyclesParAn: 2, nature: "variable", classe: "exploitation" }],
      revenus: [{ id: "p", libelle: "Poulets", typeRevenu: "principal", quantite: { pessimiste: 1, realiste: 1, optimiste: 1 }, prixUnitaire: 150_000, cyclesParAn: 2 }],
    });
    expect(deux.scenarios.realiste.annees[0].chiffreAffaires).toBe(300_000);
    expect(deux.scenarios.realiste.annees[0].chargesVariables).toBe(200_000);
  });

  it("refuse un investissement sans durée de vie", () => {
    expect(() =>
      calculerFinances({
        charges: [{ id: "x", libelle: "Hangar", typeCharge: "infrastructures", quantite: 1, prixUnitaire: 1, nature: "fixe", classe: "investissement" }],
        revenus: [],
      }),
    ).toThrow(ErreurMoteur);
  });
});

describe("fonctions financières", () => {
  it("TRI d'un flux simple", () => {
    // −1 000 puis 600 deux ans : TRI ≈ 13,07 %.
    expect(tri([-1000, 600, 600])).toBeCloseTo(0.1307, 3);
    expect(tri([1000, 600])).toBeNull();
  });

  it("délai de récupération fractionnaire", () => {
    expect(delaiRecuperation([-1000, 400, 400, 400])).toBeCloseTo(2.5, 5);
    expect(delaiRecuperation([-1000, 100, 100])).toBeNull();
  });
});
