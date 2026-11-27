/** @jest-environment node */
import { calculerFinances, genererBudget, type EntreeBudget } from "@/moteurs";
import {
  appliquerCorrection,
  depuisBudget,
  depuisSaisie,
  entreeFinance,
  ErreurPlan,
  schemaFinancement,
  schemaHypotheses,
  versLigne,
  type LignePlan,
  type RangeeLigne,
} from "..";

const entree: EntreeBudget = {
  ateliers: [{ atelierId: "a1", speculationCode: "oignon", taille: 2, cyclesParAn: 1 }],
  modelesCharges: [
    { id: "m-semence", speculationCode: "oignon", typeCharge: "intrants", libelle: "Semences", unite: "kg", quantite: 3, prixReference: 5000, nature: "variable", classe: "exploitation", statut: "brouillon_ia" },
  ],
  modelesRevenus: [
    {
      id: "m-vente",
      speculationCode: "oignon",
      typeRevenu: "principal",
      libelle: "Vente d'oignons",
      unite: "kg",
      quantite: { pessimiste: 10000, realiste: 15000, optimiste: 18000 },
      pertes: 0,
      prixReference: 200,
      statut: "brouillon_ia",
      bornes: { min: 10000, max: 20000, source: "Source de test", dateSource: "2026-01-01", statut: "brouillon_ia" },
    },
  ],
  contexte: {},
  regles: [],
  prix: [],
};

function rangee(insertion: ReturnType<typeof depuisBudget>, id: string): RangeeLigne {
  return { id, created_at: "2026-11-27T00:00:00Z", updated_at: "2026-11-27T00:00:00Z", ...insertion } as RangeeLigne;
}

describe("champs de contrôle des lignes", () => {
  const budget = genererBudget(entree);
  const lignes: LignePlan[] = [...budget.charges, ...budget.revenus].map((l, i) => versLigne(rangee(depuisBudget("p1", l, budget.journal, i), `l${i}`)));
  const vente = lignes.find((l) => l.sens === "revenu")!;

  it("la génération range les bornes mises à la taille de l'atelier dans la ligne", () => {
    const insertion = depuisBudget("p1", budget.revenus[0], budget.journal, 0);
    expect(insertion.champs_controle).toEqual({
      bornesQuantite: { min: 20000, max: 40000, source: "Source de test (source du 2026-01-01)", statut: "brouillon_ia" },
    });
    expect(vente).toMatchObject({ controles: { bornesQuantite: { min: 20000, max: 40000, statut: "brouillon_ia" } } });
  });

  it("une charge sans champ optionnel garde un groupe vide", () => {
    expect(depuisBudget("p1", budget.charges[0], budget.journal, 0).champs_controle).toEqual({});
  });

  it("le recalcul repasse les bornes au moteur, qui les contrôle", () => {
    const e = entreeFinance({ lignes, hypotheses: schemaHypotheses.parse({}), financement: schemaFinancement.parse({}) });
    expect(e.revenus[0].bornesQuantite).toMatchObject({ min: 20000, max: 40000 });
    const direct = calculerFinances(e);
    expect(direct.scenarios.realiste.controles.find((c) => c.code === "RENDEMENT_HORS_BORNES")).toMatchObject({ niveau: "ok" });
  });

  it("une quantité corrigée au-delà du maximum déclenche l'alerte au recalcul", () => {
    const maj = appliquerCorrection(vente, { quantites: { pessimiste: 50000, realiste: 60000, optimiste: 70000 } }, "utilisateur");
    const corrigee = versLigne({ ...rangee(depuisBudget("p1", budget.revenus[0], budget.journal, 0), "l1"), ...maj } as RangeeLigne);
    const e = entreeFinance({ lignes: [corrigee], hypotheses: schemaHypotheses.parse({}), financement: schemaFinancement.parse({}) });
    const c = calculerFinances(e).scenarios.realiste.controles.find((x) => x.code === "RENDEMENT_HORS_BORNES");
    expect(c).toMatchObject({ niveau: "alerte" });
  });

  it("valide et range les champs saisis, et refuse ceux qui n'ont pas d'objet pour le sens de la ligne", () => {
    const r = depuisSaisie("p1", { sens: "revenu", type: "principal", libelle: "Vente", unite: "kg", quantites: { pessimiste: 1, realiste: 2, optimiste: 3 }, prixUnitaire: 100, controles: { client: "Marché de Kara", debouche: { volumeAbsorbable: 5 } } }, "utilisateur", 0);
    expect(r.champs_controle).toEqual({ client: "Marché de Kara", debouche: { volumeAbsorbable: 5 } });
    const charge = { sens: "charge", type: "intrants", libelle: "Engrais", unite: "sac", quantite: 1, prixUnitaire: 1, nature: "variable", classe: "exploitation" } as const;
    expect(depuisSaisie("p1", { ...charge, controles: { fournisseur: "Agro Plus" } }, "utilisateur", 0).champs_controle).toEqual({ fournisseur: "Agro Plus" });
    expect(() => depuisSaisie("p1", { ...charge, controles: { client: "X" } } as never, "utilisateur", 0)).toThrow(ErreurPlan);
  });

  it("une correction remplace le groupe, et refuse un champ d'un autre sens", () => {
    const engrais = lignes[0];
    expect(appliquerCorrection(engrais, { controles: { fournisseur: "Agro Plus" } }, "utilisateur")).toEqual({ origine: "utilisateur", champs_controle: { fournisseur: "Agro Plus" } });
    expect(() => appliquerCorrection(engrais, { controles: { client: "X" } }, "utilisateur")).toThrow(ErreurPlan);
    expect(() => appliquerCorrection(vente, { controles: { bornesQuantite: { max: -1 } } }, "utilisateur")).toThrow(ErreurPlan);
  });

  it("signale un groupe jsonb illisible au lieu de l'ignorer", () => {
    const r = { ...rangee(depuisBudget("p1", budget.revenus[0], budget.journal, 0), "l9"), champs_controle: { bornesQuantite: { max: "beaucoup" } } } as unknown as RangeeLigne;
    expect(() => versLigne(r)).toThrow(/illisibles/);
  });
});
