/** @jest-environment node */
// R11 (durée et différé contre les règles du financeur) et S5 (alertes de prudence), sur le cas « 2 ha de tomate ».
// Coût du projet : motopompe 600 000 + BFR 855 000 = 1 455 000. Excédent brut : 1 830 000 par an.
import { CODES_CONTROLE, type CodeControle, type Controle } from "../controles";
import { calculerFinances, type EntreeFinance } from "../finance";
import { tomate2ha } from "../test-utils/tomate";

const ANPGF = { nom: "ANPGF", apportMinimum: 0.2, dureeMaxMois: 48, differeMaxMois: 12, source: "Canevas ANPGF §10.1 et §10.3", statut: "brouillon_ia" };
const credit = (dureeMois: number, differeMois = 0, montant = 1_000_000) => ({ montant, tauxAnnuel: 0.24, dureeMois, differeMois });
const realiste = (e: Partial<EntreeFinance>) => calculerFinances({ ...tomate2ha, ...e }).scenarios.realiste;
const codes = (c: Controle[]) => c.map((x) => x.code);
const un = (controles: Controle[], code: CodeControle) => {
  const l = controles.filter((c) => c.code === code);
  expect(l).toHaveLength(1);
  return l[0];
};

describe("R11 : durée et différé contre les règles du financeur", () => {
  it("durée et différé dans les règles : deux contrôles ok, avec la source et le statut de la règle", () => {
    const c = realiste({ apport: 455_000, credit: credit(48, 12), regleFinanceur: ANPGF }).controles;
    const d = un(c, "DUREE_HORS_REGLE");
    expect(d.niveau).toBe("ok");
    expect(d.valeurs).toMatchObject({ dureeMois: 48, dureeMaxMois: 48, financeur: "ANPGF", statutRegle: "brouillon_ia" });
    expect(un(c, "DIFFERE_HORS_REGLE").niveau).toBe("ok");
  });

  it("durée de 60 mois : alerte, avec la phrase qui nomme le financeur et le maximum", () => {
    const d = un(realiste({ apport: 455_000, credit: credit(60), regleFinanceur: ANPGF }).controles, "DUREE_HORS_REGLE");
    expect(d.niveau).toBe("alerte");
    expect(d.message).toContain("5 ans");
    expect(d.message).toContain("ANPGF");
    expect(d.message).toContain("4 ans");
  });

  it("différé de 18 mois : alerte", () => {
    const d = un(realiste({ apport: 455_000, credit: credit(48, 18), regleFinanceur: ANPGF }).controles, "DIFFERE_HORS_REGLE");
    expect(d.niveau).toBe("alerte");
    expect(d.valeurs).toMatchObject({ differeMois: 18, differeMaxMois: 12 });
  });

  it("si la règle dit que la durée ne compte pas le différé, on compare la durée de remboursement", () => {
    const regle = { ...ANPGF, dureeInclutDiffere: false };
    expect(un(realiste({ apport: 455_000, credit: credit(60, 12), regleFinanceur: regle }).controles, "DUREE_HORS_REGLE").niveau).toBe("ok");
    expect(un(realiste({ apport: 455_000, credit: credit(61, 12), regleFinanceur: regle }).controles, "DUREE_HORS_REGLE").niveau).toBe("alerte");
  });

  it("règle inconnue ou pas de crédit : rien n'est contrôlé, rien n'est inventé", () => {
    expect(codes(realiste({ apport: 455_000, credit: credit(60, 18), regleFinanceur: { nom: "Banque X", apportMinimum: 0.1 } }).controles)).not.toContain("DUREE_HORS_REGLE");
    expect(codes(realiste({ apport: 455_000, regleFinanceur: ANPGF }).controles)).not.toContain("DIFFERE_HORS_REGLE");
    expect(codes(realiste({ apport: 455_000, credit: credit(60, 18) }).controles)).not.toContain("DUREE_HORS_REGLE");
  });
});

