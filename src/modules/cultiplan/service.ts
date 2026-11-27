// Service du plan persistant de Cultiplan : générer un plan depuis une exploitation, le lire, corriger ses lignes,
// changer ses hypothèses, le recalculer, le dupliquer (« Et si ? »).
// Toujours appelé avec le client Supabase de l'utilisateur (son jeton) : les droits de la base s'appliquent.
// Les résultats sont TOUJOURS ceux du moteur (src/moteurs/), recalculés après chaque changement, jamais saisis.
import { z } from "zod";
import { lireExploitation, type ClientBase } from "@/core/exploitation";
import { calculerFinances, ErreurMoteur, genererBudget, VERSION_MOTEURS, type EntreeBudget, type ResultatFinance } from "@/moteurs";
import { schemaCredit } from "@/moteurs/credit";
import { HORIZON_PAR_DEFAUT, schemaEcartsScenarios, schemaFinance, TAUX_ACTUALISATION_PAR_DEFAUT, type EntreeFinance, type LigneCharge, type LigneRevenu } from "@/moteurs/finance";
import { preparerBudget } from "@/referentiel";
import type { Database, Json } from "@/types/supabase";
import { erreurBase, ErreurPlan } from "./erreurs";
import {
  appliquerCorrection,
  depuisBudget,
  depuisSaisie,
  verifier,
  versJson,
  versLigne,
  versMoteur,
  type Auteur,
  type CorrectionLigne,
  type LignePlan,
  type NouvelleLigne,
} from "./lignes";
import { deduireDuProfil, lireProfil } from "./profil";
import { injecterPrix, lireRelevesRecents, produitsDesignes } from "./prix";

export const STATUTS_PLAN = ["brouillon", "lance", "archive"] as const;
export type StatutPlan = (typeof STATUTS_PLAN)[number];

const champsHypotheses = {
  horizonAnnees: z.number().int().min(1, "au moins 1 an").max(5, "au plus 5 ans"),
  tauxActualisation: z.number().min(0).max(1),
  hausseCharges: z.number().min(-0.5).max(1),
  haussePrix: z.number().min(-0.5).max(1),
  // Ménage (M3) : null = coût de vie non renseigné, le revenu du ménage n'est alors pas évalué.
  prelevementsAnnuels: z.number().min(0, "le coût de vie ne peut pas être négatif").nullable(),
  revenusExterieursAnnuels: z.number().min(0),
  salairesAnnuels: z.number().min(0),
  impotsAnnuels: z.number().min(0),
  // Sensibilité (M5) : écarts de prix et de charges des scénarios pessimiste et optimiste, baisse du test du prix bas (null = automatique).
  ecartsScenarios: schemaEcartsScenarios,
  baissePrixBas: z.number().min(-0.9).max(0).nullable(),
};
export const schemaHypotheses = z.object({
  horizonAnnees: champsHypotheses.horizonAnnees.default(HORIZON_PAR_DEFAUT),
  tauxActualisation: champsHypotheses.tauxActualisation.default(TAUX_ACTUALISATION_PAR_DEFAUT),
  hausseCharges: champsHypotheses.hausseCharges.default(0),
  haussePrix: champsHypotheses.haussePrix.default(0),
  prelevementsAnnuels: champsHypotheses.prelevementsAnnuels.default(null),
  revenusExterieursAnnuels: champsHypotheses.revenusExterieursAnnuels.default(0),
  salairesAnnuels: champsHypotheses.salairesAnnuels.default(0),
  impotsAnnuels: champsHypotheses.impotsAnnuels.default(0),
  ecartsScenarios: champsHypotheses.ecartsScenarios.prefault({}),
  baissePrixBas: champsHypotheses.baissePrixBas.default(null),
});
export type Hypotheses = z.output<typeof schemaHypotheses>;

