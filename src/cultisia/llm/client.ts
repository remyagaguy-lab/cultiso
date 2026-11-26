/**
 * Accès au modèle de langage, interchangeable.
 * L'orchestrateur ne connaît que l'interface `ModeleLangage` ; les tests injectent un faux modèle.
 */

export interface MessageModele {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: AppelOutilModele[];
  tool_call_id?: string;
}

export interface AppelOutilModele {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface OutilModele {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface RequeteModele {
  modele: string;
  messages: MessageModele[];
  outils?: OutilModele[];
  temperature?: number;
}

/** Morceaux normalisés renvoyés par le modèle pendant le flux. */
export type MorceauModele =
  | { type: "texte"; contenu: string }
  | { type: "appel_outil"; index: number; id?: string; nom?: string; arguments?: string }
  | { type: "usage"; jetons: number };

export interface ModeleLangage {
  generer(requete: RequeteModele): AsyncIterable<MorceauModele>;
}

export const MODELE_PAR_DEFAUT = "google/gemini-2.5-flash";

export function modeleConfigure(): string {
  return process.env.CULTISIA_MODEL?.trim() || MODELE_PAR_DEFAUT;
}
