// Profil du porteur et de son existant (R9) : terre, eau, argent, temps, main d'oeuvre, savoir-faire, ménage,
// finalité, avancement, plus l'existant (matériel, bâtiments, animaux, plants) et les crédits en cours.
// Principe : RIEN n'est inventé. Un champ non renseigné reste vide ; « je ne sais pas » est une réponse (null) qui
// est mémorisée à part (liste `inconnus`), pour que l'entretien (S3) sache ce qu'il reste à demander ou à estimer.
// Toujours appelé avec le client Supabase de l'utilisateur : les droits de la base (RLS) s'appliquent.
import { z } from "zod";
import type { ClientBase } from "@/core/exploitation";
import type { Database } from "@/types/supabase";
import { ErreurPlan, erreurBase } from "./erreurs";
import { verifier } from "./lignes";

const niveau = z.enum(["aucune", "debutant", "moyen", "solide"]);
const montant = z.number().min(0, "un montant ne peut pas être négatif");

export const STATUTS_FONCIERS = ["propriete", "heritage_familial", "location", "metayage", "pret", "concession_communautaire", "aucun"] as const;
export const PIECES_FONCIERES = ["titre_foncier", "attestation_villageoise", "contrat_ecrit", "accord_verbal", "aucune"] as const;
export const FINALITES = ["revenu", "qualite_de_vie", "transmission", "securite", "interet_personnel"] as const;
export const AVANCEMENTS = ["idee", "reflexion", "preparation", "demarre", "en_production"] as const;
export const CATEGORIES_EXISTANT = ["materiel", "batiment", "animaux", "plants"] as const;

/** Les champs scalaires du profil : clé de l'API, colonne en base, règle de validation de la valeur. */
const DEFINITIONS = [
  // Terre
  ["terreSurfaceHa", "terre_surface_ha", z.number().min(0)],
  ["terreStatut", "terre_statut", z.enum(STATUTS_FONCIERS)],
  ["terrePiece", "terre_piece", z.enum(PIECES_FONCIERES)],
  ["terreDureeAnnees", "terre_duree_annees", z.number().min(0)],
  ["terreSol", "terre_sol", z.enum(["sableux", "argileux", "limoneux", "gravillonnaire", "bas_fond", "autre"])],
  ["terrePente", "terre_pente", z.enum(["plat", "faible", "forte"])],
  ["terreJachere", "terre_jachere", z.boolean()],
  ["terreExtensionPossible", "terre_extension_possible", z.boolean()],
  ["terreExtensionHa", "terre_extension_ha", z.number().min(0)],
  // Eau
  ["eauSource", "eau_source", z.enum(["aucune", "pluie", "puits", "forage", "cours_eau", "retenue", "reseau"])],
  ["eauSaison", "eau_saison", z.enum(["toute_annee", "saison_pluies", "irreguliere"])],
  ["eauDebitM3Jour", "eau_debit_m3_jour", z.number().min(0)],
  // Argent
  ["epargneFcfa", "epargne_fcfa", montant],
  ["apportEspecesFcfa", "apport_especes_fcfa", montant],
  ["apportNatureFcfa", "apport_nature_fcfa", montant],
  // Temps
  ["tempsEngagement", "temps_engagement", z.enum(["plein", "partiel"])],
  ["tempsAutreActivite", "temps_autre_activite", z.string().trim().min(1).max(200)],
  ["tempsHeuresSemaine", "temps_heures_semaine", z.number().min(0).max(112, "une semaine compte 112 heures éveillées au plus")],
  // Main d'oeuvre familiale
  ["familleActifs", "famille_actifs", z.number().int().min(0)],
  ["familleHeuresSemaine", "famille_heures_semaine", z.number().min(0)],
  // Savoir-faire
  ["competenceTechnique", "competence_technique", niveau],
  ["competenceGestion", "competence_gestion", niveau],
  ["competenceVente", "competence_vente", niveau],
  // Ménage
  ["menagePersonnes", "menage_personnes", z.number().int().min(1)],
  ["menageBouches", "menage_bouches", z.number().int().min(1)],
  ["menageCoutVieAnnuelFcfa", "menage_cout_vie_annuel_fcfa", montant],
  ["menageRevenusExterieursAnnuelsFcfa", "menage_revenus_exterieurs_annuels_fcfa", montant],
  // Finalité et avancement
  ["finalites", "finalites", z.array(z.enum(FINALITES)).min(1).max(FINALITES.length)],
  ["avancement", "avancement", z.enum(AVANCEMENTS)],
] as const;