const champsFinancement = {
  apport: z.number().min(0, "l'apport ne peut pas être négatif"),
  /** Entrée du moteur de crédit ; null = pas de crédit. */
  credit: schemaCredit.nullable(),
  /** Règle du financeur visé (R11) pour les contrôles M4, par exemple { nom: "ANPGF", apportMinimum: 0.2 } ; null = aucune. */
  regleFinanceur: schemaFinance.shape.regleFinanceur.unwrap().nullable(),
};
export const schemaFinancement = z.object({
  apport: champsFinancement.apport.default(0),
  credit: champsFinancement.credit.default(null),
  regleFinanceur: champsFinancement.regleFinanceur.default(null),
});
export type Financement = z.output<typeof schemaFinancement>;

// Changements partiels : SANS valeur par défaut, pour qu'un champ absent garde sa valeur enregistrée.
const hypothesesPartielles = z.object(champsHypotheses).partial().strict();
const financementPartiel = z.object(champsFinancement).partial().strict();

export const schemaGeneration = z.object({
  titre: z.string().trim().min(2).max(120).optional(),
  hypotheses: hypothesesPartielles.optional(),
  financement: financementPartiel.optional(),
});

export const schemaModificationPlan = z
  .object({
    titre: z.string().trim().min(2).max(120),
    statut: z.enum(STATUTS_PLAN),
    hypotheses: hypothesesPartielles,
    financement: financementPartiel,
  })
  .partial()
  .strict()
  .refine((m) => Object.keys(m).length > 0, { message: "aucune modification fournie" });

export interface InfosGeneration {
  /** Ateliers dont la spéculation n'a aucun modèle dans le référentiel. */
  ateliersSansModele: string[];
  /** Prix du marché qui ont remplacé une référence. */
  prixMarche: { produit: string; prix: number; source: string; date: string }[];
  /** Origine des valeurs reprises du profil du porteur (coût de vie, revenus extérieurs, apport). */
  origineProfil?: string[];
}

export interface ResumePlan {
  id: string;
  exploitationId: string;
  titre: string;
  version: number;
  varianteDe: string | null;
  statut: StatutPlan;
  versionMoteur: string | null;
  calculeLe: string | null;
  majLe: string;
}

export interface Plan extends ResumePlan {
  hypotheses: Hypotheses;
  financement: Financement;
  resultats: ResultatFinance | null;
  generation: InfosGeneration;
  lignes: LignePlan[];
}

export interface OptionsService {
  /** Date du jour (pour l'ancienneté des prix) ; injectable dans les tests. */
  aujourdhui?: Date;
}

type RangeePlan = Database["public"]["Tables"]["plans"]["Row"];

const COLONNES_RESUME = "id, cultiso_id, titre, version, variante_de, statut, version_moteur, calcule_le, updated_at";

const versResume = (p: Pick<RangeePlan, "id" | "cultiso_id" | "titre" | "version" | "variante_de" | "statut" | "version_moteur" | "calcule_le" | "updated_at">): ResumePlan => ({
  id: p.id,
  exploitationId: p.cultiso_id,
  titre: p.titre,
  version: p.version,
  varianteDe: p.variante_de,
  statut: p.statut as StatutPlan,
  versionMoteur: p.version_moteur,
  calculeLe: p.calcule_le,
  majLe: p.updated_at,
});

function versPlan(p: RangeePlan, lignes: LignePlan[]): Plan {
  const generation = (p.generation ?? {}) as Partial<InfosGeneration>;
  return {
    ...versResume(p),
    hypotheses: schemaHypotheses.parse(p.hypotheses ?? {}),
    financement: schemaFinancement.parse(p.financement ?? {}),
    resultats: (p.resultats ?? null) as unknown as ResultatFinance | null,
    generation: { ateliersSansModele: generation.ateliersSansModele ?? [], prixMarche: generation.prixMarche ?? [], origineProfil: generation.origineProfil ?? [] },
    lignes,
  };
}

