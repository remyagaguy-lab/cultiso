// Faux client Supabase en mémoire, juste assez pour lire et écrire le profil du porteur dans les tests.
import type { ClientBase } from "@/core/exploitation";

type Rangee = Record<string, unknown>;

export function fauxClientProfil(initial: Record<string, Rangee[]> = {}, erreurs: Record<string, { code: string; message: string }> = {}) {
  const tables: Record<string, Rangee[]> = {
    profil_porteur: [],
    profil_existant: [],
    profil_credits: [],
    ...initial,
  };
  let sequence = 0;

  const from = (nom: string) => {
    const erreur = erreurs[nom] ?? null;
    const lignes = () => tables[nom];
    const lecture = (filtres: [string, unknown][]) => lignes().filter((l) => filtres.every(([c, v]) => l[c] === v));
    const select = () => {
      const filtres: [string, unknown][] = [];
      const resultat = () => ({ data: erreur ? null : lecture(filtres), error: erreur });
      const chaine = {
        eq(c: string, v: unknown) {
          filtres.push([c, v]);
          return chaine;
        },
        order: () => chaine,
        maybeSingle: async () => ({ data: erreur ? null : (lecture(filtres)[0] ?? null), error: erreur }),
        then: (ok: (r: ReturnType<typeof resultat>) => unknown) => Promise.resolve(resultat()).then(ok),
      };
      return chaine;
    };
    return {
      select,
      upsert: async (ligne: Rangee, options: { onConflict: string }) => {
        if (erreur) return { error: erreur };
        const cle = options.onConflict;
        const i = lignes().findIndex((l) => l[cle] === ligne[cle]);
        if (i >= 0) lignes()[i] = { ...lignes()[i], ...ligne };
        else lignes().push({ ...ligne });
        return { error: null };
      },
      insert: async (nouvelles: Rangee | Rangee[]) => {
        if (erreur) return { error: erreur };
        for (const n of Array.isArray(nouvelles) ? nouvelles : [nouvelles]) lignes().push({ id: `id-${++sequence}`, ...n });
        return { error: null };
      },
      delete: () => ({
        eq: async (c: string, v: unknown) => {
          if (erreur) return { error: erreur };
          tables[nom] = lignes().filter((l) => l[c] !== v);
          return { error: null };
        },
      }),
    };
  };
  return { client: { from } as unknown as ClientBase, tables };
}
