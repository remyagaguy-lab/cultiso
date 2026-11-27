// POST /api/cultiplan/elevage/troupeau : cheptel en flux (M14, ruminants).
// Corps : { horizonMois, categories: [{ code, libelle?, effectifInitial }], mouvements: [{ mois, categorie, type, effectif, prixUnitaire? }] }
// avec type parmi naissance, achat, don_recu, confiage_recu (entrées) et mortalite, vente, autoconsommation, don_donne, vol_perte (sorties).
// Réponse : par catégorie et par mois, l'effectif de début, les entrées, les sorties, l'effectif de fin et le croît ; la trésorerie des achats et des ventes.
import { suivreCheptel } from "@/modules/cultiplan";
import { lireCorps, traiter } from "@/modules/cultiplan/http";

export async function POST(req: Request): Promise<Response> {
  return traiter(req, async () => suivreCheptel(await lireCorps(req)));
}