/**
 * Entrée du générateur de budget pour des ateliers et un contexte terrain : référentiel (preparerBudget)
 * puis prix du marché récents dans la même unité. Utilisée par le plan et par les outils de calcul de Cultisia.
 */
export async function preparerEntreeBudget(
  client: ClientBase,
  exploitation: Parameters<typeof preparerBudget>[1],
  { aujourdhui = new Date() }: OptionsService = {},
): Promise<EntreeBudget> {
  const entree = await preparerBudget(client, exploitation);
  const releves = await lireRelevesRecents(client, produitsDesignes(entree), aujourdhui);
  return injecterPrix(entree, releves);
}

function exigerBrouillon(plan: Pick<ResumePlan, "statut">): void {
  if (plan.statut !== "brouillon") {
    throw new ErreurPlan("Ce plan est figé (lancé ou archivé). Duplique-le pour tester une variante.", "fige");
  }
}

/** Génère un plan depuis les ateliers et le contexte terrain d'une exploitation, l'enregistre et le calcule. */
export async function genererPlan(
  client: ClientBase,
  exploitationId: string,
  entree: z.input<typeof schemaGeneration> = {},
  options: OptionsService = {},
): Promise<Plan> {
  const g = verifier(schemaGeneration, entree);
  const exploitation = await lireExploitation(client, exploitationId);
  if (exploitation.ateliers.length === 0) {
    throw new ErreurPlan("Ajoute au moins un atelier avant de générer le plan.", "invalide");
  }
  const entreeBudget = await preparerEntreeBudget(client, exploitation, options);
  const budget = genererBudget(entreeBudget);
  // Profil du porteur (R9) : coût de vie, revenus extérieurs et apport déclarés alimentent M3, M4 et R11.
  // Ce que la demande précise elle-même l'emporte sur le profil.
  const deduit = deduireDuProfil(await lireProfil(client, exploitationId, { tolerant: true }));

  const { data: plan, error } = await client
    .from("plans")
    .insert({
      cultiso_id: exploitationId,
      titre: g.titre ?? `Plan de ${exploitation.nom}`,
      hypotheses: versJson(schemaHypotheses.parse({ ...deduit.hypotheses, ...g.hypotheses })),
      financement: versJson(schemaFinancement.parse({ ...deduit.financement, ...g.financement })),
      generation: versJson({
        ateliersSansModele: budget.ateliersSansModele,
        origineProfil: deduit.origines,
        prixMarche: (entreeBudget.prix ?? []).map((p) => ({ produit: p.produitId.split("|")[0], prix: p.prix, source: p.source, date: p.date })),
      } satisfies InfosGeneration),
    })
    .select("id")
    .single();
  if (error) throw erreurBase(error);

  const lignes = [...budget.charges, ...budget.revenus].map((l, i) => depuisBudget(plan.id, l, budget.journal, i));
  if (lignes.length > 0) {
    const insertion = await client.from("plan_lignes").insert(lignes, { defaultToNull: false });
    if (insertion.error) {
      await client.from("plans").delete().eq("id", plan.id);
      throw erreurBase(insertion.error);
    }
  }
  return recalculer(client, plan.id, { premierCalcul: true });
}

export async function listerPlans(client: ClientBase, exploitationId: string): Promise<ResumePlan[]> {
  const { data, error } = await client
    .from("plans")
    .select(COLONNES_RESUME)
    .eq("cultiso_id", exploitationId)
    .order("created_at", { ascending: false });
  if (error) throw erreurBase(error);
  return data.map(versResume);
}

export async function lirePlan(client: ClientBase, planId: string): Promise<Plan> {
  const [plan, lignes] = await Promise.all([
    client.from("plans").select("*").eq("id", planId).maybeSingle(),
    client.from("plan_lignes").select("*").eq("plan_id", planId).order("ordre").order("created_at"),
  ]);
  if (plan.error) throw erreurBase(plan.error);
  if (!plan.data) throw new ErreurPlan("Plan introuvable.", "introuvable");
  if (lignes.error) throw erreurBase(lignes.error);
  return versPlan(plan.data, lignes.data.map(versLigne));
}

