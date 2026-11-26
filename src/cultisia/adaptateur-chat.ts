/**
 * Adaptateur de l'ancienne route `/api/chat` : traduit l'ancien corps de requête vers le nouveau,
 * et les nouveaux événements vers ceux que `SharedChat` comprend aujourd'hui.
 * À supprimer quand l'interface appellera `/api/cultisia` directement.
 */
import type { EvenementCultisia } from "./evenements";
import { versModule } from "./modules";

interface CorpsHerite {
  messages?: unknown;
  message?: unknown;
  mode?: unknown;
  toolContext?: unknown;
}

/** Ancien corps `{ messages, mode, toolContext, model }` vers le nouveau. Le modèle demandé par le client est ignoré. */
export function corpsHeriteVersCultisia(brut: unknown): unknown {
  const corps = (typeof brut === "object" && brut !== null ? brut : {}) as CorpsHerite;
  const messages = Array.isArray(corps.messages)
    ? corps.messages
    : typeof corps.message === "string"
      ? [{ role: "user", content: corps.message }]
      : corps.messages;
  return { module: versModule(corps.toolContext ?? corps.mode), messages };
}

/** Nouveaux événements vers les événements hérités (noms d'outils et arguments attendus par SharedChat). */
export function versEvenementHerite(evenement: EvenementCultisia): EvenementCultisia {
  if (evenement.type === "orientation") {
    return {
      type: "tool_call_start",
      name: "route_to_tool",
      arguments: JSON.stringify({ target_tool: evenement.module, reason: evenement.raison }),
    };
  }
  if (evenement.type === "action_proposee" && evenement.outil === "saisir_operation") {
    return { type: "tool_call_start", name: "prepare_transaction", arguments: JSON.stringify(evenement.arguments) };
  }
  return evenement;
}

export async function* fluxHerite(flux: AsyncIterable<EvenementCultisia>): AsyncIterable<EvenementCultisia> {
  for await (const evenement of flux) yield versEvenementHerite(evenement);
}
