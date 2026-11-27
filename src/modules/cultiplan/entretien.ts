// Entretien de cadrage (S3) : la consultation en six temps qui précède le plan.
// Les questions, leur ordre, leurs conditions et les phrases de lecture sont des DONNÉES du référentiel (ref.entretien_*).
// Ici : quelle est la prochaine question, ce qui manque, le point de faisabilité par dimension, l'enregistrement des réponses.
// AUCUN calcul financier : seulement des comparaisons à une constante. Les chiffres viennent des moteurs, plus tard.
import { z } from "zod";
import { lireExploitation, repondreTerrain, type ClientBase } from "@/core/exploitation";
import { lireEntretien, lireSpeculations, type Condition, type DimensionEntretien, type Entretien, type Feu, type QuestionEntretien, type TempsEntretien } from "@/referentiel";
import { ErreurPlan } from "./erreurs";
import { verifier } from "./lignes";
import {
  ecrireProfil,
  lireProfil,
  schemaCreditEnCours,
  schemaLigneExistant,
  schemaModificationProfil,
  type ChampProfil,
  type ModificationProfil,
  type ProfilPorteur,
} from "./profil";

/** Valeur gardée dans le contexte terrain pour « je ne sais pas » (le contexte n'accepte pas de valeur vide). */
export const VALEUR_INCONNUE = "inconnu";

export interface EtatEntretien {
  profil: ProfilPorteur;
  /** Contexte terrain de l'exploitation (clé : valeur). */
  contexte: Record<string, string>;
  /** Secteurs de la production (vegetal, animal, halieutique, transformation, services) ; sans eux, les questions propres à un secteur ne sont pas posées. */
  secteurs?: string[];
  /** Questions que le porteur veut laisser pour plus tard : on passe à la suivante, elles restent « à compléter ». */
  reportees?: string[];
}

export type EtatQuestion = "repondue" | "inconnue" | "a_poser" | "reportee" | "masquee";

// ---------------------------------------------------------------------------------------------------------------
// Évaluation des conditions
// ---------------------------------------------------------------------------------------------------------------

type Valeur = string | number | boolean | null | undefined;

/** Valeurs à plat : champs du profil, « ctx.clé » du contexte, compteurs des listes (seulement s'ils ont été renseignés). */
function valeursPlates(e: EtatEntretien): Record<string, Valeur> {
  const p = e.profil;
  const plates: Record<string, Valeur> = {};
  for (const [cle, v] of Object.entries(p.valeurs)) plates[cle] = Array.isArray(v) ? v.join(",") : (v as Valeur);
  for (const [cle, v] of Object.entries(e.contexte)) if (v !== VALEUR_INCONNUE) plates[`ctx.${cle}`] = v;
  // Une liste vide ne veut pas dire « zéro » : elle ne vaut zéro que si le porteur a dit « aucun ».
  plates.nb_existant = p.existant.length > 0 ? p.existant.length : p.sansExistant ? 0 : undefined;
  plates.nb_credits = p.credits.length > 0 ? p.credits.length : p.sansCredit ? 0 : undefined;
  return plates;
}

const elements = (v: Valeur): Valeur[] => (typeof v === "string" && v.includes(",") ? v.split(",") : [v]);

