// Lecture du référentiel pour le financement (M6) : barème du crédit de campagne par spéculation.
// Fichier à part (et non src/referentiel/index.ts) pour ne pas mêler ce lot aux autres chantiers ; mêmes règles : lecture seule,
// chaque ligne validée par un schéma, aucune valeur écrite ici.
import { z } from "zod";
import type { ClientBase } from "@/core/exploitation";
import type { Database } from "@/types/supabase";
import { ErreurReferentiel, type StatutDonnee } from ".";

type LigneBareme = Database["ref"]["Tables"]["baremes_credit_campagne"]["Row"];

export interface BaremeCampagne {
  id: string;
  speculationCode: string;
  organisme: string | null;
  produit: string | null;
  /** FCFA pour 1 unité d'échelle de la spéculation. */
  plafondParUnite: number;
  dureeMaxMois: number | null;
  tauxIndicatif: number | null;
  source: string;
  dateSource: string;
  statut: StatutDonnee;
}

const schemaBareme = z.object({
  id: z.string(),
  speculationCode: z.string().min(1),
  organisme: z.string().nullable(),
  produit: z.string().nullable(),
  plafondParUnite: z.number().min(0),
  dureeMaxMois: z.number().int().positive().nullable(),
  tauxIndicatif: z.number().min(0).max(1).nullable(),
  source: z.string().min(5),
  dateSource: z.string().min(1),
  statut: z.enum(["brouillon_ia", "a_valider", "validee"]),
});

const nombreOuNull = (x: number | string | null) => (x === null ? null : Number(x));

/** Ligne de ref.baremes_credit_campagne → barème validé. Une donnée incohérente est signalée, pas ignorée. */
export function versBareme(r: LigneBareme): BaremeCampagne {
  const lu = schemaBareme.safeParse({
    id: r.id,
    speculationCode: r.speculation_code,
    organisme: r.organisme,
    produit: r.produit,
    plafondParUnite: Number(r.plafond_par_unite),
    dureeMaxMois: r.duree_max_mois,
    tauxIndicatif: nombreOuNull(r.taux_indicatif),
    source: r.source,
    dateSource: r.date_source,
    statut: r.statut,
  });
  if (!lu.success) {
    const details = lu.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ");
    throw new ErreurReferentiel(`Donnée du référentiel incohérente (barème de campagne ${r.speculation_code}) : ${details}`);
  }
  return lu.data;
}

/** Barèmes de crédit de campagne d'une spéculation. Liste vide : aucun barème connu (le plafond reste inconnu). */
export async function lireBaremesCampagne(client: ClientBase, speculationCode: string): Promise<BaremeCampagne[]> {
  const { data, error } = await client
    .schema("ref")
    .from("baremes_credit_campagne")
    .select("*")
    .eq("speculation_code", speculationCode)
    .order("organisme", { nullsFirst: true });
  if (error) throw new ErreurReferentiel(`Lecture du référentiel impossible (barèmes de campagne) : ${error.message}`);
  return data.map(versBareme);
}

/**
 * Le barème à retenir : celui du financeur demandé s'il existe, sinon le barème général (sans organisme). Un barème du financeur
 * est toujours préféré ; s'il y en a plusieurs au même rang, on n'en choisit pas : on renvoie null et la liste des choix (à préciser).
 */
export function choisirBareme(baremes: BaremeCampagne[], organisme?: string): { bareme: BaremeCampagne | null; ambigus: BaremeCampagne[] } {
  const norme = (t: string | null) => (t ?? "").trim().toLowerCase();
  const duFinanceur = organisme ? baremes.filter((b) => norme(b.organisme) === norme(organisme)) : [];
  const generaux = baremes.filter((b) => b.organisme === null);
  const rang = duFinanceur.length > 0 ? duFinanceur : generaux;
  if (rang.length === 1) return { bareme: rang[0], ambigus: [] };
  return { bareme: null, ambigus: rang.length > 1 ? rang : [] };
}
