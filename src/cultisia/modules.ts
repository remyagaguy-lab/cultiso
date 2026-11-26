/**
 * Modules de Cultiso dans lesquels Cultisia peut être appelée.
 * Le module détermine les expertises par défaut et les outils permis.
 */
export const MODULES = ["cultisia", "cultiplan", "cultima", "cultiseil", "cours-des-prix"] as const;

export type Module = (typeof MODULES)[number];

export function estModule(valeur: unknown): valeur is Module {
  return typeof valeur === "string" && (MODULES as readonly string[]).includes(valeur);
}

/** Convertit une valeur libre (ancien `toolContext`, paramètre d'URL) en module connu. */
export function versModule(valeur: unknown): Module {
  if (estModule(valeur)) return valeur;
  if (valeur === "cultishop") return "cours-des-prix";
  return "cultisia";
}
