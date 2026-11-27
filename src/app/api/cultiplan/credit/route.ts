// POST /api/cultiplan/credit : simulation de crédit par le moteur (rien n'est enregistré).
// Corps : { montant, tauxAnnuel, dureeMois, differeMois?, typeDiffere?, revenuMensuelNet? }.
import { calculerCredit, type EntreeCredit } from "@/moteurs";
import { lireCorps, traiter } from "@/modules/cultiplan/http";

export async function POST(req: Request): Promise<Response> {
  return traiter(req, async () => calculerCredit((await lireCorps(req)) as EntreeCredit));
}
