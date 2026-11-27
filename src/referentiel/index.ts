// Lecture du référentiel agricole (schéma ref) : spéculations, modèles de charges et de revenus,
// questions de terrain, règles d'ajustement. Lecture seule ; l'écriture passe par le serveur.
// Chaque ligne lue est validée par le schéma du moteur qui la consommera : une donnée incohérente
// en base est signalée ici, pas au milieu d'un calcul.
import { z } from "zod";
import type { Atelier, ClientBase } from "@/core/exploitation";
import type { Database } from "@/types/supabase";
import {
  schemaModeleCharge,
  schemaModeleRevenu,
  schemaRegle,
  type EntreeBudget,
  type ModeleCharge,
  type ModeleRevenu,
  type RegleAjustement,
} from "@/moteurs/budget";
import type { RegleFinanceur } from "@/moteurs/controles";
import { construireEntretien, type Entretien, type LignesEntretien } from "./entretien";

export * from "./entretien";

export type StatutDonnee = "brouillon_ia" | "a_valider" | "validee";

export interface Speculation {
  code: string;
  nom: string;
  secteur: "vegetal" | "animal" | "halieutique" | "transformation" | "services";
  sousSecteur: string | null;
  uniteEchelle: string;
  dureeCycleJours: number | null;
  cyclesParAn: number;
  zones: string[];
  statut: StatutDonnee;
  source: string | null;
}

export interface QuestionTerrain {
  cle: string;
  libelle: string;
  sousTitre: string | null;
  reponses: { valeur: string; libelle: string }[];
  secteurs: string[];
  ordre: number;
  statut: StatutDonnee;
}

/** Donnée du référentiel absente ou incohérente. */
export class ErreurReferentiel extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurReferentiel";
  }
}

const schemaSpeculation = z.object({
  code: z.string(),
  nom: z.string(),
  secteur: z.enum(["vegetal", "animal", "halieutique", "transformation", "services"]),
  sousSecteur: z.string().nullable(),
  uniteEchelle: z.string(),
  dureeCycleJours: z.number().nullable(),
  cyclesParAn: z.number().positive(),
  zones: z.array(z.string()),
  statut: z.enum(["brouillon_ia", "a_valider", "validee"]),
  source: z.string().nullable(),
});

const schemaQuestion = z.object({
  cle: z.string(),
  libelle: z.string(),
  sousTitre: z.string().nullable(),
  reponses: z.array(z.object({ valeur: z.string().min(1), libelle: z.string().min(1) })),
  secteurs: z.array(z.string()),
  ordre: z.number(),
  statut: z.enum(["brouillon_ia", "a_valider", "validee"]),
});

function conforme<S extends z.ZodType>(schema: S, donnee: unknown, quoi: string): z.output<S> {
  const r = schema.safeParse(donnee);
  if (!r.success) {
    const details = r.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ");
    throw new ErreurReferentiel(`Donnée du référentiel incohérente (${quoi}) : ${details}`);
  }
  return r.data;
}

function echec(quoi: string, error: { message: string }): never {
  throw new ErreurReferentiel(`Lecture du référentiel impossible (${quoi}) : ${error.message}`);
}

const ref = (client: ClientBase) => client.schema("ref");

type Tables = Database["ref"]["Tables"];
type LigneCharge = Pick<Tables["modeles_charges"]["Row"], "id" | "speculation_code" | "type_charge" | "libelle" | "unite" | "quantite" | "prix_reference" | "produit_prix" | "frequence" | "base" | "nature" | "classe" | "duree_vie_ans" | "mois_decaissement" | "statut">;
type LigneRevenu = Pick<Tables["modeles_revenus"]["Row"], "id" | "speculation_code" | "type_revenu" | "libelle" | "unite" | "quantite_pessimiste" | "quantite_realiste" | "quantite_optimiste" | "pertes" | "prix_reference" | "produit_prix" | "base" | "mois_vente" | "statut">;
type LigneRegle = Pick<Tables["regles_ajustement"]["Row"], "id" | "cle_question" | "valeur" | "speculation_code" | "effet" | "cible_sens" | "cible_type" | "cible_modele_id" | "coefficient" | "statut"> & { ligne: unknown };