/** Entrée du moteur financier pour un plan (lignes, hypothèses, financement). */
export function entreeFinance(plan: Pick<Plan, "lignes" | "hypotheses" | "financement">): EntreeFinance {
  const charges: LigneCharge[] = [];
  const revenus: LigneRevenu[] = [];
  for (const l of plan.lignes) {
    const m = versMoteur(l);
    if ("charge" in m) charges.push(m.charge);
    else revenus.push(m.revenu);
  }
  const { prelevementsAnnuels, revenusExterieursAnnuels, baissePrixBas, ...hypotheses } = plan.hypotheses;
  return {
    charges,
    revenus,
    ...hypotheses,
    menage: prelevementsAnnuels === null ? undefined : { prelevementsAnnuels, revenusExterieursAnnuels },
    sensibilite: baissePrixBas === null ? undefined : { baissePrixBas },
    apport: plan.financement.apport,
    credit: plan.financement.credit ?? undefined,
    regleFinanceur: plan.financement.regleFinanceur ?? undefined,
  };
}

/**
 * Recalcule un plan en brouillon avec la version actuelle des moteurs et enregistre le résultat.
 * La version du plan augmente à chaque recalcul ; la version des moteurs est enregistrée avec le résultat.
 */
export async function recalculer(client: ClientBase, planId: string, { premierCalcul = false } = {}): Promise<Plan> {
  const plan = await lirePlan(client, planId);
  exigerBrouillon(plan);
  let resultats: ResultatFinance;
  try {
    resultats = calculerFinances(entreeFinance(plan));
  } catch (erreur) {
    if (erreur instanceof ErreurMoteur) throw new ErreurPlan(`Calcul impossible : ${erreur.message}`, "invalide", erreur.details);
    throw erreur;
  }
  const version = premierCalcul ? plan.version : plan.version + 1;
  const { data, error } = await client
    .from("plans")
    .update({
      resultats: resultats as unknown as Json,
      version_moteur: resultats.versionMoteur ?? VERSION_MOTEURS,
      calcule_le: new Date().toISOString(),
      version,
    })
    .eq("id", planId)
    .select("*")
    .maybeSingle();
  if (error) throw erreurBase(error);
  if (!data) throw new ErreurPlan("Tu n'as pas le droit de modifier ce plan.", "refuse");
  return versPlan(data, plan.lignes);
}

/** Change le titre, le statut, les hypothèses ou le financement ; recalcule si le plan reste en brouillon. */
export async function modifierPlan(client: ClientBase, planId: string, modification: z.input<typeof schemaModificationPlan>): Promise<Plan> {
  const m = verifier(schemaModificationPlan, modification);
  const plan = await lirePlan(client, planId);
  const touchesCalcul = m.hypotheses !== undefined || m.financement !== undefined;
  if (touchesCalcul) exigerBrouillon(plan);

  const maj: Database["public"]["Tables"]["plans"]["Update"] = {};
  if (m.titre !== undefined) maj.titre = m.titre;
  if (m.statut !== undefined) maj.statut = m.statut;
  if (m.hypotheses !== undefined) maj.hypotheses = versJson(schemaHypotheses.parse({ ...plan.hypotheses, ...m.hypotheses }));
  if (m.financement !== undefined) {
    maj.financement = versJson(verifier(schemaFinancement, { ...plan.financement, ...m.financement }));
  }
  const { data, error } = await client.from("plans").update(maj).eq("id", planId).select("id, statut").maybeSingle();
  if (error) throw erreurBase(error);
  if (!data) throw new ErreurPlan("Tu n'as pas le droit de modifier ce plan.", "refuse");
  return touchesCalcul && data.statut === "brouillon" ? recalculer(client, planId) : lirePlan(client, planId);
}