export type ChampProfil = (typeof DEFINITIONS)[number][0];
export const CHAMPS_PROFIL: readonly ChampProfil[] = DEFINITIONS.map((d) => d[0]);
const COLONNE: Record<string, string> = Object.fromEntries(DEFINITIONS.map((d) => [d[0], d[1]]));
const CHAMP_DE_COLONNE: Record<string, ChampProfil> = Object.fromEntries(DEFINITIONS.map((d) => [d[1], d[0]]));

/** Clés qui peuvent aussi être « je ne sais pas » en plus des champs scalaires : les deux listes. */
export type ListeProfil = "existant" | "credits";

export const schemaLigneExistant = z.object({
  categorie: z.enum(CATEGORIES_EXISTANT),
  libelle: z.string().trim().min(2).max(120),
  quantite: z.number().positive().nullable().optional(),
  etat: z.enum(["neuf", "bon", "moyen", "mauvais"]).nullable().optional(),
  annee: z.number().int().min(1950).max(2100).nullable().optional(),
  valeurEstimeeFcfa: montant.nullable().optional(),
});
export const schemaCreditEnCours = z.object({
  creancier: z.string().trim().max(120).nullable().optional(),
  capitalRestantFcfa: montant.nullable().optional(),
  mensualiteFcfa: montant,
  moisRestants: z.number().int().min(0).nullable().optional(),
});
export type LigneExistant = z.output<typeof schemaLigneExistant> & { id?: string };
export type CreditEnCours = z.output<typeof schemaCreditEnCours> & { id?: string };

/** Valeur d'un champ : la réponse, ou null pour « je ne sais pas » (undefined = pas touché). */
const champsFacultatifs = Object.fromEntries(DEFINITIONS.map(([cle, , regle]) => [cle, regle.nullable().optional()])) as {
  [D in (typeof DEFINITIONS)[number] as D[0]]: z.ZodOptional<z.ZodNullable<D[2]>>;
};

/** Changement partiel du profil : seuls les champs présents changent. null = « je ne sais pas ». */
export const schemaModificationProfil = z
  .object({
    ...champsFacultatifs,
    /** Liste complète de l'existant (remplace l'ancienne) ; [] = rien ; null = « je ne sais pas ». */
    existant: z.array(schemaLigneExistant).max(60).nullable().optional(),
    /** Liste complète des crédits en cours (remplace l'ancienne) ; [] = aucun crédit ; null = « je ne sais pas ». */
    credits: z.array(schemaCreditEnCours).max(20).nullable().optional(),
  })
  .strict();
export type ModificationProfil = z.input<typeof schemaModificationProfil>;

export interface ProfilPorteur {
  /** false tant que rien n'a été enregistré. */
  existe: boolean;
  /** Valeur de chaque champ ; null = pas répondu ou « je ne sais pas » (voir `inconnus`). */
  valeurs: { [C in ChampProfil]: unknown };
  existant: LigneExistant[];
  credits: CreditEnCours[];
  /** Le porteur a dit n'avoir aucun existant / aucun crédit (sinon une liste vide veut dire « pas demandé »). */
  sansExistant: boolean;
  sansCredit: boolean;
  /** Champs (et listes) où le porteur a répondu « je ne sais pas ». */
  inconnus: (ChampProfil | ListeProfil)[];
}

/** Valeur typée d'un champ du profil (pour le code qui en a besoin). */
export const valeur = <T = unknown>(p: ProfilPorteur, champ: ChampProfil): T | null => (p.valeurs[champ] as T | null) ?? null;

type RangeeProfil = Database["public"]["Tables"]["profil_porteur"]["Row"];
type RangeeExistant = Database["public"]["Tables"]["profil_existant"]["Row"];
type RangeeCredit = Database["public"]["Tables"]["profil_credits"]["Row"];

function vide(): ProfilPorteur {
  return {
    existe: false,
    valeurs: Object.fromEntries(CHAMPS_PROFIL.map((c) => [c, null])) as ProfilPorteur["valeurs"],
    existant: [],
    credits: [],
    sansExistant: false,
    sansCredit: false,
    inconnus: [],
  };
}

const nombreOuNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function versProfil(r: RangeeProfil | null, existant: RangeeExistant[], credits: RangeeCredit[]): ProfilPorteur {
  const p = vide();
  if (r) {
    p.existe = true;
    const brut = r as unknown as Record<string, unknown>;
    for (const [cle, colonne] of DEFINITIONS.map((d) => [d[0], d[1]] as const)) {
      const v = brut[colonne];
      p.valeurs[cle] = v ?? null;
    }
    p.sansExistant = r.sans_existant;
    p.sansCredit = r.sans_credit;
    p.inconnus = r.inconnus.filter((i): i is ChampProfil | ListeProfil => i === "existant" || i === "credits" || i in COLONNE);
  }
  p.existant = existant.map((e) => ({
    id: e.id,
    categorie: e.categorie as LigneExistant["categorie"],
    libelle: e.libelle,
    quantite: nombreOuNull(e.quantite),
    etat: e.etat as LigneExistant["etat"],
    annee: e.annee,
    valeurEstimeeFcfa: nombreOuNull(e.valeur_estimee_fcfa),
  }));
  p.credits = credits.map((c) => ({
    id: c.id,
    creancier: c.creancier,
    capitalRestantFcfa: nombreOuNull(c.capital_restant_fcfa),
    mensualiteFcfa: Number(c.mensualite_fcfa),
    moisRestants: c.mois_restants,
  }));
  return p;
}

/** Base pas encore migrée (tables absentes) : 42P01 (Postgres) ou PGRST205 (API REST). */
const tableAbsente = (e: { code?: string }) => e.code === "42P01" || e.code === "PGRST205";

/**
 * Lit le profil d'une exploitation. Sans enregistrement : un profil vide (`existe: false`).
 * `tolerant` : si la migration n'est pas encore appliquée, renvoie un profil vide au lieu d'échouer
 * (utilisé par la génération du plan, qui ne doit pas casser sans profil).
 */
export async function lireProfil(client: ClientBase, exploitationId: string, { tolerant = false } = {}): Promise<ProfilPorteur> {
  const [profil, existant, credits] = await Promise.all([
    client.from("profil_porteur").select("*").eq("cultiso_id", exploitationId).maybeSingle(),
    client.from("profil_existant").select("*").eq("cultiso_id", exploitationId).order("created_at"),
    client.from("profil_credits").select("*").eq("cultiso_id", exploitationId).order("created_at"),
  ]);
  for (const r of [profil, existant, credits]) {
    if (r.error) {
      if (tolerant && tableAbsente(r.error)) return vide();
      throw erreurBase(r.error);
    }
  }
  return versProfil(profil.data, existant.data ?? [], credits.data ?? []);
}

/** Cohérence entre champs, vérifiée sur le profil APRÈS fusion. */
function verifierCoherence(valeurs: ProfilPorteur["valeurs"]): void {
  const problemes: string[] = [];
  const bouches = valeurs.menageBouches as number | null;
  const personnes = valeurs.menagePersonnes as number | null;
  if (bouches !== null && personnes !== null && bouches > personnes) problemes.push("Le nombre de bouches à nourrir ne peut pas dépasser le nombre de personnes du ménage.");
  if (valeurs.terreExtensionPossible === false && ((valeurs.terreExtensionHa as number | null) ?? 0) > 0) problemes.push("Tu dis qu'une extension n'est pas possible, mais tu indiques une surface d'extension.");
  if (problemes.length > 0) throw new ErreurPlan(problemes.join(" "), "invalide", problemes);
}

const sansDoublon = <T>(l: T[]): T[] => [...new Set(l)];

/**
 * Enregistre un changement partiel du profil (les champs absents ne bougent pas) et renvoie le profil complet.
 * Une valeur null enregistre « je ne sais pas » ; une valeur donnée retire le champ des « je ne sais pas ».
 */
export async function ecrireProfil(client: ClientBase, exploitationId: string, modification: ModificationProfil): Promise<ProfilPorteur> {
  const m = verifier(schemaModificationProfil, modification);
  const actuel = await lireProfil(client, exploitationId);

  const colonnes: Record<string, unknown> = {};
  const valeurs = { ...actuel.valeurs };
  let inconnus: string[] = [...actuel.inconnus];
  for (const cle of CHAMPS_PROFIL) {
    const v = m[cle];
    if (v === undefined) continue;
    colonnes[COLONNE[cle]] = v;
    valeurs[cle] = v;
    inconnus = v === null ? sansDoublon([...inconnus, cle]) : inconnus.filter((i) => i !== cle);
  }
  verifierCoherence(valeurs);

  let sansExistant = actuel.sansExistant;
  let sansCredit = actuel.sansCredit;
  for (const [liste, valeurListe] of [["existant", m.existant], ["credits", m.credits]] as const) {
    if (valeurListe === undefined) continue;
    inconnus = valeurListe === null ? sansDoublon([...inconnus, liste]) : inconnus.filter((i) => i !== liste);
    const aucun = valeurListe !== null && valeurListe.length === 0;
    if (liste === "existant") sansExistant = aucun;
    else sansCredit = aucun;
  }

  const { error } = await client
    .from("profil_porteur")
    .upsert({ cultiso_id: exploitationId, ...colonnes, sans_existant: sansExistant, sans_credit: sansCredit, inconnus }, { onConflict: "cultiso_id" });
  if (error) throw erreurBase(error);

  if (m.existant !== undefined) {
    const eff = await client.from("profil_existant").delete().eq("cultiso_id", exploitationId);
    if (eff.error) throw erreurBase(eff.error);
    if (m.existant && m.existant.length > 0) {
      const ins = await client.from("profil_existant").insert(
        m.existant.map((e) => ({
          cultiso_id: exploitationId,
          categorie: e.categorie,
          libelle: e.libelle,
          quantite: e.quantite ?? null,
          etat: e.etat ?? null,
          annee: e.annee ?? null,
          valeur_estimee_fcfa: e.valeurEstimeeFcfa ?? null,
        })),
      );
      if (ins.error) throw erreurBase(ins.error);
    }
  }
  if (m.credits !== undefined) {
    const eff = await client.from("profil_credits").delete().eq("cultiso_id", exploitationId);
    if (eff.error) throw erreurBase(eff.error);
    if (m.credits && m.credits.length > 0) {
      const ins = await client.from("profil_credits").insert(
        m.credits.map((c) => ({
          cultiso_id: exploitationId,
          creancier: c.creancier ?? null,
          capital_restant_fcfa: c.capitalRestantFcfa ?? null,
          mensualite_fcfa: c.mensualiteFcfa,
          mois_restants: c.moisRestants ?? null,
        })),
      );
      if (ins.error) throw erreurBase(ins.error);
    }
  }
  return lireProfil(client, exploitationId);
}

