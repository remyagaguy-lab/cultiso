/**
 * Mémoire de conversation : fenêtre glissante des derniers messages, rattachement de la session
 * à l'exploitation et au module.
 */
import { z } from "zod";
import type { MessageModele } from "./llm/client";
import type { Module } from "./modules";

export const TAILLE_FENETRE = 20;
const LONGUEUR_MAX_MESSAGE = 8000;

/** Message tel qu'il arrive de l'interface. Les rôles `system` et `tool` sont refusés. */
export const schemaMessageClient = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type MessageClient = z.infer<typeof schemaMessageClient>;

/**
 * Garde les `taille` derniers messages, dans l'ordre, et commence toujours par un message de l'utilisateur.
 * Les messages vides sont écartés et les messages trop longs tronqués.
 */
export function fenetreGlissante(messages: MessageClient[], taille = TAILLE_FENETRE): MessageModele[] {
  const utiles = messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content.slice(0, LONGUEUR_MAX_MESSAGE) }));
  let fenetre = utiles.slice(-taille);
  while (fenetre.length > 0 && fenetre[0].role !== "user") fenetre = fenetre.slice(1);
  return fenetre;
}

export function derniereQuestion(messages: MessageClient[]): string {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i].content;
  return "";
}

/** Écriture minimale nécessaire au rattachement (client Supabase avec le jeton de l'utilisateur). */
export interface StockageSessions {
  rattacher(sessionId: string, rattachement: { exploitation_id: string | null; module: Module }): Promise<void>;
}

/** Rattache une session à l'exploitation active et au module. Une erreur n'interrompt pas la conversation. */
export async function rattacherSession(
  stockage: StockageSessions,
  sessionId: string | undefined,
  module: Module,
  exploitationId: string | undefined,
): Promise<void> {
  if (!sessionId) return;
  try {
    await stockage.rattacher(sessionId, { exploitation_id: exploitationId ?? null, module });
  } catch (erreur) {
    console.error("[cultisia] rattachement de session impossible", erreur);
  }
}