describe("S5 : alertes de prudence", () => {
  it("un plan sain sans règle ne déclenche aucune alerte", () => {
    const c = realiste({ apport: 1_455_000 }).controles;
    expect(codes(c).filter((x) => x.startsWith("ALERTE_"))).toEqual([]);
  });

  it("chaque code d'alerte est déclaré dans la liste des codes", () => {
    for (const code of ["ALERTE_APPORT_SOUS_SEUIL", "ALERTE_MENAGE_NON_COUVERT", "ALERTE_MOIS_DEFICITAIRES_NON_FINANCES", "ALERTE_POINT_BAS_NON_COUVERT", "ALERTE_EXPOSITION_PRIX"]) {
      expect(CODES_CONTROLE).toContain(code);
    }
  });

  it("apport sous le seuil du financeur : reprend les valeurs du contrôle, avec ce qu'il manque", () => {
    const c = realiste({ apport: 200_000, credit: credit(36), regleFinanceur: ANPGF }).controles;
    const a = un(c, "ALERTE_APPORT_SOUS_SEUIL");
    const base = un(c, "APPORT_INSUFFISANT");
    expect(a.niveau).toBe("alerte");
    expect(a.valeurs).toEqual(base.valeurs);
    expect(a.message).toContain("ANPGF");
    expect(a.message).toContain("91 000 FCFA"); // 20 % de 1 455 000 = 291 000, moins 200 000
  });

  it("apport suffisant : pas d'alerte d'apport", () => {
    expect(codes(realiste({ apport: 400_000, credit: credit(36), regleFinanceur: ANPGF }).controles)).not.toContain("ALERTE_APPORT_SOUS_SEUIL");
  });

  it("revenu du ménage non couvert : alerte bloquante avec les années et le manque", () => {
    const s = realiste({ apport: 1_455_000, menage: { prelevementsAnnuels: 3_000_000 } });
    const a = un(s.controles, "ALERTE_MENAGE_NON_COUVERT");
    expect(a.niveau).toBe("bloquant");
    expect(a.valeurs.annees).toEqual(s.annees.filter((x) => x.soldeResiduel < 0).map((x) => x.an));
    expect(a.valeurs.soldeResiduelMin).toBe(Math.min(...s.annees.map((x) => x.soldeResiduel)));
    expect(s.verdict.menageCouvert).toBe(false);
  });

  it("ménage couvert ou non renseigné : pas d'alerte de ménage", () => {
    expect(codes(realiste({ apport: 1_455_000, menage: { prelevementsAnnuels: 500_000 } }).controles)).not.toContain("ALERTE_MENAGE_NON_COUVERT");
    expect(codes(realiste({ apport: 1_455_000 }).controles)).not.toContain("ALERTE_MENAGE_NON_COUVERT");
  });

  it("sans apport : point bas non couvert, avec le mois et le montant qui manque, et mois déficitaires non financés", () => {
    const s = realiste({ apport: 0 });
    expect(s.pointBasTresorerie.montant).toBeLessThan(0);
    const p = un(s.controles, "ALERTE_POINT_BAS_NON_COUVERT");
    expect(p.valeurs).toMatchObject({ pointBas: s.pointBasTresorerie.montant, mois: s.pointBasTresorerie.mois, manque: -s.pointBasTresorerie.montant });
    const m = un(s.controles, "ALERTE_MOIS_DEFICITAIRES_NON_FINANCES");
    const mois = m.valeurs.mois as number[];
    expect(mois.length).toBeGreaterThan(0);
    for (const x of mois) {
      expect(s.moisDeficitaires).toContain(x);
      expect(s.tresorerieMensuelleAn1.find((t) => t.mois === x)!.cumul).toBeLessThan(0);
    }
  });

  it("trésorerie couverte : ni point bas ni mois déficitaires non financés", () => {
    const c = codes(realiste({ apport: 1_455_000 }).controles);
    expect(c).not.toContain("ALERTE_POINT_BAS_NON_COUVERT");
    expect(c).not.toContain("ALERTE_MOIS_DEFICITAIRES_NON_FINANCES");
  });

  it("exposition au prix : rentable au prix prévu, déficitaire au prix bas testé", () => {
    // Charges lourdes : le projet gagne à 150 FCFA/kg mais perd si le prix baisse de 20 % (grille par défaut).
    const lourd: EntreeFinance = {
      ...tomate2ha,
      apport: 1_455_000,
      charges: tomate2ha.charges.map((c) => (c.id === "mo" ? { ...c, prixUnitaire: 700_000 } : c)),
      sensibilite: { baissePrixBas: -0.3 },
    };
    const r = calculerFinances(lourd);
    const s = r.scenarios.realiste;
    expect(s.statut).not.toBe("deficitaire");
    expect(r.sensibilite.testPrixBas.statut).toBe("deficitaire");
    const a = un(s.controles, "ALERTE_EXPOSITION_PRIX");
    expect(a.valeurs).toMatchObject({ baisse: -0.3, statutAuPrixBas: "deficitaire", origineBaisse: "parametre" });
    expect(a.valeurs.resultatCumuleAuPrixBas).toBe(r.sensibilite.testPrixBas.resultatCumule);
    // L'alerte ne se lit que sur le scénario réaliste.
    expect(codes(r.scenarios.pessimiste.controles)).not.toContain("ALERTE_EXPOSITION_PRIX");
  });

  it("exposition au prix : un projet qui tient au prix bas ne déclenche rien", () => {
    const r = calculerFinances({ ...tomate2ha, apport: 1_455_000, sensibilite: { baissePrixBas: -0.01 } });
    expect(codes(r.scenarios.realiste.controles)).not.toContain("ALERTE_EXPOSITION_PRIX");
  });
});