/** Nom du champ du profil pour une colonne en base (utile aux outils et aux tests). */
export const champDeColonne = (colonne: string): ChampProfil | undefined => CHAMP_DE_COLONNE[colonne];

// ---------------------------------------------------------------------------------------------------------------
// Branchement aux moteurs : ce que le profil fournit au plan, avec l'origine de chaque valeur.
// ---------------------------------------------------------------------------------------------------------------

export interface ApportDuProfil {
  /** Hypothèses du plan (M3) tirées du profil ; absentes si le porteur ne les a pas données. */
  hypotheses: { prelevementsAnnuels?: number; revenusExterieursAnnuels?: number };
  /** Apport personnel (contrôles M4 et règles des financeurs R11) : espèces + apport en nature valorisé. */
  financement: { apport?: number };
  /** Phrases d'origine : d'où vient chaque chiffre, pour que rien ne sorte de nulle part. */
  origines: string[];
}

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n).replace(/\s/g, " ")} FCFA`;

/**
 * Ce que le profil apporte aux moteurs. Aucun calcul financier ici, seulement des additions de montants déclarés :
 * - coût de vie du ménage (+ mensualités des crédits en cours, qui sortent aussi du revenu du ménage) → prélèvements (M3) ;
 * - revenus extérieurs → revenus du ménage hors projet (M3) ;
 * - apport en espèces + apport en nature valorisé → apport (M4 et R11).
 * Un champ inconnu ou vide ne produit rien : le moteur retombe sur son comportement « non évalué ».
 */
export function deduireDuProfil(p: ProfilPorteur): ApportDuProfil {
  const sortie: ApportDuProfil = { hypotheses: {}, financement: {}, origines: [] };
  const coutVie = valeur<number>(p, "menageCoutVieAnnuelFcfa");
  if (coutVie !== null) {
    const mensualites = p.credits.reduce((somme, c) => somme + c.mensualiteFcfa, 0);
    sortie.hypotheses.prelevementsAnnuels = coutVie + mensualites * 12;
    sortie.origines.push(
      mensualites > 0
        ? `Prélèvements du ménage : coût de vie déclaré (${fcfa(coutVie)}) plus ${p.credits.length} crédit(s) en cours (${fcfa(mensualites)} par mois).`
        : `Prélèvements du ménage : coût de vie déclaré par le porteur (${fcfa(coutVie)} par an).`,
    );
  }
  const exterieurs = valeur<number>(p, "menageRevenusExterieursAnnuelsFcfa");
  if (exterieurs !== null) {
    sortie.hypotheses.revenusExterieursAnnuels = exterieurs;
    sortie.origines.push(`Revenus extérieurs au projet : ${fcfa(exterieurs)} par an, déclarés par le porteur.`);
  }
  const especes = valeur<number>(p, "apportEspecesFcfa");
  const nature = valeur<number>(p, "apportNatureFcfa");
  if (especes !== null || nature !== null) {
    sortie.financement.apport = (especes ?? 0) + (nature ?? 0);
    sortie.origines.push(
      `Apport personnel : ${fcfa(especes ?? 0)} en espèces et ${fcfa(nature ?? 0)} en nature (valeur estimée par le porteur).`,
    );
  }
  return sortie;
}
