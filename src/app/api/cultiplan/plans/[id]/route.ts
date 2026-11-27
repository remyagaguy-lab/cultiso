// GET    /api/cultiplan/plans/:id : plan complet (lignes, hypothèses, financement, résultats du moteur).
// PATCH  /api/cultiplan/plans/:id : { titre?, statut?, hypotheses?, financement? } ; recalcule si besoin.
// DELETE /api/cultiplan/plans/:id : supprime le plan, propriétaire seulement (204).
import type { z } from "zod";
import { lirePlan, modifierPlan, supprimerPlan, type schemaModificationPlan } from "@/modules/cultiplan";
import { lireCorps, traiter, type Parametres } from "@/modules/cultiplan/http";

export async function GET(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(req, (client) => lirePlan(client, id));
}

export async function PATCH(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(req, async (client) => modifierPlan(client, id, (await lireCorps(req)) as z.input<typeof schemaModificationPlan>));
}

export async function DELETE(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(req, (client) => supprimerPlan(client, id));
}
