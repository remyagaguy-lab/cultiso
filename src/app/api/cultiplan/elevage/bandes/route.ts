// POST /api/cultiplan/elevage/bandes : atelier animal à bandes (M14).
// Corps : { speculation, variante?, bandes: [{ debutMois, effectif }], prix: { animal, aliment, produit, reforme }, chargesParSujetMois?,
//   chargesFixesMensuelles?, investissement?, apport?, dureeBandeMois?: { valeur, source }, joursParMois?: { valeur, source } }.
// Les courbes par âge viennent du référentiel (statut brouillon_ia tant qu'un expert ne les a pas validées) ; une courbe absente rend
// l'atelier « non évalué » avec la liste de ce qui manque. Rien n'est deviné.
import { simulerAtelierPourSpeculation } from "@/modules/cultiplan";
import { lireCorps, traiter } from "@/modules/cultiplan/http";

export async function POST(req: Request): Promise<Response> {
  return traiter(req, async (client) => simulerAtelierPourSpeculation(client, await lireCorps(req)));
}