export function evaluer(c: Condition, plates: Record<string, Valeur>): boolean {
  if ("tous" in c) return c.tous.every((x) => evaluer(x, plates));
  if ("un_des" in c) return c.un_des.some((x) => evaluer(x, plates));
  const v = plates[c.champ];
  const absent = v === null || v === undefined;
  switch (c.op) {
    case "inconnu":
      return absent;
    case "connu":
      return !absent;
    case "vrai":
      return v === true;
    case "faux":
      return v === false;
    case "egal":
      return !absent && elements(v).includes(c.valeur);
    case "dans":
      return !absent && elements(v).some((x) => x !== null && x !== undefined && c.valeurs.includes(x));
    case "pas_dans":
      return !absent && !elements(v).some((x) => x !== null && x !== undefined && c.valeurs.includes(x));
    case "inferieur":
      return typeof v === "number" && v < c.valeur;
    case "superieur":
      return typeof v === "number" && v > c.valeur;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// État des questions, prochaine question, manques
// ---------------------------------------------------------------------------------------------------------------

/** Où en est cette question : répondue, « je ne sais pas », à poser, reportée ou sans objet. */
export function etatQuestion(q: QuestionEntretien, e: EtatEntretien, plates: Record<string, Valeur> = valeursPlates(e)): EtatQuestion {
  if (q.secteurs.length > 0 && !q.secteurs.some((s) => e.secteurs?.includes(s))) return "masquee";
  if (q.condition && !evaluer(q.condition, plates)) return "masquee";
  const { cible, champ } = q.remplit;
  const p = e.profil;
  let reponse: "repondue" | "inconnue" | null = null;
  if (cible === "profil") {
    if (p.valeurs[champ as ChampProfil] !== null && p.valeurs[champ as ChampProfil] !== undefined) reponse = "repondue";
    else if (p.inconnus.includes(champ as ChampProfil)) reponse = "inconnue";
  } else if (cible === "existant") {
    if (p.existant.length > 0 || p.sansExistant) reponse = "repondue";
    else if (p.inconnus.includes("existant")) reponse = "inconnue";
  } else if (cible === "credits") {
    if (p.credits.length > 0 || p.sansCredit) reponse = "repondue";
    else if (p.inconnus.includes("credits")) reponse = "inconnue";
  } else if (e.contexte[champ] !== undefined) {
    reponse = e.contexte[champ] === VALEUR_INCONNUE ? "inconnue" : "repondue";
  }
  if (reponse) return reponse;
  return e.reportees?.includes(q.cle) ? "reportee" : "a_poser";
}

export interface AvancementTemps {
  temps: string;
  titre: string;
  /** Questions répondues (« je ne sais pas » compris) sur les questions qui s'appliquent à ce porteur. */
  traitees: number;
  total: number;
}

export interface ProchaineQuestion {
  /** Vrai quand il n'y a plus rien à demander : on passe au temps six, le retour au porteur. */
  fini: boolean;
  question: QuestionEntretien | null;
  temps: TempsEntretien | null;
  /** Texte d'introduction du temps, à dire seulement quand on y entre. */
  introTemps: string | null;
  avancement: AvancementTemps[];
}

/** Questions qui s'appliquent à ce porteur, dans l'ordre de la consultation, avec leur état. */
export function questionsApplicables(entretien: Entretien, e: EtatEntretien): { question: QuestionEntretien; etat: Exclude<EtatQuestion, "masquee"> }[] {
  const plates = valeursPlates(e);
  return entretien.questions.flatMap((question) => {
    const etat = etatQuestion(question, e, plates);
    return etat === "masquee" ? [] : [{ question, etat }];
  });
}

/** La prochaine question selon les réponses déjà données (les questions sans objet ou reportées sont sautées). */
export function prochaineQuestion(entretien: Entretien, e: EtatEntretien): ProchaineQuestion {
  const applicables = questionsApplicables(entretien, e);
  const avancement = entretien.temps
    .filter((t) => applicables.some((a) => a.question.temps === t.cle))
    .map((t) => {
      const duTemps = applicables.filter((a) => a.question.temps === t.cle);
      return { temps: t.cle, titre: t.titre, traitees: duTemps.filter((a) => a.etat === "repondue" || a.etat === "inconnue").length, total: duTemps.length };
    });
  const suivante = applicables.find((a) => a.etat === "a_poser");
  if (!suivante) return { fini: true, question: null, temps: entretien.temps.at(-1) ?? null, introTemps: null, avancement };
  const temps = entretien.temps.find((t) => t.cle === suivante.question.temps) ?? null;
  const entree = avancement.find((a) => a.temps === suivante.question.temps)?.traitees === 0;
  return { fini: false, question: suivante.question, temps, introTemps: entree ? (temps?.intro ?? null) : null, avancement };
}

export interface Manque {
  question: QuestionEntretien;
  etat: "a_poser" | "reportee" | "inconnue";
}

/** Ce qui manque encore : questions non répondues, reportées ou « je ne sais pas », les essentielles d'abord. */
export function manques(entretien: Entretien, e: EtatEntretien): Manque[] {
  const liste = questionsApplicables(entretien, e).flatMap((a) => (a.etat === "repondue" ? [] : [{ question: a.question, etat: a.etat }]));
  return [...liste.filter((m) => m.question.essentielle), ...liste.filter((m) => !m.question.essentielle)];
}

// ---------------------------------------------------------------------------------------------------------------
// Point de faisabilité par dimension
// ---------------------------------------------------------------------------------------------------------------

export type FeuPoint = Feu | "gris";

export interface PointDimension {
  dimension: string;
  libelle: string;
  /** gris : on n'en sait pas assez pour juger. */
  feu: FeuPoint;
  /** Une phrase simple, à dire telle quelle. */
  phrase: string;
  /** Tout ce qui pèse sur cette dimension (rouge et orange, puis les manques), pour les détails. */
  points: { feu: FeuPoint; phrase: string }[];
  /** Questions essentielles sans réponse. */
  manques: string[];
  /** Questions essentielles où le porteur a répondu « je ne sais pas ». */
  inconnus: string[];
}

export interface PointFaisabilite {
  dimensions: PointDimension[];
  /** Feu d'ensemble : le pire des feux ; gris s'il reste des manques sans alerte. */
  feuGlobal: FeuPoint;
  essentielles: { traitees: number; total: number };
  /** Vrai si les données de l'entretien ne sont pas encore toutes validées par un expert. */
  aValider: boolean;
}

const liste = (mots: string[]) => (mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots.at(-1)}`);
const GRAVITE: Record<FeuPoint, number> = { vert: 0, gris: 1, orange: 2, rouge: 3 };
const pire = (feux: FeuPoint[]): FeuPoint => feux.reduce<FeuPoint>((a, b) => (GRAVITE[b] > GRAVITE[a] ? b : a), "vert");

function pointDimension(d: DimensionEntretien, applicables: ReturnType<typeof questionsApplicables>, plates: Record<string, Valeur>): PointDimension {
  const essentielles = applicables.filter((a) => a.question.essentielle && a.question.dimension === d.cle);
  const manquantes = essentielles.filter((a) => a.etat === "a_poser" || a.etat === "reportee").map((a) => a.question.court);
  const inconnues = essentielles.filter((a) => a.etat === "inconnue").map((a) => a.question.court);

  const declenchees = d.regles.filter((r) => evaluer(r.si, plates));
  const rouges = declenchees.filter((r) => r.feu === "rouge");
  const oranges = declenchees.filter((r) => r.feu === "orange");
  const verts = declenchees.filter((r) => r.feu === "vert");
  const phraseInconnu = `Tu ne sais pas encore ${liste(inconnues)}. À éclaircir avant de t'engager.`;
  const phraseManque = `Il manque encore ${liste(manquantes)}.`;

  const points: PointDimension["points"] = [
    ...rouges.map((r) => ({ feu: "rouge" as const, phrase: r.phrase })),
    ...oranges.map((r) => ({ feu: "orange" as const, phrase: r.phrase })),
    ...(inconnues.length > 0 ? [{ feu: "orange" as const, phrase: phraseInconnu }] : []),
    ...(manquantes.length > 0 ? [{ feu: "gris" as const, phrase: phraseManque }] : []),
  ];

  let feu: FeuPoint;
  let phrase: string;
  if (rouges.length > 0) [feu, phrase] = ["rouge", rouges[0].phrase];
  else if (oranges.length > 0) [feu, phrase] = ["orange", oranges[0].phrase];
  else if (inconnues.length > 0) [feu, phrase] = ["orange", phraseInconnu];
  else if (manquantes.length > 0) [feu, phrase] = ["gris", phraseManque];
  else if (verts.length > 0 || essentielles.some((a) => a.etat === "repondue")) [feu, phrase] = ["vert", verts[0]?.phrase ?? d.phraseSansAlerte];
  else [feu, phrase] = ["gris", "Pas encore assez d'éléments pour juger : on y reviendra quand tu auras répondu au reste."];
  return { dimension: d.cle, libelle: d.libelle, feu, phrase, points, manques: manquantes, inconnus: inconnues };
}

/**
 * Le point de faisabilité : un feu et une phrase par dimension (terre, eau, travail, argent, marché, savoir-faire, règles).
 * Un rouge ou un orange connu pèse même si d'autres réponses manquent ; le vert exige que l'essentiel soit répondu.
 */
export function pointDeFaisabilite(entretien: Entretien, e: EtatEntretien): PointFaisabilite {
  const plates = valeursPlates(e);
  const applicables = questionsApplicables(entretien, e);
  const dimensions = entretien.dimensions.map((d) => pointDimension(d, applicables, plates));
  const essentielles = applicables.filter((a) => a.question.essentielle && a.question.dimension !== null);
  return {
    dimensions,
    feuGlobal: pire(dimensions.map((d) => d.feu)),
    essentielles: { traitees: essentielles.filter((a) => a.etat === "repondue" || a.etat === "inconnue").length, total: essentielles.length },
    aValider: entretien.aValider,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Réponses : validation puis enregistrement dans le profil ou le contexte, selon ce que la question remplit
// ---------------------------------------------------------------------------------------------------------------

/** Une réponse : une valeur, ou « je ne sais pas ». */
export const schemaReponseEntretien = z.union([
  z.object({ question: z.string().min(1), neSaitPas: z.literal(true) }).strict(),
  z.object({ question: z.string().min(1), valeur: z.unknown() }).strict(),
]);
export type ReponseEntretien = z.input<typeof schemaReponseEntretien>;
export const schemaReponsesEntretien = z.object({ reponses: z.array(schemaReponseEntretien).min(1).max(30) }).strict();

function erreurReponse(q: QuestionEntretien, message: string): ErreurPlan {
  return new ErreurPlan(`Réponse refusée pour « ${q.libelle} » : ${message}`, "invalide");
}

/** Valide une valeur selon le type de la question (et ses réponses permises). Renvoie la valeur propre. */
export function validerValeur(q: QuestionEntretien, valeur: unknown): unknown {
  const permises = q.reponses.map((r) => r.valeur);
  const lire = <S extends z.ZodType>(schema: S): z.output<S> => {
    const r = schema.safeParse(valeur);
    if (!r.success) throw erreurReponse(q, r.error.issues.map((i) => i.message).join(" ; "));
    return r.data;
  };
  switch (q.type) {
    case "choix":
      return lire(z.string().refine((v) => permises.includes(v), { message: `choisis parmi : ${permises.join(", ")}` }));
    case "choix_multiple":
      return lire(z.array(z.string().refine((v) => permises.includes(v), { message: `choisis parmi : ${permises.join(", ")}` })).min(1));
    case "nombre":
    case "montant":
      return lire(z.number().min(0, "un nombre ne peut pas être négatif"));
    case "oui_non":
      return lire(z.boolean());
    case "texte":
      return lire(z.string().trim().min(1).max(200));
    case "liste":
      return q.remplit.cible === "credits" ? lire(z.array(schemaCreditEnCours).max(20)) : lire(z.array(schemaLigneExistant).max(60));
  }
}

/**
 * Traduit une réponse en changement du profil, et éventuellement du contexte terrain.
 * Pur : sert à l'enregistrement et aux tests.
 */
export function traduireReponse(
  q: QuestionEntretien,
  reponse: ReponseEntretien,
): { profil?: ModificationProfil; contexte?: { cle: string; valeur: string }[] } {
  const neSaitPas = "neSaitPas" in reponse;
  const valeur = neSaitPas ? null : validerValeur(q, (reponse as { valeur: unknown }).valeur);
  const { cible, champ, aussi } = q.remplit;
  if (cible === "contexte") {
    const texte = valeur === null ? VALEUR_INCONNUE : Array.isArray(valeur) ? valeur.join(",") : String(valeur);
    if (texte.length > 200) throw erreurReponse(q, "la réponse est trop longue (200 caractères au plus).");
    return { contexte: [{ cle: champ, valeur: texte }] };
  }
  const cle = cible === "profil" ? champ : cible; // « existant » et « credits » sont aussi des clés de la modification du profil
  const profil = { [cle]: valeur } as ModificationProfil;
  const copie = aussi && typeof valeur === "string" && aussi.correspondance[valeur] ? [{ cle: aussi.champ, valeur: aussi.correspondance[valeur] }] : [];
  return { profil, ...(copie.length > 0 ? { contexte: copie } : {}) };
}

/** Enregistre des réponses (avec les droits de l'utilisateur) puis renvoie l'état à jour. Tout est validé avant la première écriture. */
export async function enregistrerReponses(
  client: ClientBase,
  exploitationId: string,
  entretien: Entretien,
  entree: z.input<typeof schemaReponsesEntretien>,
): Promise<EtatEntretien> {
  const { reponses } = verifier(schemaReponsesEntretien, entree);
  const traduites = reponses.map((r) => {
    const q = entretien.questions.find((x) => x.cle === r.question);
    if (!q) throw new ErreurPlan(`Question inconnue : ${r.question}.`, "invalide");
    return traduireReponse(q, r);
  });
  // Fusion des changements du profil en un seul enregistrement (une seule vérification de cohérence).
  const profil = Object.assign({}, ...traduites.map((t) => t.profil ?? {})) as ModificationProfil;
  verifier(schemaModificationProfil, profil);
  if (Object.keys(profil).length > 0) await ecrireProfil(client, exploitationId, profil);
  for (const t of traduites) for (const c of t.contexte ?? []) await repondreTerrain(client, exploitationId, c);
  return chargerEtat(client, exploitationId);
}

// ---------------------------------------------------------------------------------------------------------------
// Pour l'interface : toutes les questions qui s'appliquent, avec leur état et la réponse actuelle
// ---------------------------------------------------------------------------------------------------------------

export interface QuestionAffichee {
  cle: string;
  temps: string;
  tempsTitre: string;
  libelle: string;
  aide: string | null;
  type: QuestionEntretien["type"];
  unite: string | null;
  reponses: QuestionEntretien["reponses"];
  /** Où va la réponse : le profil, le contexte terrain, ou une des deux listes (existant, crédits). */
  cible: QuestionEntretien["remplit"]["cible"];
  champ: string;
  /** Réponse déjà donnée : valeur, liste (existant, crédits, choix multiple) ou null ; « je ne sais pas » se lit dans `etat`. */
  valeur: unknown;
  etat: Exclude<EtatQuestion, "masquee">;
}

/** Réponse actuelle d'une question, dans la forme que l'interface renvoie à l'enregistrement. */
export function valeurActuelle(q: QuestionEntretien, e: EtatEntretien): unknown {
  const { cible, champ } = q.remplit;
  if (cible === "existant") return e.profil.existant.map(({ id: _i, ...reste }) => (void _i, reste));
  if (cible === "credits") return e.profil.credits.map(({ id: _i, ...reste }) => (void _i, reste));
  if (cible === "profil") return e.profil.valeurs[champ as ChampProfil] ?? null;
  const texte = e.contexte[champ];
  if (texte === undefined || texte === VALEUR_INCONNUE) return null;
  if (q.type === "choix_multiple") return texte.split(",");
  if (q.type === "oui_non") return texte === "true";
  return texte;
}

/** Toutes les questions qui s'appliquent à ce porteur, dans l'ordre de la consultation. */
export function questionsAffichees(entretien: Entretien, e: EtatEntretien): QuestionAffichee[] {
  return questionsApplicables(entretien, e).map(({ question: q, etat }) => ({
    cle: q.cle,
    temps: q.temps,
    tempsTitre: entretien.temps.find((t) => t.cle === q.temps)?.titre ?? q.temps,
    libelle: q.libelle,
    aide: q.aide,
    type: q.type,
    unite: q.unite,
    reponses: q.reponses,
    cible: q.remplit.cible,
    champ: q.remplit.champ,
    valeur: etat === "repondue" ? valeurActuelle(q, e) : null,
    etat,
  }));
}

/** Lit le profil, le contexte et les secteurs des ateliers d'une exploitation. */
export async function chargerEtat(client: ClientBase, exploitationId: string, options: { secteurs?: string[]; reportees?: string[] } = {}): Promise<EtatEntretien> {
  const [profil, exploitation] = await Promise.all([lireProfil(client, exploitationId, { tolerant: true }), lireExploitation(client, exploitationId)]);
  let secteurs = options.secteurs;
  if (!secteurs && exploitation.ateliers.length > 0) {
    const codes = [...new Set(exploitation.ateliers.map((a) => a.speculationCode))];
    secteurs = [...new Set((await lireSpeculations(client, { codes })).map((s) => s.secteur))];
  }
  return { profil, contexte: exploitation.contexte, secteurs, reportees: options.reportees };
}

/** Prochaine question et point de faisabilité d'une exploitation (route GET et outils de Cultisia). */
export async function consulterEntretien(client: ClientBase, exploitationId: string, options: { secteurs?: string[]; reportees?: string[] } = {}) {
  const [entretien, etat] = await Promise.all([lireEntretien(client), chargerEtat(client, exploitationId, options)]);
  return { prochaine: prochaineQuestion(entretien, etat), manques: manques(entretien, etat), point: pointDeFaisabilite(entretien, etat), questions: questionsAffichees(entretien, etat) };
}
