// Couche HTTP commune des routes /api/cultiplan/* : authentification par jeton, lecture du corps,
// traduction des erreurs en statuts HTTP. Les routes restent minces : aucune logique métier.
// Toutes les réponses sont en JSON ; une erreur a la forme { error, details? }.
import { createClient } from "@supabase/supabase-js";
import { ErreurExploitation, type ClientBase } from "@/core/exploitation";
import { ErreurMoteur } from "@/moteurs";
import { ErreurReferentiel } from "@/referentiel";
import type { Database } from "@/types/supabase";
import { ErreurPlan } from "./erreurs";

export interface FabriqueClient {
  /** Client Supabase avec le jeton de l'utilisateur, ou null si le jeton est invalide. */
  (jeton: string): Promise<ClientBase | null>;
}

function variable(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) throw new Error(`${nom} n'est pas définie sur le serveur.`);
  return valeur;
}

export const fabriqueSupabase: FabriqueClient = async (jeton) => {
  const client = createClient<Database>(variable("NEXT_PUBLIC_SUPABASE_URL"), variable("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${jeton}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(jeton);
  return error || !data.user ? null : client;
};

let fabriqueCourante: FabriqueClient = fabriqueSupabase;
/** Remplace la fabrique (tests). Renvoie la précédente. */
export function remplacerFabrique(fabrique: FabriqueClient): FabriqueClient {
  const precedente = fabriqueCourante;
  fabriqueCourante = fabrique;
  return precedente;
}

export const json = (corps: unknown, status = 200): Response =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

/** Lit le corps JSON ; un corps absent vaut {}. */
export async function lireCorps(req: Request): Promise<unknown> {
  const texte = await req.text();
  if (texte.trim() === "") return {};
  try {
    return JSON.parse(texte);
  } catch {
    throw new ErreurPlan("Corps de requête illisible (JSON invalide).", "invalide");
  }
}

const STATUT_PLAN: Record<ErreurPlan["code"], number> = { invalide: 400, introuvable: 404, refuse: 403, fige: 409, base: 500 };
const STATUT_EXPLOITATION: Record<ErreurExploitation["code"], number> = { invalide: 400, introuvable: 404, refuse: 403, base: 500 };

export function reponseErreur(erreur: unknown): Response {
  if (erreur instanceof ErreurPlan) return json({ error: erreur.message, code: erreur.code, details: erreur.details }, STATUT_PLAN[erreur.code]);
  if (erreur instanceof ErreurExploitation) return json({ error: erreur.message, code: erreur.code }, STATUT_EXPLOITATION[erreur.code]);
  if (erreur instanceof ErreurMoteur) return json({ error: erreur.message, code: "invalide", details: erreur.details }, 400);
  if (erreur instanceof ErreurReferentiel) return json({ error: erreur.message, code: "referentiel" }, 422);
  console.error("[cultiplan] erreur inattendue", erreur);
  return json({ error: "Désolé, le service est temporairement indisponible.", code: "base" }, 500);
}

/**
 * Exécute une action authentifiée : 401 sans jeton ou jeton invalide, sinon le résultat en JSON
 * (204 si l'action ne renvoie rien), ou l'erreur traduite.
 */
export async function traiter(
  req: Request,
  action: (client: ClientBase) => Promise<unknown>,
  statutSucces = 200,
): Promise<Response> {
  const entete = req.headers.get("Authorization");
  if (!entete?.startsWith("Bearer ")) return json({ error: "Non autorisé", code: "non_authentifie" }, 401);
  const jeton = entete.slice("Bearer ".length).trim();
  let client: ClientBase | null;
  try {
    client = await fabriqueCourante(jeton);
  } catch (erreur) {
    console.error("[cultiplan] authentification impossible", erreur);
    return json({ error: "Service indisponible", code: "base" }, 503);
  }
  if (!client) return json({ error: "Jeton invalide", code: "non_authentifie" }, 401);
  try {
    const resultat = await action(client);
    return resultat === undefined ? new Response(null, { status: 204 }) : json(resultat, statutSucces);
  } catch (erreur) {
    return reponseErreur(erreur);
  }
}

/** Paramètres d'une route dynamique (Next 16 : une promesse). */
export type Parametres<T extends string> = { params: Promise<Record<T, string>> };
