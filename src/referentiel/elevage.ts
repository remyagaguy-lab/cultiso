// Courbes mensuelles par âge et paramètres des ateliers animaux (M14) : lecture de ref.courbes_age et ref.parametres_elevage.
// Une variante = une source et une conduite (souche, pays). Aucune valeur n'est complétée ici : une courbe absente reste absente.
import { z } from "zod";
import type { ClientBase } from "@/core/exploitation";
import type { Database } from "@/types/supabase";
import { ErreurReferentiel, type StatutDonnee } from "./index";

export const GRANDEURS_COURBE = ["mortalite", "consommation", "production", "poids"] as const;
export type GrandeurCourbe = (typeof GRANDEURS_COURBE)[number];
export const CODES_PARAMETRE_ELEVAGE = [
  "duree_cycle_mois",
  "duree_phase_improductive_mois",
  "duree_production_mois",
  "age_reforme_mois",
  "jours_par_mois",
  "poids_vente_kg",
  "consommation_moyenne_g_sujet_jour",
] as const;
export type CodeParametreElevage = (typeof CODES_PARAMETRE_ELEVAGE)[number];

export interface PointCourbe {
  age: number;
  valeur: number;
}
export interface ParametreElevage {
  valeur: number;
  unite: string;
  source: string;
  dateSource: string;
  statut: StatutDonnee;
}
export interface VarianteElevage {
  variante: string;
  courbes: Record<GrandeurCourbe, PointCourbe[]>;
  parametres: Partial<Record<CodeParametreElevage, ParametreElevage>>;
  /** Documents d'où viennent les courbes et les paramètres de cette variante. */
  sources: string[];
  /** Le moins avancé des statuts de la variante : brouillon_ia tant qu'une seule valeur est un brouillon. */
  statut: StatutDonnee;
}

const statut = z.enum(["brouillon_ia", "a_valider", "validee"]);
const schemaLigneCourbe = z.object({ grandeur: z.enum(GRANDEURS_COURBE), age_mois: z.number().int().min(1), valeur: z.number().min(0), source: z.string().min(1), statut });
const schemaLigneParametre = z.object({ code: z.enum(CODES_PARAMETRE_ELEVAGE), valeur: z.number().positive(), unite: z.string().min(1), source: z.string().min(1), date_source: z.string().min(1), statut });

const RANG: Record<StatutDonnee, number> = { brouillon_ia: 0, a_valider: 1, validee: 2 };

type Tables = Database["ref"]["Tables"];

/**
 * Variantes d'élevage d'une spéculation, avec leurs courbes par âge (triées par âge) et leurs paramètres.
 * Liste vide : le référentiel n'a rien pour cette spéculation (les courbes sont alors « non évaluées », jamais devinées).
 */
export async function lireVariantesElevage(client: ClientBase, speculationCode: string): Promise<VarianteElevage[]> {
  const ref = client.schema("ref");
  const [courbes, parametres] = await Promise.all([
    ref.from("courbes_age").select("*").eq("speculation_code", speculationCode).order("age_mois"),
    ref.from("parametres_elevage").select("*").eq("speculation_code", speculationCode),
  ]);
  if (courbes.error) throw new ErreurReferentiel(`Lecture du référentiel impossible (courbes par âge) : ${courbes.error.message}`);
  if (parametres.error) throw new ErreurReferentiel(`Lecture du référentiel impossible (paramètres d'élevage) : ${parametres.error.message}`);
  return assemblerVariantes(courbes.data, parametres.data);
}

/** Assemble les lignes des deux tables en variantes (pur, testable sans base). */
export function assemblerVariantes(lignesCourbes: Tables["courbes_age"]["Row"][], lignesParametres: Tables["parametres_elevage"]["Row"][]): VarianteElevage[] {
  const parVariante = new Map<string, VarianteElevage>();
  const creer = (nom: string): VarianteElevage => {
    let v = parVariante.get(nom);
    if (!v) {
      v = { variante: nom, courbes: { mortalite: [], consommation: [], production: [], poids: [] }, parametres: {}, sources: [], statut: "validee" };
      parVariante.set(nom, v);
    }
    return v;
  };
  const noter = (v: VarianteElevage, source: string, s: StatutDonnee) => {
    if (!v.sources.includes(source)) v.sources.push(source);
    if (RANG[s] < RANG[v.statut]) v.statut = s;
  };
  for (const l of lignesCourbes) {
    const c = schemaLigneCourbe.safeParse({ grandeur: l.grandeur, age_mois: l.age_mois, valeur: Number(l.valeur), source: l.source, statut: l.statut });
    if (!c.success) throw new ErreurReferentiel(`Donnée du référentiel incohérente (courbe ${l.speculation_code}/${l.variante}/${l.grandeur}/${l.age_mois}) : ${c.error.issues.map((i) => i.message).join(" ; ")}`);
    const v = creer(l.variante);
    v.courbes[c.data.grandeur].push({ age: c.data.age_mois, valeur: c.data.valeur });
    noter(v, c.data.source, c.data.statut);
  }
  for (const l of lignesParametres) {
    const p = schemaLigneParametre.safeParse({ code: l.code, valeur: Number(l.valeur), unite: l.unite, source: l.source, date_source: l.date_source, statut: l.statut });
    if (!p.success) throw new ErreurReferentiel(`Donnée du référentiel incohérente (paramètre ${l.speculation_code}/${l.variante}/${l.code}) : ${p.error.issues.map((i) => i.message).join(" ; ")}`);
    const v = creer(l.variante);
    v.parametres[p.data.code] = { valeur: p.data.valeur, unite: p.data.unite, source: p.data.source, dateSource: p.data.date_source, statut: p.data.statut };
    noter(v, p.data.source, p.data.statut);
  }
  for (const v of parVariante.values()) for (const g of GRANDEURS_COURBE) v.courbes[g].sort((a, b) => a.age - b.age);
  return [...parVariante.values()].sort((a, b) => a.variante.localeCompare(b.variante));
}
