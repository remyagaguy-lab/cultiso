// GET /api/cultiplan/circuits : circuits de commercialisation du référentiel (code, libellé, contractuel, statut, source).
import { traiter } from "@/modules/cultiplan/http";
import { lireCircuits } from "@/referentiel/debouches";

export async function GET(req: Request): Promise<Response> {
  return traiter(req, async (client) => ({ circuits: await lireCircuits(client) }));
}
