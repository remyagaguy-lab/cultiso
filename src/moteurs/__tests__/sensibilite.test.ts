/** @jest-environment node */
// M5 : sensibilité, équilibres, test du prix bas, tableau rendement × charges, scénarios croisés.
// Cas « 2 ha de tomate » (test-utils/tomate.ts) : CA 3 150 000, résultat 1 630 000 par an (4 890 000 sur 3 ans),
// intrants 700 000, main-d'œuvre 500 000, charges décaissées 1 320 000, point bas −1 455 000 au mois 3.
import { ErreurMoteur } from "../commun";
import { calculerFinances, validerFinance, van, type EntreeFinance } from "../finance";
import { HYPOTHESES_CLES, varier } from "../sensibilite";
import { tomate2ha } from "../test-utils/tomate";

const ANNUITE_12_3ANS = 1 / 1.12 + 1 / 1.12 ** 2 + 1 / 1.12 ** 3;

describe("M5 : variation de chaque hypothèse clé", () => {
  const sens = calculerFinances(tomate2ha).sensibilite;
  const effet = (h: string, v: number) => sens.variations.find((x) => x.hypothese === h && x.variation === v)!;

  it("grille par défaut : 5 hypothèses × ±10 % et ±20 %", () => {
    expect(sens.variations).toHaveLength(HYPOTHESES_CLES.length * 4);
    expect(sens.base).toEqual({ resultatCumule: 4_890_000, pointBasTresorerie: -1_455_000, van: calculerFinances(tomate2ha).scenarios.realiste.van });
  });

  it("effet sur le résultat cumulé", () => {
    expect(effet("prix", 0.1).ecartResultat).toBe(945_000);
    expect(effet("rendement", 0.1).ecartResultat).toBe(945_000);
    expect(effet("pertes", 0.1).ecartResultat).toBe(-405_000); // pertes 33 % au lieu de 30 %
    expect(effet("intrants", 0.1).ecartResultat).toBe(-210_000);
    expect(effet("mainOeuvre", 0.1).ecartResultat).toBe(-150_000);
    expect(effet("prix", -0.2).resultatCumule).toBe(4_890_000 - 1_890_000);
  });

  it("effet sur le point bas de trésorerie et la VAN", () => {
    // Les ventes arrivent en avril : le prix ne change pas le creux de mars ; les intrants, si.
    expect(effet("prix", 0.1).ecartPointBas).toBe(0);
    expect(effet("intrants", 0.1).ecartPointBas).toBe(-70_000);
    expect(effet("mainOeuvre", 0.1).ecartPointBas).toBe(-12_500);
    expect(effet("prix", 0.1).ecartVan).toBeCloseTo(315_000 * ANNUITE_12_3ANS, -1);
  });

  it("classement : ce qui fait le plus basculer le projet", () => {
    expect(sens.classement).toEqual(["prix", "rendement", "pertes", "intrants", "mainOeuvre"]);
  });

  it("varier ne touche que l'hypothèse visée", () => {
    const e = { ...tomate2ha, salairesAnnuels: 100_000 } as Parameters<typeof varier>[0];
    const v = varier(e, "mainOeuvre", 0.2);
    expect(v.salairesAnnuels).toBe(120_000);
    expect(v.charges.find((c) => c.id === "semences")?.prixUnitaire).toBe(150_000);
    expect(v.charges.find((c) => c.id === "mo")?.prixUnitaire).toBe(300_000);
    expect(varier(e, "pertes", 3).revenus[0].pertes).toBe(1);
  });
});

describe("M5 : prix et rendement d'équilibre", () => {
  it("le résultat s'annule à 48,25 % du prix ou du rendement", () => {
    const eq = calculerFinances(tomate2ha).sensibilite.equilibre;
    // Charges 1 520 000 (amortissement compris) / CA 3 150 000.
    expect(eq.coefficient).toBeCloseTo(1_520_000 / 3_150_000, 4);
    expect(eq.parLigne).toEqual([
      { ligneId: "tomate", libelle: "Tomate fraîche", prixActuel: 150, prixEquilibre: 72.38, quantiteActuelle: 30_000, quantiteEquilibre: 14_476.19 },
    ]);
    // Vérification : au prix d'équilibre, le résultat est nul.
    const a = calculerFinances({ ...tomate2ha, revenus: [{ ...tomate2ha.revenus[0], prixUnitaire: (150 * 1_520_000) / 3_150_000 }] });
    expect(a.scenarios.realiste.annees[0].resultat).toBe(0);
  });

  it("sans vente, pas d'équilibre", () => {
    expect(calculerFinances({ ...tomate2ha, revenus: [] }).sensibilite.equilibre).toMatchObject({ coefficient: null, parLigne: [] });
  });
});

