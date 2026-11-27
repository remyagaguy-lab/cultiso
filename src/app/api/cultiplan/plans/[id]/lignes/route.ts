// POST /api/cultiplan/plans/:id/lignes : ajoute une ligne saisie par l'utilisateur (origine « utilisateur ») ; renvoie le plan recalculé (201).
import { ajouterLigne, type NouvelleLigne } from "@/modules/cultiplan";
import { lireCorps, traiter, type Parametres } from "@/modules/cultiplan/http";

export async function POST(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(req, async (client) => ajouterLigne(client, id, (await lireCorps(req)) as NouvelleLigne), 201);
}
