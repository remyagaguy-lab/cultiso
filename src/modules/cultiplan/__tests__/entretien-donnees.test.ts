/** @jest-environment node */
// Cohérence des DONNÉES de l'entretien de cadrage (supabase/donnees/entretien-cadrage.json) : ce que la base contiendra après import.
import { construireEntretien, schemaCondition, type Condition } from "@/referentiel/entretien";
import { deplierEntretien } from "@/referentiel/donnees-depart";
import { CHAMPS_PROFIL } from "../profil";
import { donneesEntretien, donneesReferentiel, entretienDeDepart } from "../test-utils/entretien-depart";

const champsDe = (c: Condition): string[] => ("tous" in c ? c.tous.flatMap(champsDe) : "un_des" in c ? c.un_des.flatMap(champsDe) : [c.champ]);

describe("entretien de cadrage : données de départ", () => {
  const entretien = entretienDeDepart();

  it("compte les six temps du déroulé, dans l'ordre, et les sept dimensions de faisabilité", () => {
    expect(entretien.temps.map((t) => t.cle)).toEqual(["idee", "existant", "menage", "marche", "contraintes", "retour"]);
    expect(entretien.dimensions.map((d) => d.cle)).toEqual(["terre", "eau", "travail", "argent", "marche", "savoir_faire", "regles"]);
  });

  it("garde toutes les questions de terrain actuelles et leur libellé", () => {
    const terrain = donneesReferentiel().questions;
    expect(terrain).toHaveLength(16);
    for (const t of terrain) {
      const q = entretien.questions.find((x) => x.remplit.cible === "contexte" && x.remplit.champ === t.cle);
      expect(q?.libelle).toBe(t.libelle);
      expect(q?.reponses).toEqual(t.reponses);
      expect(q?.secteurs).toEqual(t.secteurs);
    }
  });

  it("couvre tous les champs du profil du porteur (R9), l'existant et les crédits", () => {
    const remplis = new Set(entretien.questions.filter((q) => q.remplit.cible === "profil").map((q) => q.remplit.champ));
    for (const champ of CHAMPS_PROFIL) expect(remplis).toContain(champ);
    expect(entretien.questions.some((q) => q.remplit.cible === "existant")).toBe(true);
    expect(entretien.questions.some((q) => q.remplit.cible === "credits")).toBe(true);
  });

  it("couvre ce qui manquait : idée, avancement, ménage, acheteur, contrat, promesse d'achat, risques", () => {
    const contexte = new Set(entretien.questions.filter((q) => q.remplit.cible === "contexte").map((q) => q.remplit.champ));
    for (const cle of ["idee", "marche_acheteur", "marche_contrat", "marche_promesse", "risques"]) expect(contexte).toContain(cle);
    const tempsMarche = entretien.questions.filter((q) => q.temps === "marche").map((q) => q.remplit.champ);
    expect(tempsMarche).toEqual(expect.arrayContaining(["marche_acheteur", "marche_contrat", "marche_promesse"]));
  });

  it("chaque question a un libellé simple, un type, un champ rempli et accepte « je ne sais pas »", () => {
    for (const q of entretien.questions) {
      expect(q.libelle.length).toBeGreaterThan(5);
      expect(q.libelle).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i);
      expect(q.court.length).toBeGreaterThan(1);
      expect(q.remplit.champ).toMatch(/^[A-Za-z0-9_]+$/);
      if (q.type === "choix" || q.type === "choix_multiple") expect(q.reponses.length).toBeGreaterThan(1);
    }
  });

  it("ne demande jamais de quantité vendue, de rendement ni d'intrants", () => {
    for (const q of entretien.questions) {
      expect(`${q.libelle} ${q.aide ?? ""}`).not.toMatch(/combien (vendras|produiras|de kilos|d'engrais)|rendement|quantité vendue|dose/i);
    }
  });

  it("les conditions n'utilisent que des champs connus (profil, contexte, compteurs)", () => {
    const profil = new Set<string>(CHAMPS_PROFIL);
    const contexte = new Set(entretien.questions.filter((q) => q.remplit.cible === "contexte").map((q) => q.remplit.champ));
    const connu = (champ: string) => profil.has(champ) || champ === "nb_existant" || champ === "nb_credits" || (champ.startsWith("ctx.") && contexte.has(champ.slice(4)));
    const conditions = [
      ...entretien.questions.flatMap((q) => (q.condition ? [q.condition] : [])),
      ...entretien.dimensions.flatMap((d) => d.regles.map((r) => r.si)),
    ];
    expect(conditions.length).toBeGreaterThan(20);
    for (const c of conditions) for (const champ of champsDe(c)) expect(connu(champ)).toBe(true);
  });

  it("chaque dimension a des règles de feu avec une phrase, et au moins une question essentielle", () => {
    for (const d of entretien.dimensions) {
      expect(d.regles.length).toBeGreaterThan(0);
      expect(entretien.questions.some((q) => q.dimension === d.cle && q.essentielle)).toBe(true);
    }
  });

  it("est un brouillon IA à valider, avec une source sur chaque ligne dépliée", () => {
    expect(entretien.aValider).toBe(true);
    const lignes = deplierEntretien(donneesEntretien());
    for (const l of [...lignes.temps, ...lignes.dimensions, ...lignes.questions]) {
      expect(l.statut).toBe("brouillon_ia");
      expect(l.source).toBeTruthy();
    }
    expect(lignes.questions.every((q) => q.question_terrain !== null || (q.libelle && q.type && q.remplit))).toBe(true);
  });

  it("refuse une donnée incohérente", () => {
    const lignes = deplierEntretien(donneesEntretien());
    expect(() => construireEntretien({ ...lignes, questions: [{ ...lignes.questions[0], temps: "inconnu" }] }, [])).toThrow(/temps inconnu/);
    expect(() => construireEntretien({ ...lignes, questions: [{ ...lignes.questions[0], dimension: "x" }] }, [])).toThrow(/dimension inconnue/);
    expect(() => construireEntretien({ ...lignes, questions: [{ ...lignes.questions[0], condition: { champ: "a", op: "tout" } }] }, [])).toThrow();
    expect(() => construireEntretien({ ...lignes, questions: lignes.questions.filter((q) => q.question_terrain) }, [])).toThrow(/introuvable/);
    expect(schemaCondition.safeParse({ champ: "a", op: "egal", valeur: 1 }).success).toBe(true);
  });
});
