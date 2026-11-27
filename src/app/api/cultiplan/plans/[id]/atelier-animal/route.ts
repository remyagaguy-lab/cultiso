// POST /api/cultiplan/plans/:id/atelier-animal : raccorde un atelier animal à bandes ou un cheptel au plan (plan en brouillon), puis recalcule.
// Corps : { type: "bandes", nom, speculation, atelierId?, decalageMois?, dureeVieInvestissement?: { valeur, source }, ...paramètres de /elevage/bandes }
//      ou { type: "troupeau", nom, atelierId?, decalageMois?, ...paramètres de /elevage/troupeau }.
// Raccorder à nouveau le même `nom` remplace ses lignes. Réponse : { statut, plan, lignes, dureeVie, manques, avertissements, simulation } ;
// statut "non_evalue" (courbes ou durées sans source) : le plan n'est pas touché.
import { raccorderAtelierAuPlan } from "@/modules/cultiplan/atelier-plan";
import { lireCorps, traiter, type Parametres } from "@/modules/cultiplan/http";

export async function POST(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(req, async (client) => raccorderAtelierAuPlan(client, id, await lireCorps(req)));
}
