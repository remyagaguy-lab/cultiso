/** @jest-environment node */
// Route de lecture du lexique (S8) : publique, en JSON ou en Markdown pour l'annexe du dossier.
import { GET } from "@/app/api/cultiplan/lexique/route";

describe("GET /api/cultiplan/lexique", () => {
  it("renvoie le lexique en JSON, trié, sans authentification", async () => {
    const r = GET(new Request("http://x/api/cultiplan/lexique"));
    expect(r.status).toBe(200);
    const { lexique } = (await r.json()) as { lexique: { terme: string; definition: string }[] };
    expect(lexique.length).toBeGreaterThan(5);
    expect(lexique.map((e) => e.terme)).toEqual([...lexique.map((e) => e.terme)].sort((a, b) => a.localeCompare(b, "fr")));
    expect(lexique.some((e) => e.terme === "Intensifier")).toBe(true);
  });

  it("renvoie le Markdown de l'annexe avec ?format=md", async () => {
    const r = GET(new Request("http://x/api/cultiplan/lexique?format=md"));
    expect(r.headers.get("Content-Type")).toMatch(/markdown/);
    const texte = await r.text();
    expect(texte.startsWith("# Lexique")).toBe(true);
    expect(texte).toMatch(/- \*\*Intensifier\*\* : /);
  });
});