/** Ligne de ref.modeles_charges → modèle du moteur de budget (validé). */
export function versModeleCharge(c: LigneCharge): ModeleCharge {
  return conforme(
    schemaModeleCharge,
    {
      id: c.id,
      speculationCode: c.speculation_code,
      typeCharge: c.type_charge,
      libelle: c.libelle,
      unite: c.unite,
      quantite: Number(c.quantite),
      prixReference: Number(c.prix_reference),
      produitPrix: c.produit_prix ?? undefined,
      frequence: Number(c.frequence),
      base: c.base,
      nature: c.nature,
      classe: c.classe,
      dureeVieAns: c.duree_vie_ans === null ? undefined : Number(c.duree_vie_ans),
      moisDecaissement: c.mois_decaissement ?? undefined,
      statut: c.statut,
    },
    `charge « ${c.libelle} »`,
  );
}

/** Ligne de ref.modeles_revenus → modèle du moteur de budget (validé). */
export function versModeleRevenu(r: LigneRevenu): ModeleRevenu {
  return conforme(
    schemaModeleRevenu,
    {
      id: r.id,
      speculationCode: r.speculation_code,
      typeRevenu: r.type_revenu,
      libelle: r.libelle,
      unite: r.unite,
      quantite: {
        pessimiste: Number(r.quantite_pessimiste),
        realiste: Number(r.quantite_realiste),
        optimiste: Number(r.quantite_optimiste),
      },
      pertes: Number(r.pertes),
      prixReference: Number(r.prix_reference),
      produitPrix: r.produit_prix ?? undefined,
      base: r.base,
      moisVente: r.mois_vente ?? undefined,
      statut: r.statut,
    },
    `revenu « ${r.libelle} »`,
  );
}

/** Ligne de ref.regles_ajustement → règle du moteur de budget (validée). */
export function versRegle(r: LigneRegle): RegleAjustement {
  return conforme(
    schemaRegle,
    {
      id: r.id,
      cleQuestion: r.cle_question,
      valeur: r.valeur,
      speculationCode: r.speculation_code ?? undefined,
      effet: r.effet,
      cible: r.cible_sens
        ? { sens: r.cible_sens, type: r.cible_type ?? undefined, modeleId: r.cible_modele_id ?? undefined }
        : undefined,
      coefficient: r.coefficient === null ? undefined : Number(r.coefficient),
      ligne: r.ligne ?? undefined,
      statut: r.statut,
    },
    `règle ${r.id}`,
  );
}

export async function lireSpeculations(
  client: ClientBase,
  filtres: { codes?: string[]; secteur?: Speculation["secteur"] } = {},
): Promise<Speculation[]> {
  let requete = ref(client).from("speculations").select("*").order("nom");
  if (filtres.codes) requete = requete.in("code", filtres.codes);
  if (filtres.secteur) requete = requete.eq("secteur", filtres.secteur);
  const { data, error } = await requete;
  if (error) echec("spéculations", error);
  return data.map((s) =>
    conforme(
      schemaSpeculation,
      {
        code: s.code,
        nom: s.nom,
        secteur: s.secteur,
        sousSecteur: s.sous_secteur,
        uniteEchelle: s.unite_echelle,
        dureeCycleJours: s.duree_cycle_jours,
        cyclesParAn: Number(s.cycles_par_an),
        zones: s.zones,
        statut: s.statut,
        source: s.source,
      },
      `spéculation ${s.code}`,
    ),
  );
}

