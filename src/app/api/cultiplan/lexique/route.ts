// GET /api/cultiplan/lexique[?format=md] : lexique des mots du plan d'affaires, en langage simple (S8).
// Texte public (aucune donnée du porteur) : pas d'authentification. Sert l'annexe du dossier exporté (S4, à faire) et l'aide en ligne.
import { lexique, lexiqueEnMarkdown } from "@/moteurs";

export function GET(req: Request): Response {
  if (new URL(req.url).searchParams.get("format") === "md") {
    return new Response(lexiqueEnMarkdown(), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  }
  return Response.json({ lexique: lexique() });
}
