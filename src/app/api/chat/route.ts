/**
 * Ancienne route de Cultisia, conservée pour l'interface actuelle (SharedChat).
 * Simple adaptateur : elle appelle le nouveau cœur (src/cultisia) et renvoie les mêmes événements qu'avant.
 */
import { corpsHeriteVersCultisia, fluxHerite } from "@/cultisia/adaptateur-chat";
import { traiterCultisia } from "@/cultisia/serveur";

export async function POST(req: Request): Promise<Response> {
  return traiterCultisia(req, corpsHeriteVersCultisia, { transformer: fluxHerite });
}
