// GET /api/cultiplan/financeurs?organisme=ANPGF&produit=...&pays=TG : règles des financeurs (R11), avec leur statut et leur source.
import { traiter } from "@/modules/cultiplan/http";
import { lireReglesFinanceurs } from "@/referentiel";

export async function GET(req: Request): Promise<Response> {
  const p = new URL(req.url).searchParams;
  return traiter(req, (client) =>
    lireReglesFinanceurs(client, { organisme: p.get("organisme") ?? undefined, produit: p.get("produit") ?? undefined, pays: p.get("pays") ?? undefined }),
  );
}
