// Règles communes des moteurs de calcul de Cultiso.
// Code pur : aucune base, aucun réseau, aucune IA, aucune date « du jour ».
// Montants en FCFA, calculés en décimal, arrondis à l'unité seulement en sortie. Taux en décimal (0.24 = 24 %).
import type { z } from "zod";

/** Version des moteurs, enregistrée avec chaque résultat pour savoir avec quoi un plan a été calculé. */
export const VERSION_MOTEURS = "1.6.0";

/** Erreur levée quand l'entrée d'un moteur est invalide. Le message est en français et lisible par l'utilisateur. */
export class ErreurMoteur extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ErreurMoteur";
  }
}

/** Valide une entrée avec son schéma ; lève une ErreurMoteur qui liste les champs fautifs. */
export function valider<S extends z.ZodType>(schema: S, entree: unknown, moteur: string): z.infer<S> {
  const resultat = schema.safeParse(entree);
  if (!resultat.success) {
    const details = resultat.error.issues.map((i) => `${i.path.join(".") || "entrée"} : ${i.message}`);
    throw new ErreurMoteur(`Entrée invalide pour le moteur ${moteur}.`, details);
  }
  return resultat.data;
}

/** Arrondi d'un montant à l'unité (FCFA). */
export function fcfa(montant: number): number {
  const arrondi = Math.round(montant);
  return Object.is(arrondi, -0) ? 0 : arrondi;
}

/** Arrondi d'un taux à 4 décimales (0,1234 = 12,34 %). */
export function taux(valeur: number): number {
  return Math.round(valeur * 10_000) / 10_000;
}

export function somme(valeurs: readonly number[]): number {
  return valeurs.reduce((total, v) => total + v, 0);
}
