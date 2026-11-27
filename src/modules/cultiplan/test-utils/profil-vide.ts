import { CHAMPS_PROFIL, type ProfilPorteur } from "../profil";

/** Profil sans aucune réponse, modifiable champ par champ dans les tests. */
export function ProfilPorteurVide(valeurs: Partial<Record<(typeof CHAMPS_PROFIL)[number], unknown>> = {}, reste: Partial<Omit<ProfilPorteur, "valeurs">> = {}): ProfilPorteur {
  return {
    existe: true,
    valeurs: { ...(Object.fromEntries(CHAMPS_PROFIL.map((c) => [c, null])) as ProfilPorteur["valeurs"]), ...valeurs },
    existant: [],
    credits: [],
    sansExistant: false,
    sansCredit: false,
    inconnus: [],
    ...reste,
  };
}
