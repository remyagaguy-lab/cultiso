/** @jest-environment node */
// Contrôles de cohérence des données de départ du référentiel, sans base : structure, liens, unités,
// et passage de chaque spéculation dans le générateur de budget puis le moteur financier.
import donnees from "../../../supabase/donnees/referentiel-depart.json";
import { calculerFinances, genererBudget } from "@/moteurs";
import { deplier, uuidDe, type DonneesDepart } from "../donnees-depart";
import { versModeleCharge, versModeleRevenu, versRegle } from "..";

const d = deplier(donnees as DonneesDepart);
const modelesCharges = d.modelesCharges.map(versModeleCharge);
const modelesRevenus = d.modelesRevenus.map(versModeleRevenu);
const regles = d.regles.map(versRegle);

/** Taille de démonstration par unité d'échelle. */
const TAILLE_TYPE: Record<string, number> = { ha: 1, sujet: 500, poule: 500, tête: 20 };
const taille = (unite: string) => TAILLE_TYPE[unite] ?? 1;

describe("données de départ du référentiel", () => {
  it("10 spéculations, 16 questions, toutes en brouillon IA avec une source", () => {
    expect(d.speculations.map((s) => s.code)).toEqual([
      "tomate", "piment", "oignon", "mais", "soja", "poulet_chair", "poule_pondeuse", "tilapia", "gari", "embouche_ovine",
    ]);
    expect(d.questions).toHaveLength(16);
    for (const ligne of [...d.speculations, ...d.modelesCharges, ...d.modelesRevenus, ...d.questions, ...d.regles]) {
      expect(ligne.statut).toBe("brouillon_ia");
      expect(ligne.source?.length).toBeGreaterThan(10);
    }
  });

  it("identifiants uniques et déterministes", () => {
    const ids = [...d.modelesCharges, ...d.modelesRevenus, ...d.regles].map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(uuidDe("charge:tomate.semences")).toBe(uuidDe("charge:tomate.semences"));
    expect(uuidDe("charge:tomate.semences")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("chaque spéculation a des charges et un revenu principal", () => {
    for (const s of d.speculations) {
      expect(d.modelesCharges.filter((c) => c.speculation_code === s.code).length).toBeGreaterThan(0);
      expect(d.modelesRevenus.some((r) => r.speculation_code === s.code && r.type_revenu === "principal")).toBe(true);
    }
  });

  it("chaque règle renvoie à une question, une réponse possible et un modèle existants", () => {
    const questions = new Map(d.questions.map((q) => [q.cle, q]));
    const charges = new Map(d.modelesCharges.map((c) => [c.id, c]));
    for (const r of d.regles) {
      const q = questions.get(r.cle_question);
      expect(q).toBeDefined();
      expect(q?.reponses.map((x) => x.valeur)).toContain(r.valeur);
      if (r.cible_modele_id) expect(charges.get(r.cible_modele_id)?.speculation_code).toBe(r.speculation_code);
      if (r.speculation_code) expect(d.speculations.some((s) => s.code === r.speculation_code)).toBe(true);
    }
    expect(regles).toHaveLength(d.regles.length);
  });

  it.each(d.speculations.map((s) => [s.code, s] as const))("%s : budget et résultats calculables", (code, s) => {
    const budget = genererBudget({
      ateliers: [{ atelierId: "a", speculationCode: code, taille: taille(s.unite_echelle), cyclesParAn: s.cycles_par_an }],
      modelesCharges,
      modelesRevenus,
      regles,
    });
    expect(budget.ateliersSansModele).toEqual([]);
    expect(budget.charges.every((c) => c.origine === "estimation")).toBe(true);
    const f = calculerFinances({ charges: budget.charges, revenus: budget.revenus, horizonAnnees: 3 });
    const an1 = f.scenarios.realiste.annees[0];
    expect(an1.chiffreAffaires).toBeGreaterThan(0);
    expect(an1.chargesVariables + an1.chargesFixes).toBeGreaterThan(0);
    expect(Number.isFinite(f.scenarios.realiste.van)).toBe(true);
    expect(f.scenarios.pessimiste.annees[0].chiffreAffaires).toBeLessThanOrEqual(an1.chiffreAffaires);
  });

  it("toutes les réponses qui déclenchent une règle modifient bien le budget", () => {
    const contexte = Object.fromEntries(d.regles.map((r) => [r.cle_question, r.valeur]));
    for (const s of d.speculations) {
      const aDesRegles = d.regles.some((r) => r.speculation_code === null || r.speculation_code === s.code);
      const b = genererBudget({
        ateliers: [{ atelierId: "a", speculationCode: s.code, taille: 1, cyclesParAn: s.cycles_par_an }],
        modelesCharges,
        modelesRevenus,
        regles,
        contexte,
      });
      if (aDesRegles) expect(b.journal.length).toBeGreaterThan(0);
    }
  });
});