describe("M5 : test du prix bas (le ménage reste-t-il couvert ?)", () => {
  const avecMenage: EntreeFinance = { ...tomate2ha, apport: 1_455_000, menage: { prelevementsAnnuels: 900_000, revenusExterieursAnnuels: 300_000 } };

  it("par défaut : la plus forte baisse de la grille (−20 %)", () => {
    const t = calculerFinances(avecMenage).sensibilite.testPrixBas;
    expect(t).toMatchObject({ baisse: -0.2, origine: "grille", soldeResiduelMin: 600_000, resultatCumule: 3_000_000 });
    expect(t.verdict.menageCouvert).toBe(true);
  });

  it("l'écart de prix du scénario pessimiste, s'il est donné", () => {
    const t = calculerFinances({ ...avecMenage, ecartsScenarios: { pessimiste: { prix: -0.3 } } }).sensibilite.testPrixBas;
    expect(t).toMatchObject({ baisse: -0.3, origine: "scenario_pessimiste", soldeResiduelMin: 285_000 });
  });

  it("une baisse explicite qui ne couvre plus le ménage", () => {
    const t = calculerFinances({ ...avecMenage, sensibilite: { baissePrixBas: -0.5 } }).sensibilite.testPrixBas;
    expect(t).toMatchObject({ baisse: -0.5, origine: "parametre", soldeResiduelMin: -345_000, statut: "limite" });
    expect(t.verdict.menageCouvert).toBe(false);
  });

  it("sans ménage renseigné, le solde résiduel n'est pas évalué", () => {
    expect(calculerFinances(tomate2ha).sensibilite.testPrixBas.soldeResiduelMin).toBeNull();
  });
});

describe("M5 : tableau rendement × charges du seuil de commercialisation", () => {
  const r = calculerFinances(tomate2ha);
  const t = r.sensibilite.tableauSeuil;

  it("axes par défaut et case centrale égale au seuil de M3", () => {
    expect(t.axeRendement).toEqual([-0.2, -0.1, 0, 0.1, 0.2]);
    expect(t.axeCharges).toEqual([-0.1, -0.05, 0, 0.05, 0.1]);
    expect(t.coefficientsPrix[2][2]).toBe(r.scenarios.realiste.seuilCommercialisation.coefficientPrix);
    expect(t.lignePrincipale?.prixSeuil[2][2]).toBe(r.scenarios.realiste.seuilCommercialisation.parLigne[0].prixSeuil);
  });

  it("rendement −20 % et charges +10 % : 1 452 000 à couvrir avec 2 520 000 de CA", () => {
    expect(t.coefficientsPrix[0][4]).toBeCloseTo(1_452_000 / 2_520_000, 4);
    expect(t.lignePrincipale).toMatchObject({ ligneId: "tomate", prixActuel: 150 });
    expect(t.lignePrincipale?.prixSeuil[0][4]).toBe(86.43);
  });

  it("axes en paramètre", () => {
    const p = calculerFinances({ ...tomate2ha, sensibilite: { axeRendement: [0], axeCharges: [0, 0.1] } }).sensibilite.tableauSeuil;
    expect(p.coefficientsPrix).toHaveLength(1);
    expect(p.coefficientsPrix[0]).toHaveLength(2);
  });
});

describe("M5 : scénarios croisés (prix, rendement, charges)", () => {
  const croise: EntreeFinance = { ...tomate2ha, ecartsScenarios: { pessimiste: { prix: -0.2, charges: 0.1 }, optimiste: { prix: 0.1, charges: -0.05 } } };
  const r = calculerFinances(croise);

  it("le pessimiste baisse production et prix, et monte les charges", () => {
    const a1 = r.scenarios.pessimiste.annees[0];
    expect(a1.chiffreAffaires).toBe(1_680_000); // 20 000 kg × 120 FCFA × 0,7
    expect(a1.chargesVariables).toBe(1_320_000);
    expect(a1.chargesFixes).toBe(132_000);
    expect(a1.amortissements).toBe(200_000); // l'investissement ne bouge pas
    expect(a1.resultat).toBe(28_000);
  });

  it("l'optimiste monte production et prix, et baisse les charges", () => {
    const a1 = r.scenarios.optimiste.annees[0];
    expect(a1.chiffreAffaires).toBe(4_158_000); // 36 000 kg × 165 FCFA × 0,7
    expect(a1.excedentBrut).toBe(4_158_000 - 1_140_000 - 114_000);
  });

  it("le réaliste et sa sensibilité ne changent pas", () => {
    expect(r.scenarios.realiste.annees[0].resultat).toBe(1_630_000);
    expect(r.sensibilite.base.resultatCumule).toBe(4_890_000);
    expect(r.scenarios.realiste.van).toBe(Math.round(van([-600_000, 1_830_000, 1_830_000, 1_830_000], 0.12)));
  });

  it("refuse des écarts inversés", () => {
    expect(() => calculerFinances({ ...tomate2ha, ecartsScenarios: { pessimiste: { prix: 0.1 }, optimiste: { prix: -0.1 } } })).toThrow(ErreurMoteur);
  });
});