export async function lireModeles(
  client: ClientBase,
  codes: string[],
): Promise<{ modelesCharges: ModeleCharge[]; modelesRevenus: ModeleRevenu[] }> {
  const [charges, revenus] = await Promise.all([
    ref(client).from("modeles_charges").select("*").in("speculation_code", codes).order("ordre"),
    ref(client).from("modeles_revenus").select("*").in("speculation_code", codes).order("ordre"),
  ]);
  if (charges.error) echec("modèles de charges", charges.error);
  if (revenus.error) echec("modèles de revenus", revenus.error);
  const bornes = await lireBornesRendement(client, revenus.data.map((r) => r.id));
  return {
    modelesCharges: charges.data.map(versModeleCharge),
    modelesRevenus: revenus.data.map((r) => {
      const modele = versModeleRevenu(r);
      const b = bornes.get(r.id);
      return b ? { ...modele, bornes: b } : modele;
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// R10 : bornes de rendement par modèle de revenu. Aucune valeur n'est écrite ici : tout vient de ref.bornes_rendement.
// ---------------------------------------------------------------------------------------------

export type BornesRendement = NonNullable<ModeleRevenu["bornes"]>;

const schemaBornes = z.object({
  min: z.number().min(0).optional(),
  typique: z.number().min(0).optional(),
  max: z.number().min(0).optional(),
  source: z.string().min(1),
  dateSource: z.string().min(1),
  statut: z.enum(["brouillon_ia", "a_valider", "validee"]),
});

/** Ligne de ref.bornes_rendement → bornes du moteur de budget (validées). */
export function versBornes(b: Tables["bornes_rendement"]["Row"]): BornesRendement {
  return conforme(
    schemaBornes,
    {
      ...(b.min_par_unite === null ? {} : { min: Number(b.min_par_unite) }),
      ...(b.typique_par_unite === null ? {} : { typique: Number(b.typique_par_unite) }),
      ...(b.max_par_unite === null ? {} : { max: Number(b.max_par_unite) }),
      source: b.source,
      dateSource: b.date_source,
      statut: b.statut,
    },
    `bornes de rendement ${b.modele_revenu_id}`,
  );
}

/** Bornes de rendement des modèles de revenu donnés, par identifiant de modèle. */
export async function lireBornesRendement(client: ClientBase, modelesRevenuIds: string[]): Promise<Map<string, BornesRendement>> {
  if (modelesRevenuIds.length === 0) return new Map();
  const { data, error } = await ref(client).from("bornes_rendement").select("*").in("modele_revenu_id", modelesRevenuIds);
  if (error) echec("bornes de rendement", error);
  return new Map(data.map((b) => [b.modele_revenu_id, versBornes(b)]));
}

/** Questions de terrain, dans l'ordre ; avec un secteur, seulement celles qui le concernent (ou tous les secteurs). */
export async function lireQuestionsTerrain(client: ClientBase, secteurs?: string[]): Promise<QuestionTerrain[]> {
  const { data, error } = await ref(client).from("questions_terrain").select("*").order("ordre");
  if (error) echec("questions de terrain", error);
  return data
    .map((q) =>
      conforme(
        schemaQuestion,
        {
          cle: q.cle,
          libelle: q.libelle,
          sousTitre: q.sous_titre,
          reponses: q.reponses,
          secteurs: q.secteurs,
          ordre: q.ordre,
          statut: q.statut,
        },
        `question ${q.cle}`,
      ),
    )
    .filter((q) => !secteurs || q.secteurs.length === 0 || q.secteurs.some((s) => secteurs.includes(s)));
}

/** Règles applicables à ces spéculations (règles générales comprises). */
export async function lireRegles(client: ClientBase, codes: string[]): Promise<RegleAjustement[]> {
  const { data, error } = await ref(client).from("regles_ajustement").select("*");
  if (error) echec("règles d'ajustement", error);
  return data
    .filter((r) => r.speculation_code === null || codes.includes(r.speculation_code))
    .map(versRegle);
}

/**
 * Prépare l'entrée du générateur de budget pour les ateliers et le contexte terrain d'une exploitation.
 * Les prix du marché sont ajoutés par l'appelant (étape du plan persistant).
 */
export async function preparerBudget(
  client: ClientBase,
  exploitation: { ateliers: Pick<Atelier, "id" | "speculationCode" | "taille">[]; contexte: Record<string, string> },
): Promise<EntreeBudget> {
  if (exploitation.ateliers.length === 0) throw new ErreurReferentiel("Ajoute au moins un atelier avant de générer le budget.");
  const codes = [...new Set(exploitation.ateliers.map((a) => a.speculationCode))];
  const [speculations, modeles, regles] = await Promise.all([
    lireSpeculations(client, { codes }),
    lireModeles(client, codes),
    lireRegles(client, codes),
  ]);
  const cycles = new Map(speculations.map((s) => [s.code, s.cyclesParAn]));
  return {
    ateliers: exploitation.ateliers.map((a) => {
      const cyclesParAn = cycles.get(a.speculationCode);
      if (cyclesParAn === undefined) throw new ErreurReferentiel(`Spéculation inconnue du référentiel : ${a.speculationCode}.`);
      return { atelierId: a.id, speculationCode: a.speculationCode, taille: a.taille, cyclesParAn };
    }),
    ...modeles,
    contexte: exploitation.contexte,
    regles,
    prix: [],
  };
}

// ---------------------------------------------------------------------------------------------
// R11 : règles des financeurs (ANPGF, banques, IMF...). Aucune valeur n'est écrite ici : tout vient de ref.regles_financeurs.
// ---------------------------------------------------------------------------------------------

export interface RegleFinanceurRef {
  id: string;
  organisme: string;
  produit: string;
  libelle: string;
  pays: string | null;
  /** Part minimale de l'apport dans le coût du projet (0,2 = 20 %). null : règle inconnue. */
  apportMinimum: number | null;
  /** Durée maximale du financement, différé compris, en mois. */
  dureeMaxMois: number | null;
  /** Le maximum de durée compte-t-il le différé ? */
  dureeInclutDiffere: boolean;
  differeMaxMois: number | null;
  /** Taux annuel indicatif (0,24 = 24 %) : le taux réel est fixé par le financeur. */
  tauxIndicatif: number | null;
  taxes: { nom: string; description: string | null }[];
  piecesExigees: string[];
  formatDossier: string | null;
  notes: string | null;
  statut: StatutDonnee;
  source: string | null;
}

const statutDonnee = z.enum(["brouillon_ia", "a_valider", "validee"]);
const schemaRegleFinanceurRef = z.object({
  id: z.string(),
  organisme: z.string().min(1),
  produit: z.string().min(1),
  libelle: z.string(),
  pays: z.string().nullable(),
  apportMinimum: z.number().min(0).max(1).nullable(),
  dureeMaxMois: z.number().int().positive().nullable(),
  dureeInclutDiffere: z.boolean(),
  differeMaxMois: z.number().int().min(0).nullable(),
  tauxIndicatif: z.number().min(0).max(1).nullable(),
  taxes: z.array(z.object({ nom: z.string().min(1), description: z.string().nullable().default(null) })),
  piecesExigees: z.array(z.string()),
  formatDossier: z.string().nullable(),
  notes: z.string().nullable(),
  statut: statutDonnee,
  source: z.string().nullable(),
});

const nombreOuNull = (x: number | string | null) => (x === null ? null : Number(x));

/** Ligne de ref.regles_financeurs → règle validée. */
export function versRegleFinanceur(r: Tables["regles_financeurs"]["Row"]): RegleFinanceurRef {
  return conforme(
    schemaRegleFinanceurRef,
    {
      id: r.id,
      organisme: r.organisme,
      produit: r.produit,
      libelle: r.libelle,
      pays: r.pays,
      apportMinimum: nombreOuNull(r.apport_minimum),
      dureeMaxMois: r.duree_max_mois,
      dureeInclutDiffere: r.duree_inclut_differe,
      differeMaxMois: r.differe_max_mois,
      tauxIndicatif: nombreOuNull(r.taux_indicatif),
      taxes: r.taxes,
      piecesExigees: r.pieces_exigees,
      formatDossier: r.format_dossier,
      notes: r.notes,
      statut: r.statut,
      source: r.source,
    },
    `financeur ${r.organisme} / ${r.produit}`,
  );
}

/** Règles des financeurs, par organisme puis par produit. Filtres : organisme (sans tenir compte de la casse), produit, pays. */
export async function lireReglesFinanceurs(
  client: ClientBase,
  filtres: { organisme?: string; produit?: string; pays?: string } = {},
): Promise<RegleFinanceurRef[]> {
  let requete = ref(client).from("regles_financeurs").select("*").order("organisme").order("produit");
  if (filtres.organisme) requete = requete.ilike("organisme", filtres.organisme.replace(/[%_]/g, "\$&"));
  if (filtres.produit) requete = requete.eq("produit", filtres.produit);
  if (filtres.pays) requete = requete.eq("pays", filtres.pays);
  const { data, error } = await requete;
  if (error) echec("règles des financeurs", error);
  return data.map(versRegleFinanceur);
}

/** Règle au format attendu par les contrôles du moteur financier (M4). Une règle inconnue (null) reste absente : elle n'est pas contrôlée. */
export function versRegleMoteur(r: RegleFinanceurRef): RegleFinanceur {
  return {
    nom: r.organisme,
    ...(r.apportMinimum !== null ? { apportMinimum: r.apportMinimum } : {}),
    ...(r.dureeMaxMois !== null ? { dureeMaxMois: r.dureeMaxMois, dureeInclutDiffere: r.dureeInclutDiffere } : {}),
    ...(r.differeMaxMois !== null ? { differeMaxMois: r.differeMaxMois } : {}),
    ...(r.source ? { source: r.source } : {}),
    statut: r.statut,
  };
}

/**
 * Service : la règle d'un financeur pour les contrôles. Sans `produit`, il faut que l'organisme n'en ait qu'un seul ;
 * sinon l'appelant doit préciser lequel (ErreurReferentiel avec la liste). Renvoie null si l'organisme est inconnu.
 */
export async function trouverRegleFinanceur(
  client: ClientBase,
  organisme: string,
  produit?: string,
): Promise<RegleFinanceurRef | null> {
  const regles = await lireReglesFinanceurs(client, { organisme, produit });
  if (regles.length === 0) return null;
  if (regles.length > 1) {
    throw new ErreurReferentiel(`${organisme} a plusieurs produits (${regles.map((r) => r.produit).join(", ")}) : précise lequel.`);
  }
  return regles[0];
}

/** Entretien de cadrage (S3) : temps, dimensions de faisabilité et questions, avec les questions de terrain placées. */
export async function lireEntretien(client: ClientBase): Promise<Entretien> {
  const [temps, dimensions, questions, terrain] = await Promise.all([
    ref(client).from("entretien_temps").select("*").order("ordre"),
    ref(client).from("entretien_dimensions").select("*").order("ordre"),
    ref(client).from("entretien_questions").select("*").order("ordre"),
    lireQuestionsTerrain(client),
  ]);
  if (temps.error) echec("temps de l'entretien", temps.error);
  if (dimensions.error) echec("dimensions de l'entretien", dimensions.error);
  if (questions.error) echec("questions de l'entretien", questions.error);
  try {
    return construireEntretien(
      { temps: temps.data, dimensions: dimensions.data, questions: questions.data } satisfies LignesEntretien,
      terrain.map((q) => ({ cle: q.cle, libelle: q.libelle, sousTitre: q.sousTitre, reponses: q.reponses, secteurs: q.secteurs })),
    );
  } catch (erreur) {
    throw new ErreurReferentiel(`entretien de cadrage incohérent : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
  }
}
