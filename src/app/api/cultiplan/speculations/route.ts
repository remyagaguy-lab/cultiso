// GET /api/cultiplan/speculations?secteur=vegetal : catalogue des spéculations du référentiel.
import { traiter } from "@/modules/cultiplan/http";
import { lireSpeculations, type Speculation } from "@/referentiel";

export async function GET(req: Request): Promise<Response> {
  const secteur = new URL(req.url).searchParams.get("secteur") ?? undefined;
  return traiter(req, (client) => lireSpeculations(client, { secteur: secteur as Speculation["secteur"] | undefined }));
}
