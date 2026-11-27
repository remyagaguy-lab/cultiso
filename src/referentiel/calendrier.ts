// Itinéraires techniques calendaires (R1) et profil pluriannuel (R4) : lecture de ref.fiche_technique, ref.itineraire_mensuel,
// ref.profils_speculation et ref.profil_pluriannuel. Une variante = une source et une conduite (zone, variété).
// Aucune valeur n'est complétée ici : un profil absent reste absent, un profil dont la somme ne fait pas 1 est écarté et signalé.
//
// Les tables sont lues par un accès typé à la main (zod) plutôt que par `src/types/supabase.ts`, que d'autres chantiers modifient en parallèle.
import { z } from "zod";
import type { ClientBase } from "@/core/exploitation";
import { ErreurReferentiel, type StatutDonnee } from "./index";

export const CODES_FICHE = [
  "densite",
  "eau_apport",
  "eau_total",
  "fumure_fond",
  "fumure_couverture",
  "perte_apres_recolte",
  "duree_conservation",
  "delai_repiquage",
  "delai_recolte",
] as const;
export type CodeFiche = (typeof CODES_FICHE)[number];

const statut = z.enum(["brouillon_ia", "a_valider", "validee"]);
const RANG: Record<StatutDonnee, number> = { brouillon_ia: 0, a_valider: 1, validee: 2 };
/** Tolérance sur la somme des parts d'un profil (0,001 = 0,1 %). */
export const TOLERANCE_PARTS = 0.001;

// ---------------------------------------------------------------------------------------------
// Fiche technique (R1)
// ---------------------------------------------------------------------------------------------

export interface ValeurFiche {
  code: CodeFiche;
  phase?: string;
  systeme?: string;
  intrant?: string;
  /** Valeur, ou borne basse quand la source donne une fourchette. */
  min: number;
  max?: number;
  unite: string;
  repere?: "semis" | "repiquage";
  joursApresRepere?: number;
  source: string;
  dateSource: string;
  statut: StatutDonnee;
}

export interface FicheTechnique {
  variante: string;
  valeurs: ValeurFiche[];
  sources: string[];
  /** Le moins avancé des statuts de la variante. */
  statut: StatutDonnee;
}

const schemaLigneFiche = z.object({
  code: z.enum(CODES_FICHE),
  phase: z.string().nullable(),
  systeme: z.string().nullable(),
  intrant: z.string().nullable(),
  valeur_min: z.coerce.number().min(0),
  valeur_max: z.coerce.number().min(0).nullable(),
  unite: z.string().min(1),
  repere: z.enum(["semis", "repiquage"]).nullable(),
  jours_apres_repere: z.number().int().min(0).nullable(),
  source: z.string().min(1),
  date_source: z.string().min(1),
  statut,
  variante: z.string().min(1),
});
export type LigneFicheBase = z.input<typeof schemaLigneFiche>;

/** Assemble les lignes de ref.fiche_technique en fiches par variante (pur, testable sans base). */
export function assemblerFiches(lignes: LigneFicheBase[]): FicheTechnique[] {
  const parVariante = new Map<string, FicheTechnique>();
  for (const brut of lignes) {
    const c = schemaLigneFiche.safeParse(brut);
    if (!c.success) throw new ErreurReferentiel(`Donnée du référentiel incohérente (fiche technique ${brut.variante}/${brut.code}) : ${c.error.issues.map((i) => i.message).join(" ; ")}`);
    const l = c.data;
    let f = parVariante.get(l.variante);
    if (!f) {
      f = { variante: l.variante, valeurs: [], sources: [], statut: "validee" };
      parVariante.set(l.variante, f);
    }
    f.valeurs.push({
      code: l.code,
      ...(l.phase ? { phase: l.phase } : {}),
      ...(l.systeme ? { systeme: l.systeme } : {}),
      ...(l.intrant ? { intrant: l.intrant } : {}),
      min: l.valeur_min,
      ...(l.valeur_max !== null ? { max: l.valeur_max } : {}),
      unite: l.unite,
      ...(l.repere ? { repere: l.repere } : {}),
      ...(l.jours_apres_repere !== null ? { joursApresRepere: l.jours_apres_repere } : {}),
      source: l.source,
      dateSource: l.date_source,
      statut: l.statut,
    });
    if (!f.sources.includes(l.source)) f.sources.push(l.source);
    if (RANG[l.statut] < RANG[f.statut]) f.statut = l.statut;
  }
  return [...parVariante.values()].sort((a, b) => a.variante.localeCompare(b.variante));
}

// ---------------------------------------------------------------------------------------------
// Profil mensuel d'un cycle (R1)
// ---------------------------------------------------------------------------------------------

export interface PartsMensuelles {
  /** Type de charge visé ; null = toutes les charges d'exploitation de la spéculation. */
  typeCharge: string | null;
  /** Index 0 = mois 1 du cycle. Somme = 1 (à TOLERANCE_PARTS près). */
  parts: number[];
}

