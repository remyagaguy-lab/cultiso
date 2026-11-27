// GET /api/cultiplan/plans : tous les plans de l'utilisateur (résumés, avec le nom du projet), du plus récent au plus ancien.
import { listerMesPlans } from "@/modules/cultiplan";
import { traiter } from "@/modules/cultiplan/http";

export async function GET(req: Request): Promise<Response> {
  return traiter(req, (client) => listerMesPlans(client));
}
