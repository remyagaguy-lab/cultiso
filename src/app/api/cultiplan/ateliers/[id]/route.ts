// DELETE /api/cultiplan/ateliers/:id : retire un atelier (204). Les lignes de plan déjà générées restent.
import { supprimerAtelier } from "@/core/exploitation";
import { traiter, type Parametres } from "@/modules/cultiplan/http";

export async function DELETE(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(req, (client) => supprimerAtelier(client, id));
}
