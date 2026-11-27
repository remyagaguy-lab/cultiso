// Entretien de cadrage (S3) : types et mise en forme des données du référentiel (tables ref.entretien_*).
// Pur : aucune lecture de base ici ; la lecture est dans index.ts (lireEntretien).
import { z } from "zod";

export type StatutEntretien = "brouillon_ia" | "a_valider" | "validee";
export const FEUX = ["vert", "orange", "rouge"] as const;
export type Feu = (typeof FEUX)[number];

const scalaire = z.union([z.string(), z.number(), z.boolean()]);

/**
 * Condition sur une valeur du profil (clé du profil), du contexte (« ctx.clé ») ou un compteur
 * (nb_existant, nb_credits). Une valeur non répondue ou « je ne sais pas » ne vérifie aucune condition,
 * sauf « inconnu ». Aucun calcul : seulement des comparaisons à une constante.
 */
export type Condition =
  | { champ: string; op: "dans" | "pas_dans"; valeurs: (string | number | boolean)[] }
  | { champ: string; op: "egal"; valeur: string | number | boolean }
  | { champ: string; op: "inferieur" | "superieur"; valeur: number }
  | { champ: string; op: "vrai" | "faux" | "connu" | "inconnu" }
  | { tous: Condition[] }
  | { un_des: Condition[] };

export const schemaCondition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ champ: z.string(), op: z.enum(["dans", "pas_dans"]), valeurs: z.array(scalaire).min(1) }).strict(),
    z.object({ champ: z.string(), op: z.literal("egal"), valeur: scalaire }).strict(),
    z.object({ champ: z.string(), op: z.enum(["inferieur", "superieur"]), valeur: z.number() }).strict(),
    z.object({ champ: z.string(), op: z.enum(["vrai", "faux", "connu", "inconnu"]) }).strict(),
    z.object({ tous: z.array(schemaCondition).min(1) }).strict(),
    z.object({ un_des: z.array(schemaCondition).min(1) }).strict(),
  ]),
);

export const TYPES_QUESTION = ["choix", "choix_multiple", "nombre", "montant", "oui_non", "texte", "liste"] as const;
export type TypeQuestion = (typeof TYPES_QUESTION)[number];

export const CIBLES = ["profil", "contexte", "existant", "credits"] as const;
export type Cible = (typeof CIBLES)[number];

const schemaRemplit = z.object({
  cible: z.enum(CIBLES),
  champ: z.string(),
  /** Remplit aussi une clé du contexte terrain, par correspondance de valeurs (pas de correspondance : pas de copie). */
  aussi: z.object({ cible: z.literal("contexte"), champ: z.string(), correspondance: z.record(z.string(), z.string()) }).optional(),
});
export type Remplit = z.output<typeof schemaRemplit>;

const schemaReponses = z.array(z.object({ valeur: z.string(), libelle: z.string() }));
const statut = z.enum(["brouillon_ia", "a_valider", "validee"]);

export interface TempsEntretien {
  cle: string;
  ordre: number;
  titre: string;
  intro: string;
}
export interface RegleFeu {
  si: Condition;
  feu: Feu;
  phrase: string;
}
export interface DimensionEntretien {
  cle: string;
  ordre: number;
  libelle: string;
  phraseSansAlerte: string;
  regles: RegleFeu[];
}
export interface QuestionEntretien {
  cle: string;
  temps: string;
  ordre: number;
  libelle: string;
  aide: string | null;
  type: TypeQuestion;
  unite: string | null;
  reponses: { valeur: string; libelle: string }[];
  remplit: Remplit;
  condition: Condition | null;
  dimension: string | null;
  essentielle: boolean;
  court: string;
  /** Secteurs concernés (vide = tous) : hérités de la question de terrain placée. */
  secteurs: string[];
  statut: StatutEntretien;
}
export interface Entretien {
  temps: TempsEntretien[];
  dimensions: DimensionEntretien[];
  questions: QuestionEntretien[];
  /** Vrai si au moins une ligne n'est pas encore validée par un expert. */
  aValider: boolean;
}

