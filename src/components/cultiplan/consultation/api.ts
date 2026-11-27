import { createClient } from "@/lib/supabase/client";

export class ErreurApi extends Error {}

export type Appeler = <T>(chemin: string, init?: RequestInit) => Promise<T>;

/** Appel d'une route /api/cultiplan avec le jeton de l'utilisateur connecté. Les erreurs du serveur arrivent en phrases lisibles. */
export const appeler: Appeler = async <T>(chemin: string, init?: RequestInit): Promise<T> => {
  const { data } = await createClient().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new ErreurApi("Connecte-toi pour continuer ta consultation.");
  const reponse = await fetch(chemin, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${jeton}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const corps = (await reponse.json().catch(() => ({}))) as { error?: string };
  if (!reponse.ok) throw new ErreurApi(corps.error ?? "Une erreur est survenue. Réessaie dans un instant.");
  return corps as T;
};
