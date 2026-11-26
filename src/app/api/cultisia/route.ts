/**
 * Point d'entrée unique de Cultisia.
 * Corps : { module, ecran?, exploitationId?, sessionId?, messages } ; réponse : flux SSE (voir src/cultisia/evenements.ts).
 * 401 sans jeton valide, 400 si le corps est invalide, 402 si les crédits sont épuisés.
 */
import { traiterCultisia } from "@/cultisia/serveur";

export async function POST(req: Request): Promise<Response> {
  return traiterCultisia(req, (brut) => brut);
}