/** Lignes des tables ref.entretien_*, telles que la base (ou le fichier de départ déplié) les donne. */
export interface LignesEntretien {
  temps: { cle: string; ordre: number; titre: string; intro: string; statut: string }[];
  dimensions: { cle: string; ordre: number; libelle: string; phrase_sans_alerte: string; regles: unknown; statut: string }[];
  questions: {
    cle: string;
    temps: string;
    ordre: number;
    question_terrain: string | null;
    libelle: string | null;
    aide: string | null;
    type: string | null;
    unite: string | null;
    reponses: unknown;
    remplit: unknown;
    condition: unknown;
    dimension: string | null;
    essentielle: boolean;
    court: string;
    statut: string;
  }[];
}
export interface QuestionTerrainLue {
  cle: string;
  libelle: string;
  sousTitre: string | null;
  reponses: { valeur: string; libelle: string }[];
  secteurs: string[];
}

const schemaRegleFeu = z.object({ si: schemaCondition, feu: z.enum(FEUX), phrase: z.string().min(2) });

/**
 * Assemble l'entretien : valide chaque ligne et fusionne les questions de terrain placées dans l'entretien.
 * Lève une ZodError ou une Error lisible si une donnée est incohérente.
 */
export function construireEntretien(lignes: LignesEntretien, terrain: QuestionTerrainLue[]): Entretien {
  const temps = lignes.temps
    .map((t) => z.object({ cle: z.string(), ordre: z.number(), titre: z.string(), intro: z.string(), statut }).parse(t))
    .sort((a, b) => a.ordre - b.ordre);
  const dimensions = lignes.dimensions
    .map((d) =>
      z
        .object({ cle: z.string(), ordre: z.number(), libelle: z.string(), phrase_sans_alerte: z.string(), regles: z.array(schemaRegleFeu), statut })
        .parse(d),
    )
    .sort((a, b) => a.ordre - b.ordre);
  const codesTemps = new Set(temps.map((t) => t.cle));
  const codesDimensions = new Set(dimensions.map((d) => d.cle));

  const questions = lignes.questions.map((q): QuestionEntretien & { statutBrut: string } => {
    if (!codesTemps.has(q.temps)) throw new Error(`question ${q.cle} : temps inconnu « ${q.temps} »`);
    if (q.dimension !== null && !codesDimensions.has(q.dimension)) throw new Error(`question ${q.cle} : dimension inconnue « ${q.dimension} »`);
    const condition = q.condition === null ? null : schemaCondition.parse(q.condition);
    const base = { cle: q.cle, temps: q.temps, ordre: q.ordre, condition, dimension: q.dimension, essentielle: q.essentielle, court: q.court, statut: statut.parse(q.statut) };
    if (q.question_terrain !== null) {
      const t = terrain.find((x) => x.cle === q.question_terrain);
      if (!t) throw new Error(`question ${q.cle} : question de terrain « ${q.question_terrain} » introuvable`);
      return {
        ...base,
        libelle: t.libelle,
        aide: t.sousTitre,
        type: "choix",
        unite: null,
        reponses: t.reponses,
        remplit: { cible: "contexte", champ: t.cle },
        secteurs: t.secteurs,
        statutBrut: q.statut,
      };
    }
    const type = z.enum(TYPES_QUESTION).parse(q.type);
    const reponses = q.reponses === null ? [] : schemaReponses.parse(q.reponses);
    if ((type === "choix" || type === "choix_multiple") && reponses.length === 0) throw new Error(`question ${q.cle} : un choix doit avoir des réponses`);
    return {
      ...base,
      libelle: z.string().parse(q.libelle),
      aide: q.aide,
      type,
      unite: q.unite,
      reponses,
      remplit: schemaRemplit.parse(q.remplit),
      secteurs: [],
      statutBrut: q.statut,
    };
  });

  const cles = new Set<string>();
  for (const q of questions) {
    if (cles.has(q.cle)) throw new Error(`question ${q.cle} en double`);
    cles.add(q.cle);
  }
  const tousStatuts = [...temps.map((t) => t.statut), ...dimensions.map((d) => d.statut), ...questions.map((q) => q.statutBrut)];
  return {
    temps: temps.map(({ cle, ordre, titre, intro }) => ({ cle, ordre, titre, intro })),
    dimensions: dimensions.map((d) => ({ cle: d.cle, ordre: d.ordre, libelle: d.libelle, phraseSansAlerte: d.phrase_sans_alerte, regles: d.regles })),
    questions: questions
      .map(({ statutBrut: _s, ...q }) => {
        void _s;
        return q;
      })
      .sort((a, b) => codesOrdre(temps, a.temps) - codesOrdre(temps, b.temps) || a.ordre - b.ordre),
    aValider: tousStatuts.some((s) => s !== "validee"),
  };
}

const codesOrdre = (temps: { cle: string; ordre: number }[], cle: string) => temps.find((t) => t.cle === cle)?.ordre ?? 0;