export interface ItineraireMensuel {
  variante: string;
  /** Part des coûts par mois de cycle, par type de charge (ou toutes). */
  partCouts: PartsMensuelles[];
  /** Heures de travail par unité d'échelle et par mois de cycle ; null si absent. */
  heuresParUnite: number[] | null;
  /** Part de la récolte vendue par mois de cycle ; null si absente ou invalide. */
  partRecolte: number[] | null;
  sources: string[];
  statut: StatutDonnee;
  /** Profils écartés (somme différente de 1) ou autres limites : jamais corrigés en silence. */
  avertissements: string[];
}

const schemaLigneItineraire = z.object({
  variante: z.string().min(1),
  mois_cycle: z.number().int().min(1),
  grandeur: z.enum(["part_couts", "heures_par_unite", "part_recolte"]),
  type_charge: z.string().nullable(),
  valeur: z.coerce.number().min(0),
  source: z.string().min(1),
  statut,
});
export type LigneItineraireBase = z.input<typeof schemaLigneItineraire>;

const sommeParts = (p: number[]) => p.reduce((t, v) => t + v, 0);
function enTableau(points: { mois: number; valeur: number }[]): number[] {
  const longueur = Math.max(...points.map((p) => p.mois));
  const tableau = new Array<number>(longueur).fill(0);
  for (const p of points) tableau[p.mois - 1] = p.valeur;
  return tableau;
}

/** Assemble les lignes de ref.itineraire_mensuel en itinéraires par variante (pur, testable sans base). */
export function assemblerItineraires(lignes: LigneItineraireBase[]): ItineraireMensuel[] {
  const parVariante = new Map<string, ItineraireMensuel>();
  const groupes = new Map<string, { variante: string; grandeur: string; typeCharge: string | null; points: { mois: number; valeur: number }[] }>();
  for (const brut of lignes) {
    const c = schemaLigneItineraire.safeParse(brut);
    if (!c.success) throw new ErreurReferentiel(`Donnée du référentiel incohérente (itinéraire mensuel ${brut.variante}/${brut.grandeur}/${brut.mois_cycle}) : ${c.error.issues.map((i) => i.message).join(" ; ")}`);
    const l = c.data;
    let it = parVariante.get(l.variante);
    if (!it) {
      it = { variante: l.variante, partCouts: [], heuresParUnite: null, partRecolte: null, sources: [], statut: "validee", avertissements: [] };
      parVariante.set(l.variante, it);
    }
    if (!it.sources.includes(l.source)) it.sources.push(l.source);
    if (RANG[l.statut] < RANG[it.statut]) it.statut = l.statut;
    const cle = `${l.variante}|${l.grandeur}|${l.type_charge ?? ""}`;
    const g = groupes.get(cle) ?? { variante: l.variante, grandeur: l.grandeur, typeCharge: l.type_charge, points: [] };
    g.points.push({ mois: l.mois_cycle, valeur: l.valeur });
    groupes.set(cle, g);
  }
  for (const g of groupes.values()) {
    const it = parVariante.get(g.variante) as ItineraireMensuel;
    const tableau = enTableau(g.points);
    if (g.grandeur === "heures_par_unite") {
      it.heuresParUnite = tableau;
      continue;
    }
    const somme = sommeParts(tableau);
    const nom = g.grandeur === "part_couts" ? `part des coûts${g.typeCharge ? ` (${g.typeCharge})` : ""}` : "part de la récolte";
    if (Math.abs(somme - 1) > TOLERANCE_PARTS) {
      it.avertissements.push(`Profil écarté : la ${nom} de la variante ${g.variante} vaut ${somme.toFixed(4)} sur le cycle au lieu de 1. Le calendrier d'avant (mois de décaissement et de vente) reste utilisé.`);
      continue;
    }
    if (g.grandeur === "part_couts") it.partCouts.push({ typeCharge: g.typeCharge, parts: tableau });
    else it.partRecolte = tableau;
  }
  return [...parVariante.values()].sort((a, b) => a.variante.localeCompare(b.variante));
}

// ---------------------------------------------------------------------------------------------
// Profil pluriannuel (R4)
// ---------------------------------------------------------------------------------------------

export const TYPES_PROFIL = ["annuelle", "perenne", "cheptel"] as const;
export type TypeProfil = (typeof TYPES_PROFIL)[number];

export interface ProfilPluriannuel {
  variante: string;
  type: TypeProfil;
  /** Mois avant la première production, quand la source le donne. */
  moisImproductifs?: number;
  /** Années avant le plein régime, quand la source le donne. */
  anneesPleinRegime?: number;
  /** Coefficient de rendement par année (1 = plein régime) ; une année absente est inconnue. */
  coefficientRendement: Record<number, number>;
  /** Taux d'utilisation de la capacité par année ; une année absente est inconnue. */
  tauxUtilisation: Record<number, number>;
  /** Une spéculation pérenne ou de cheptel doit déclarer sa période improductive dans le plan (contrôle PERIODE_IMPRODUCTIVE). */
  declarationObligatoire: boolean;
  source: string;
  dateSource: string;
  statut: StatutDonnee;
}

