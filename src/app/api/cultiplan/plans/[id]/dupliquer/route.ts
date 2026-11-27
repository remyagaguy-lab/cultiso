// POST /api/cultiplan/plans/:id/dupliquer : variante « Et si ? » { titre? } en brouillon, calculée (201).
import { dupliquerPlan } from "@/modules/cultiplan";
import { lireCorps, traiter, type Parametres } from "@/modules/cultiplan/http";

export async function POST(req: Request, { params }: Parametres<"id">): Promise<Response> {
  const { id } = await params;
  return traiter(
    req,
    async (client) => {
      const corps = (await lireCorps(req)) as { titre?: string };
      return dupliquerPlan(client, id, corps.titre);
    },
    201,
  );
}
