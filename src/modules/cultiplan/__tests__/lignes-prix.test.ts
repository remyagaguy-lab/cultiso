/** @jest-environment node */
import { calculerFinances, genererBudget, type EntreeBudget } from "@/moteurs";
import {
  appliquerCorrection,
  depuisBudget,
  depuisSaisie,
  entreeFinance,
  ErreurPlan,
  injecterPrix,
  schemaFinancement,
  schemaHypotheses,
  versLigne,
  versMoteur,
  type LigneChargePlan,
  type LignePlan,
  type RangeeLigne,
} from "..";

const entree: EntreeBudget = {
  ateliers: [{ atelierId: "a1", speculationCode: "tomate", taille: 2, cyclesParAn: 2 }],
  modelesCharges: [
    { id: "m-engrais", speculationCode: "tomate", typeCharge: "intrants", libelle: "Engrais NPK", unite: "sac", quantite: 4, prixReference: 18000, produitPrix: "Engrais NPK 15-15-15", nature: "variable", classe: "exploitation", statut: "brouillon_ia" },
    { id: "m-semence", speculationCode: "tomate", typeCharge: "intrants", libelle: "Semences", unite: "sachet", quantite: 1, prixReference: 5000, produitPrix: "Semence tomate", nature: "variable", classe: "exploitation", statut: "validee" },
    { id: "m-pompe", speculationCode: "tomate", typeCharge: "infrastructures", libelle: "Motopompe", unite: "unité", quantite: 0.5, prixReference: 250000, nature: "fixe", classe: "investissement", dureeVieAns: 5, base: "an", statut: "brouillon_ia" },
  ],
  modelesRevenus: [
    { id: "m-vente", speculationCode: "tomate", typeRevenu: "principal", libelle: "Vente de tomates", unite: "kg", quantite: { pessimiste: 8000, realiste: 10000, optimiste: 12000 }, pertes: 0.3, prixReference: 150, produitPrix: "Tomate", statut: "brouillon_ia" },
  ],
  contexte: { saison: "contre_saison" },
  regles: [{ id: "r-saison", cleQuestion: "saison", valeur: "contre_saison", effet: "multiplier", cible: { sens: "revenu" }, coefficient: 1.2, statut: "brouillon_ia" }],
  prix: [],
};

describe("prix du marché injectés dans le budget", () => {
  const releves = [
    { produit: "engrais npk 15-15-15", prix: 21000, unite: "Sac", lieu: "Lomé", date: "2026-11-01", source: "Relevé Cultiso" },
    { produit: "Tomaté", prix: 200, unite: "kg", lieu: null, date: "2026-10-01", source: null },
    { produit: "Tomate", prix: 250, unite: "kg", lieu: "Kara", date: "2026-11-15", source: "Annonce" },
    // Même produit, autre unité : ne remplace pas la référence au sachet.
    { produit: "Semence tomate", prix: 900, unite: "g", lieu: null, date: "2026-11-20", source: null },
  ];

  it("remplace la référence par le dernier relevé dans la même unité, sans tenir compte des accents ni des majuscules", () => {
    const budget = genererBudget(injecterPrix(entree, releves));
    const engrais = budget.charges.find((c) => c.modeleId === "m-engrais")!;
    expect(engrais).toMatchObject({ prixUnitaire: 21000, origine: "prix_marche", sourcePrix: { source: "Relevé Cultiso, Lomé", date: "2026-11-01" } });

    const vente = budget.revenus[0];
    // Le prix du marché le plus récent (250), puis la règle de contre-saison (× 1,2).
    expect(vente.prixUnitaire).toBeCloseTo(300);
    expect(vente.origine).toBe("ajustee_terrain");
    expect(vente.sourcePrix).toEqual({ source: "Annonce, Kara", date: "2026-11-15" });
  });

  it("garde la référence quand l'unité diffère ou qu'aucun produit n'est désigné", () => {
    const budget = genererBudget(injecterPrix(entree, releves));
    expect(budget.charges.find((c) => c.modeleId === "m-semence")).toMatchObject({ prixUnitaire: 5000, origine: "reference", sourcePrix: null });
    expect(budget.charges.find((c) => c.modeleId === "m-pompe")).toMatchObject({ prixUnitaire: 250000, origine: "estimation" });
  });

  it("sans relevé, le budget reste celui du référentiel", () => {
    const sans = genererBudget(injecterPrix(entree, []));
    expect(sans.charges.every((c) => c.origine !== "prix_marche")).toBe(true);
    expect(sans.charges.find((c) => c.modeleId === "m-engrais")?.prixUnitaire).toBe(18000);
  });
});