const schemaProfil = z.object({
  variante: z.string().min(1),
  type_profil: z.enum(TYPES_PROFIL),
  mois_improductifs: z.coerce.number().min(0).nullable(),
  annees_plein_regime: z.number().int().min(1).nullable(),
  source: z.string().min(1),
  date_source: z.string().min(1),
  statut,
});
const schemaAnnee = z.object({
  variante: z.string().min(1),
  annee: z.number().int().min(1),
  grandeur: z.enum(["coefficient_rendement", "taux_utilisation"]),
  valeur: z.coerce.number().min(0),
  statut,
});
export type LigneProfilBase = z.input<typeof schemaProfil>;
export type LigneAnneeBase = z.input<typeof schemaAnnee>;

/** Assemble les lignes des deux tables en profils par variante (pur). Les coefficients sans ligne de type sont ignorés et signalés par l'appelant. */
export function assemblerProfils(lignesProfils: LigneProfilBase[], lignesAnnees: LigneAnneeBase[]): ProfilPluriannuel[] {
  const profils = new Map<string, ProfilPluriannuel>();
  for (const brut of lignesProfils) {
    const c = schemaProfil.safeParse(brut);
    if (!c.success) throw new ErreurReferentiel(`Donnée du référentiel incohérente (profil ${brut.variante}) : ${c.error.issues.map((i) => i.message).join(" ; ")}`);
    const l = c.data;
    profils.set(l.variante, {
      variante: l.variante,
      type: l.type_profil,
      ...(l.mois_improductifs !== null ? { moisImproductifs: l.mois_improductifs } : {}),
      ...(l.annees_plein_regime !== null ? { anneesPleinRegime: l.annees_plein_regime } : {}),
      coefficientRendement: {},
      tauxUtilisation: {},
      declarationObligatoire: l.type_profil !== "annuelle",
      source: l.source,
      dateSource: l.date_source,
      statut: l.statut,
    });
  }
  for (const brut of lignesAnnees) {
    const c = schemaAnnee.safeParse(brut);
    if (!c.success) throw new ErreurReferentiel(`Donnée du référentiel incohérente (profil pluriannuel ${brut.variante}/${brut.annee}) : ${c.error.issues.map((i) => i.message).join(" ; ")}`);
    const l = c.data;
    const p = profils.get(l.variante);
    if (!p) continue;
    (l.grandeur === "coefficient_rendement" ? p.coefficientRendement : p.tauxUtilisation)[l.annee] = l.valeur;
    if (RANG[l.statut] < RANG[p.statut]) p.statut = l.statut;
  }
  return [...profils.values()].sort((a, b) => a.variante.localeCompare(b.variante));
}

// ---------------------------------------------------------------------------------------------
// Lecture en base
// ---------------------------------------------------------------------------------------------

interface RequeteRef {
  select(colonnes: string): { eq(colonne: string, valeur: string): PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> };
}
const table = (client: ClientBase, nom: string): RequeteRef => (client.schema("ref") as unknown as { from(t: string): RequeteRef }).from(nom);

async function lire(client: ClientBase, nom: string, speculationCode: string, libelle: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await table(client, nom).select("*").eq("speculation_code", speculationCode);
  if (error) throw new ErreurReferentiel(`Lecture du référentiel impossible (${libelle}) : ${error.message}`);
  return data ?? [];
}

/** Fiches techniques (R1) d'une spéculation. Liste vide : le référentiel n'a rien. */
export async function lireFichesTechniques(client: ClientBase, speculationCode: string): Promise<FicheTechnique[]> {
  return assemblerFiches((await lire(client, "fiche_technique", speculationCode, "fiche technique")) as LigneFicheBase[]);
}

/** Itinéraires mensuels (R1) d'une spéculation. Liste vide : le moteur garde mois_decaissement et mois_vente. */
export async function lireItinerairesMensuels(client: ClientBase, speculationCode: string): Promise<ItineraireMensuel[]> {
  return assemblerItineraires((await lire(client, "itineraire_mensuel", speculationCode, "itinéraire mensuel")) as LigneItineraireBase[]);
}

/** Profils pluriannuels (R4) d'une spéculation. Liste vide : profil non renseigné (jamais « annuelle » par défaut). */
export async function lireProfilsPluriannuels(client: ClientBase, speculationCode: string): Promise<ProfilPluriannuel[]> {
  const [profils, annees] = await Promise.all([
    lire(client, "profils_speculation", speculationCode, "profil de spéculation"),
    lire(client, "profil_pluriannuel", speculationCode, "profil pluriannuel"),
  ]);
  return assemblerProfils(profils as LigneProfilBase[], annees as LigneAnneeBase[]);
}
