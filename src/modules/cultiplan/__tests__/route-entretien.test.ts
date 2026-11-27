/** @jest-environment node */
import { POST } from "@/app/api/cultiplan/exploitations/[id]/entretien/route";
import { lireEntretien } from "@/referentiel";
import { remplacerFabrique } from "../http";
import { entretienDeDepart } from "../test-utils/entretien-depart";
import { fauxClientProfil } from "../test-utils/fausse-base-profil";

jest.mock("@/referentiel", () => ({ ...jest.requireActual("@/referentiel"), lireEntretien: jest.fn() }));

const requete = (corps: unknown, jeton: string | null = "jeton-valide") =>
  new Request("http://localhost/api/cultiplan/exploitations/exp-1/entretien", {
    method: "POST",
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
    body: JSON.stringify(corps),
  });

describe("route de l'entretien de cadrage", () => {
  it("refuse sans jeton (401), refuse une réponse invalide (400), enregistre puis renvoie la prochaine question et le point", async () => {
    const { client } = fauxClientProfil({ cultisos: [{ id: "exp-1", name: "Ferme", status: "projet", location: null, user_id: "u1" }], ateliers: [], contexte_terrain: [] });
    (lireEntretien as jest.Mock).mockResolvedValue(entretienDeDepart());
    const precedente = remplacerFabrique(async (jeton) => (jeton === "jeton-valide" ? client : null));
    try {
      const params = { params: Promise.resolve({ id: "exp-1" }) };
      expect((await POST(requete({ reponses: [{ question: "idee", valeur: "des tomates" }] }, null), params)).status).toBe(401);
      expect((await POST(requete({ reponses: [{ question: "marche_acheteur", valeur: "oui peut-etre" }] }), params)).status).toBe(400);
      const ok = await POST(requete({ reponses: [{ question: "idee", valeur: "des tomates" }, { question: "avancement", neSaitPas: true }] }), params);
      expect(ok.status).toBe(200);
      const corps = await ok.json();
      expect(corps.prochaine.question.cle).toBe("finalites");
      expect(corps.point.dimensions).toHaveLength(7);
    } finally {
      remplacerFabrique(precedente);
    }
  });
});