/** Ajoute une ligne (saisie de l'utilisateur ou proposition de Cultisia confirmée), puis recalcule. */
export async function ajouterLigne(client: ClientBase, planId: string, entree: NouvelleLigne, auteur: Auteur = "utilisateur"): Promise<Plan> {
  const plan = await lirePlan(client, planId);
  exigerBrouillon(plan);
  const ordre = plan.lignes.reduce((max, l) => Math.max(max, l.ordre), -1) + 1;
  const { error } = await client.from("plan_lignes").insert(depuisSaisie(planId, entree, auteur, ordre));
  if (error) throw erreurBase(error);
  return recalculer(client, planId);
}

/** Corrige une ligne : elle prend l'origine de son auteur (« utilisateur » ou « cultisia »), puis le plan est recalculé. */
export async function corrigerLigne(
  client: ClientBase,
  planId: string,
  ligneId: string,
  correction: CorrectionLigne,
  auteur: Auteur = "utilisateur",
): Promise<Plan> {
  const plan = await lirePlan(client, planId);
  exigerBrouillon(plan);
  const ligne = plan.lignes.find((l) => l.id === ligneId);
  if (!ligne) throw new ErreurPlan("Ligne introuvable dans ce plan.", "introuvable");
  const { data, error } = await client
    .from("plan_lignes")
    .update(appliquerCorrection(ligne, correction, auteur))
    .eq("id", ligneId)
    .select("id");
  if (error) throw erreurBase(error);
  if (data.length === 0) throw new ErreurPlan("Tu n'as pas le droit de modifier ce plan.", "refuse");
  return recalculer(client, planId);
}

export async function supprimerLigne(client: ClientBase, planId: string, ligneId: string): Promise<Plan> {
  const plan = await lirePlan(client, planId);
  exigerBrouillon(plan);
  const { data, error } = await client.from("plan_lignes").delete().eq("id", ligneId).eq("plan_id", planId).select("id");
  if (error) throw erreurBase(error);
  if (data.length === 0) throw new ErreurPlan("Ligne introuvable ou non modifiable.", "introuvable");
  return recalculer(client, planId);
}

/** « Et si ? » : copie un plan (même lancé) en une variante en brouillon, avec ses lignes, puis la calcule. */
export async function dupliquerPlan(client: ClientBase, planId: string, titre?: string): Promise<Plan> {
  const source = await lirePlan(client, planId);
  const t = verifier(z.string().trim().min(2).max(120).optional(), titre);
  const { data: copie, error } = await client
    .from("plans")
    .insert({
      cultiso_id: source.exploitationId,
      titre: t ?? `Et si ? ${source.titre}`.slice(0, 120),
      variante_de: source.id,
      hypotheses: versJson(source.hypotheses),
      financement: versJson(source.financement),
      generation: versJson(source.generation),
    })
    .select("id")
    .single();
  if (error) throw erreurBase(error);

  if (source.lignes.length > 0) {
    const { data: rangees, error: lecture } = await client.from("plan_lignes").select("*").eq("plan_id", planId);
    if (lecture) throw erreurBase(lecture);
    const copies = rangees.map(({ id: _id, created_at: _c, updated_at: _u, ...reste }) => {
      void _id;
      void _c;
      void _u;
      return { ...reste, plan_id: copie.id };
    });
    const insertion = await client.from("plan_lignes").insert(copies, { defaultToNull: false });
    if (insertion.error) {
      await client.from("plans").delete().eq("id", copie.id);
      throw erreurBase(insertion.error);
    }
  }
  return recalculer(client, copie.id, { premierCalcul: true });
}

export async function supprimerPlan(client: ClientBase, planId: string): Promise<void> {
  const { data, error } = await client.from("plans").delete().eq("id", planId).select("id");
  if (error) throw erreurBase(error);
  if (data.length === 0) throw new ErreurPlan("Plan introuvable, ou seul le propriétaire peut le supprimer.", "introuvable");
}