function rangee(insertion: ReturnType<typeof depuisBudget>, id: string): RangeeLigne {
  return {
    id,
    created_at: "2026-11-27T00:00:00Z",
    updated_at: "2026-11-27T00:00:00Z",
    ...insertion,
  } as RangeeLigne;
}

describe("conversions des lignes", () => {
  const budget = genererBudget(entree);
  const lignes: LignePlan[] = [...budget.charges, ...budget.revenus].map((l, i) => versLigne(rangee(depuisBudget("p1", l, budget.journal, i), `l${i}`)));

  it("garde l'origine, la trace du modèle et les ajustements du terrain", () => {
    const vente = lignes.find((l) => l.sens === "revenu")!;
    expect(vente).toMatchObject({
      sens: "revenu",
      type: "principal",
      origine: "ajustee_terrain",
      modeleId: "m-vente",
      quantites: { pessimiste: 16000, realiste: 20000, optimiste: 24000 },
      pertes: 0.3,
      cyclesParAn: 2,
      ajustements: [{ regleId: "r-saison", effet: "multiplier", coefficient: 1.2 }],
    });
    const pompe = lignes.find((l) => l.modeleId === "m-pompe") as LigneChargePlan;
    expect(pompe).toMatchObject({ classe: "investissement", dureeVieAns: 5, base: "an", quantite: 1 });
  });

  it("donne au moteur les mêmes lignes que le générateur de budget", () => {
    const { charges, revenus } = entreeFinance({ lignes, hypotheses: schemaHypotheses.parse({}), financement: schemaFinancement.parse({}) });
    expect(charges.map((c) => [c.typeCharge, c.quantite, c.prixUnitaire])).toEqual(budget.charges.map((c) => [c.typeCharge, c.quantite, c.prixUnitaire]));
    expect(revenus[0].quantite).toEqual(budget.revenus[0].quantite);
    expect(versMoteur(lignes[0])).toHaveProperty("charge.id", "l0");
  });

  it("une correction passe la ligne à l'origine de son auteur et efface la source du prix", () => {
    const engrais = lignes[0];
    expect(appliquerCorrection(engrais, { prixUnitaire: 20000 }, "utilisateur")).toEqual({ origine: "utilisateur", prix_unitaire: 20000, source_prix: null });
    expect(appliquerCorrection(engrais, { quantite: 10 }, "cultisia")).toEqual({ origine: "cultisia", quantite: 10 });
  });

  it("refuse une correction incohérente", () => {
    const engrais = lignes[0];
    expect(() => appliquerCorrection(engrais, { pertes: 0.2 }, "utilisateur")).toThrow(ErreurPlan);
    expect(() => appliquerCorrection(engrais, { classe: "investissement" }, "utilisateur")).toThrow(/durée de vie/);
    expect(() => appliquerCorrection(engrais, {}, "utilisateur")).toThrow(/aucune correction/);
    expect(() => appliquerCorrection(engrais, { prixUnitaire: -1 }, "utilisateur")).toThrow(ErreurPlan);
    expect(() => appliquerCorrection(engrais, { origine: "reference" } as never, "utilisateur")).toThrow(ErreurPlan);
  });

  it("valide une ligne saisie et lui donne l'origine de son auteur", () => {
    const r = depuisSaisie("p1", { sens: "revenu", type: "coproduit", libelle: "Plants vendus", unite: "plant", quantites: { pessimiste: 100, realiste: 200, optimiste: 300 }, prixUnitaire: 50 }, "utilisateur", 9);
    expect(r).toMatchObject({ sens: "revenu", origine: "utilisateur", quantite_realiste: 200, pertes: 0, ordre: 9, modele_id: null });
    expect(() => depuisSaisie("p1", { sens: "charge", type: "infrastructures", libelle: "Serre", unite: "unité", quantite: 1, prixUnitaire: 1e6, nature: "fixe", classe: "investissement" }, "utilisateur", 0)).toThrow(/durée de vie/);
    expect(() => depuisSaisie("p1", { sens: "charge", type: "principal", libelle: "X", unite: "u", quantite: 1, prixUnitaire: 1, nature: "fixe", classe: "exploitation" } as never, "utilisateur", 0)).toThrow(ErreurPlan);
  });

  it("hypothèses et financement prennent les valeurs validées par défaut", () => {
    expect(schemaHypotheses.parse({})).toEqual({
      horizonAnnees: 3,
      horizonMois: null,
      horizonCycles: null,
      montee: [],
      tauxActualisation: 0.12,
      hausseCharges: 0,
      haussePrix: 0,
      prelevementsAnnuels: null,
      revenusExterieursAnnuels: 0,
      salairesAnnuels: 0,
      impotsAnnuels: 0,
      ecartsScenarios: { pessimiste: { prix: 0, charges: 0 }, optimiste: { prix: 0, charges: 0 } },
      baissePrixBas: null,
    });
    expect(schemaFinancement.parse({})).toEqual({ apport: 0, credit: null, moisTirageCredit: 0, regleFinanceur: null });
    expect(() => schemaHypotheses.parse({ horizonAnnees: 11 })).toThrow();
  });

  it("ménage (M3) : transmis au moteur seulement si le coût de vie est renseigné", () => {
    const sans = entreeFinance({ lignes, hypotheses: schemaHypotheses.parse({}), financement: schemaFinancement.parse({}) });
    expect(sans.menage).toBeUndefined();
    const avec = entreeFinance({
      lignes,
      hypotheses: schemaHypotheses.parse({ prelevementsAnnuels: 900_000, revenusExterieursAnnuels: 300_000, salairesAnnuels: 120_000 }),
      financement: schemaFinancement.parse({}),
    });
    expect(avec.menage).toEqual({ prelevementsAnnuels: 900_000, revenusExterieursAnnuels: 300_000 });
    expect(avec.salairesAnnuels).toBe(120_000);
    expect(avec).not.toHaveProperty("prelevementsAnnuels");
    const r = calculerFinances(avec);
    expect(r.scenarios.realiste.annees[0].prelevementsNets).toBe(600_000);
    expect(r.scenarios.realiste.verdict.menageCouvert).not.toBeNull();
  });

  it("sensibilité (M5) : écarts des scénarios et baisse du prix bas transmis au moteur", () => {
    const hypotheses = schemaHypotheses.parse({ ecartsScenarios: { pessimiste: { prix: -0.2, charges: 0.1 } }, baissePrixBas: -0.3 });
    expect(hypotheses.ecartsScenarios.optimiste).toEqual({ prix: 0, charges: 0 });
    const e = entreeFinance({ lignes, hypotheses, financement: schemaFinancement.parse({}) });
    expect(e.sensibilite).toEqual({ baissePrixBas: -0.3 });
    const r = calculerFinances(e);
    expect(r.sensibilite.testPrixBas).toMatchObject({ baisse: -0.3, origine: "parametre" });
    expect(r.scenarios.pessimiste.annees[0].chiffreAffaires).toBeLessThan(calculerFinances({ ...e, ecartsScenarios: undefined }).scenarios.pessimiste.annees[0].chiffreAffaires);
    expect(() => schemaHypotheses.parse({ ecartsScenarios: { pessimiste: { prix: 0.2 } } })).toThrow();
  });

  it("règle du financeur (M4) : transmise au moteur, qui contrôle l'apport", () => {
    const regle = { nom: "ANPGF", apportMinimum: 0.2 };
    const e = entreeFinance({ lignes, hypotheses: schemaHypotheses.parse({}), financement: schemaFinancement.parse({ apport: 1, regleFinanceur: regle }) });
    expect(e.regleFinanceur).toEqual(regle);
    const apport = calculerFinances(e).scenarios.realiste.controles.find((c) => c.code === "APPORT_INSUFFISANT");
    expect(apport).toMatchObject({ niveau: "alerte", valeurs: { financeur: "ANPGF", apportMinimum: 0.2 } });
    expect(() => schemaFinancement.parse({ regleFinanceur: { nom: "X", apportMinimum: 20 } })).toThrow();
  });
});
