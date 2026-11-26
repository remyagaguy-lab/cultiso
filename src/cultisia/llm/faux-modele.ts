/**
 * Faux modèle de langage pour les tests : rejoue des tours scriptés, sans réseau ni crédit.
 * Chaque appel à `generer` consomme le tour suivant et mémorise la requête reçue.
 */
import type { ModeleLangage, MorceauModele, RequeteModele } from "./client";

export type TourScripte = MorceauModele[] | Error;

export class FauxModele implements ModeleLangage {
  readonly requetes: RequeteModele[] = [];
  private tour = 0;

  constructor(private readonly tours: TourScripte[]) {}

  async *generer(requete: RequeteModele): AsyncIterable<MorceauModele> {
    this.requetes.push(structuredClone(requete));
    const script = this.tours[this.tour++];
    if (script === undefined) throw new Error(`FauxModele : aucun tour scripté n°${this.tour}`);
    if (script instanceof Error) throw script;
    for (const morceau of script) yield morceau;
  }
}

/** Raccourcis pour écrire les scripts. */
export const texte = (contenu: string): MorceauModele => ({ type: "texte", contenu });
export const usage = (jetons: number): MorceauModele => ({ type: "usage", jetons });
export const appel = (nom: string, args: Record<string, unknown> | string, index = 0): MorceauModele => ({
  type: "appel_outil",
  index,
  id: `appel_${nom}_${index}`,
  nom,
  arguments: typeof args === "string" ? args : JSON.stringify(args),
});
