// GET /api/cultiplan/questions?secteurs=vegetal,animal : questions de terrain, dans l'ordre.
import { traiter } from "@/modules/cultiplan/http";
import { lireQuestionsTerrain } from "@/referentiel";

export async function GET(req: Request): Promise<Response> {
  const brut = new URL(req.url).searchParams.get("secteurs");
  const secteurs = brut ? brut.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  return traiter(req, (client) => lireQuestionsTerrain(client, secteurs));
}
