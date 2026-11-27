// POST /api/cultiplan/plans/:id/financement : financement complet du plan (M6), calculé à la demande, rien n'est enregistré.
// Corps : { horizonMois?, apportEspeces?, apportsNature?[{ libelle, valeur, piece? }], prets?[{ id, libelle, moisTirage?, credit }],
//   creditsCampagne?[{ id, libelle, tauxAnnuel, plafond?{ montant, source }, baremeDe?{ speculationCode, tailleAtelier, organisme? }, campagnes[] }],
//   creditsChaine?[...], subventions?[...], taxeInterets?{ taux, nom, source } }.
// Réponse : { planId, financement (mois[], annees[], planInitial, planAnnuel, apport, controles[], lecture[]), origines[], manques[] }.
import { financerPlan } from "@/modules/cultiplan/financement";
import { lireCorps, traiter, type Parametres } from "@/modules/cultiplan/http";

export async function POST(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(req, async (client) => financerPlan(client, id, await lireCorps(req)));
}