describe("S5 : intensité (part des intrants et de la main d'oeuvre, rendement requis)", () => {
  const { intensite } = calculerFinances(tomate2ha).sensibilite;

  it("part des intrants et de la main d'oeuvre dans les dépenses d'exploitation de l'an 1", () => {
    // Intrants 700 000 + main d'oeuvre 500 000 sur 1 320 000 de charges d'exploitation (terre comprise).
    expect(intensite).toMatchObject({ intrants: 700_000, mainOeuvre: 500_000, chargesExploitation: 1_320_000 });
    expect(intensite.partIntrantsMainOeuvre).toBeCloseTo(1_200_000 / 1_320_000, 3);
  });

  it("les salaires des employés comptent dans la main d'oeuvre", () => {
    const avecSalaires = calculerFinances({ ...tomate2ha, salairesAnnuels: 300_000 }).sensibilite.intensite;
    expect(avecSalaires.mainOeuvre).toBe(800_000);
    expect(avecSalaires.chargesExploitation).toBe(1_620_000);
  });

  it("coût et prix à l'unité vendue quand il n'y a qu'une ligne de revenu", () => {
    // 30 000 kg × (1 − 0,3) = 21 000 kg vendus ; 1 320 000 / 21 000 = 62,86 FCFA le kilo.
    expect(intensite.parUniteVendue).toEqual({ ligneId: "tomate", libelle: "Tomate fraîche", quantiteVendue: 21_000, coutParUnite: 62.86, prixParUnite: 150 });
  });

  it("plusieurs lignes de revenu : pas de coût à l'unité (les unités se mélangent)", () => {
    const deux = calculerFinances({ ...tomate2ha, revenus: [...tomate2ha.revenus, { ...tomate2ha.revenus[0], id: "oignon", libelle: "Oignon" }] }).sensibilite.intensite;
    expect(deux.parUniteVendue).toBeNull();
  });

  it("rendement requis pour qu'une hausse d'intensité ne fasse pas perdre d'argent, pour chaque hausse de la grille", () => {
    expect(intensite.seuils.map((s) => s.hausse)).toEqual([0.1, 0.2]);
    expect(intensite.seuils[0].surcout).toBe(120_000);
    expect(intensite.seuils[0].rendementRequis).toBeCloseTo(120_000 / 3_150_000, 3);
    expect(intensite.seuils[1].rendementRequis).toBeCloseTo(240_000 / 3_150_000, 3);
  });

  it("le rendement requis vérifie le calcul : +3,8 % de production compense +10 % d'intrants et de main d'oeuvre", () => {
    const r = intensite.seuils[0].rendementRequis!;
    const plusIntensif = varier(varier(validerFinance(tomate2ha), "intrants", 0.1), "mainOeuvre", 0.1);
    const avec = varier(plusIntensif, "rendement", r);
    const resultat = (e: EntreeFinance) => calculerFinances(e).sensibilite.base.resultatCumule;
    // Au gain requis, le résultat revient à (presque) celui du plan de départ, à l'arrondi du taux près.
    expect(Math.abs(resultat(avec) - resultat(tomate2ha))).toBeLessThan(0.0001 * 3_150_000 * 3);
  });

  it("sans vente : pas de rendement requis, pas d'erreur", () => {
    const sansVente = calculerFinances({ ...tomate2ha, revenus: [{ ...tomate2ha.revenus[0], quantite: { pessimiste: 0, realiste: 0, optimiste: 0 } }] }).sensibilite.intensite;
    expect(sansVente.seuils.every((s) => s.rendementRequis === null)).toBe(true);
    expect(sansVente.parUniteVendue).toBeNull();
  });

  it("une grille sans hausse positive donne une liste de seuils vide", () => {
    const grille = calculerFinances({ ...tomate2ha, sensibilite: { variations: [-0.1] } as never }).sensibilite.intensite;
    expect(grille.seuils).toEqual([]);
  });
});
