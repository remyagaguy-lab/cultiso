/** @jest-environment node */
import { POST } from "@/app/api/cultiplan/exploitations/[id]/dimensionnement/route";
import { remplacerFabrique } from "../http";
import { fauxClientProfil } from "../test-utils/fausse-base-profil";

const requete = (corps: unknown, jeton: string | null = "jeton-valide") =>
  new Request("http://localhost/api/cultiplan/exploitations/exp-1/dimensionnement", {
    method: "POST",
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
    body: JSON.stringify(corps),
  });

describe("route du dimensionnement à rebours", () => {
  it("refuse sans jeton (401) et un corps invalide (400, avant toute lecture) : la source du débouché est obligatoire", async () => {
    const { client } = fauxClientProfil({ cultisos: [{ id: "exp-1", name: "Ferme", status: "projet", location: null, user_id: "u1" }], ateliers: [], contexte_terrain: [] });
    const precedente = remplacerFabrique(async (jeton) => (jeton === "jeton-valide" ? client : null));
    try {
      const params = { params: Promise.resolve({ id: "exp-1" }) };
      expect((await POST(requete({}, null), params)).status).toBe(401);
      const sansSource = await POST(requete({ speculation: "tomate", debouche: { volumeParMois: 100, moisParAn: 12, unite: "kg", origine: "marche", source: "" } }), params);
      expect(sansSource.status).toBe(400);
      expect((await sansSource.json()).details.join(" ")).toContain("source du débouché");
      expect((await POST(requete({ speculation: "tomate" }), params)).status).toBe(400);
    } finally {
      remplacerFabrique(precedente);
    }
  });
});
