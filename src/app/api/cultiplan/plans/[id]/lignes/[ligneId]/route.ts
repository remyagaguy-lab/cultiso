// PATCH  /api/cultiplan/plans/:id/lignes/:ligneId : corrige une ligne (elle passe en origine « utilisateur ») ; renvoie le plan recalculé.
// DELETE /api/cultiplan/plans/:id/lignes/:ligneId : retire la ligne ; renvoie le plan recalculé.
import { corrigerLigne, supprimerLigne, type CorrectionLigne } from "@/modules/cultiplan";
import { lireCorps, traiter, type Parametres } from "@/modules/cultiplan/http";

export async function PATCH(req: Request, { params }: Parametres<"id" | "ligneId">): Promise<Response> {
  const { id, ligneId } = await params;
  return traiter(req, async (client) => corrigerLigne(client, id, ligneId, (await lireCorps(req)) as CorrectionLigne));
}

export async function DELETE(req: Request, { params }: Parametres<"id" | "ligneId">): Promise<Response> {
  const { id, ligneId } = await params;
  return traiter(req, (client) => supprimerLigne(client, id, ligneId));
}
