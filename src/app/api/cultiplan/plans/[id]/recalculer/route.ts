// POST /api/cultiplan/plans/:id/recalculer : recalcule le plan avec la version actuelle des moteurs.
import { recalculer } from "@/modules/cultiplan";
import { traiter, type Parametres } from "@/modules/cultiplan/http";

export async function POST(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(req, (client) => recalculer(client, id));
}
