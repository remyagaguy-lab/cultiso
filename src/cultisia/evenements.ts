/**
 * Contrat d'événements entre le serveur Cultisia et l'interface (flux SSE).
 *
 * Événements hérités (compris par SharedChat aujourd'hui) :
 *   sources, token, tool_call_start, tool_call_delta, done, error
 * Événements nouveaux (route /api/cultisia) :
 *   action_proposee : une action que l'utilisateur doit confirmer ; rien n'est enregistré côté serveur
 *   orientation     : Cultisia propose d'ouvrir un autre module
 */
import type { Module } from "./modules";

export interface Source {
  /** Libellé affiché (nom compris par l'interface actuelle). */
  file_name: string;
  /** Origine de la donnée : base de prix, exploitation, référentiel, document, moteur de calcul. */
  origine?: "prix" | "exploitation" | "referentiel" | "savoir" | "moteur";
  /** Date de la donnée, si elle est connue (AAAA-MM-JJ). */
  date?: string;
}

export type EvenementCultisia =
  | { type: "sources"; sources: Source[] }
  | { type: "token"; content: string }
  | { type: "tool_call_start"; name: string; arguments: string }
  | { type: "tool_call_delta"; arguments: string }
  | { type: "action_proposee"; outil: string; arguments: Record<string, unknown>; message: string }
  | { type: "orientation"; module: Module; raison: string }
  | { type: "done"; jetons?: number; solde?: number }
  | { type: "error"; content: string };

/** Sérialise un événement au format SSE (`data: {...}\n\n`). */
export function encoderSSE(evenement: EvenementCultisia): string {
  return `data: ${JSON.stringify(evenement)}\n\n`;
}

/** Transforme un flux d'événements en corps de réponse SSE. */
export function fluxSSE(evenements: AsyncIterable<EvenementCultisia>): ReadableStream<Uint8Array> {
  const encodeur = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controleur) {
      try {
        for await (const evenement of evenements) {
          controleur.enqueue(encodeur.encode(encoderSSE(evenement)));
        }
      } catch {
        controleur.enqueue(encodeur.encode(encoderSSE({ type: "error", content: "Erreur de génération" })));
      }
      controleur.close();
    },
  });
}

export const ENTETES_SSE = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;
