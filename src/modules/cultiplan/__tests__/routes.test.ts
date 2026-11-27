/** @jest-environment node */
import { POST as simulerCredit } from "@/app/api/cultiplan/credit/route";
import { GET as lirePlanRoute } from "@/app/api/cultiplan/plans/[id]/route";
import type { ClientBase } from "@/core/exploitation";
import { ErreurExploitation } from "@/core/exploitation";
import { ErreurMoteur } from "@/moteurs";
import { ErreurReferentiel } from "@/referentiel";
import { ErreurPlan } from "../erreurs";
import { remplacerFabrique, reponseErreur, traiter } from "../http";

const requete = (corps?: unknown, jeton: string | null = "jeton-valide") =>
  new Request("http://localhost/api/cultiplan/x", {
    method: "POST",
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
    body: corps === undefined ? undefined : typeof corps === "string" ? corps : JSON.stringify(corps),
  });

describe("couche HTTP de /api/cultiplan", () => {
  const fauxClient = {} as ClientBase;
  let precedente: ReturnType<typeof remplacerFabrique>;
  beforeAll(() => {
    precedente = remplacerFabrique(async (jeton) => (jeton === "jeton-valide" ? fauxClient : null));
  });
  afterAll(() => remplacerFabrique(precedente));

  it("refuse sans jeton ou avec un jeton invalide (401)", async () => {
    expect((await traiter(requete(undefined, null), async () => "ok")).status).toBe(401);
    expect((await traiter(requete(undefined, "faux"), async () => "ok")).status).toBe(401);
  });

  it("renvoie le résultat en JSON, ou 204 sans résultat", async () => {
    const ok = await traiter(requete(), async (client) => ({ memeClient: client === fauxClient }), 201);
    expect(ok.status).toBe(201);
    expect(await ok.json()).toEqual({ memeClient: true });
    expect((await traiter(requete(), async () => undefined)).status).toBe(204);
  });

  it("traduit les erreurs en statuts HTTP", async () => {
    const statut = (e: unknown) => reponseErreur(e).status;
    expect(statut(new ErreurPlan("figé", "fige"))).toBe(409);
    expect(statut(new ErreurPlan("x", "invalide"))).toBe(400);
    expect(statut(new ErreurPlan("x", "introuvable"))).toBe(404);
    expect(statut(new ErreurPlan("x", "refuse"))).toBe(403);
    expect(statut(new ErreurExploitation("x", "refuse"))).toBe(403);
    expect(statut(new ErreurMoteur("x", ["a"]))).toBe(400);
    expect(statut(new ErreurReferentiel("x"))).toBe(422);
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(statut(new Error("panne"))).toBe(500);
    spy.mockRestore();
  });

  it("POST /credit renvoie le calcul du moteur", async () => {
    const r = await simulerCredit(requete({ montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 12 }));
    expect(r.status).toBe(200);
    const corps = await r.json();
    expect(corps.mensualite).toBe(94560);
    expect(corps.echeancier).toHaveLength(12);
  });

  it("POST /credit refuse une entrée invalide ou illisible (400)", async () => {
    const invalide = await simulerCredit(requete({ montant: -5, tauxAnnuel: 0.24, dureeMois: 12 }));
    expect(invalide.status).toBe(400);
    expect((await invalide.json()).details.join(" ")).toContain("montant");
    expect((await simulerCredit(requete("{pas du json"))).status).toBe(400);
  });

  it("GET /plans/:id lit le paramètre de route", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
            order: () => ({ order: async () => ({ data: [], error: null }) }),
          }),
        }),
      }),
    } as unknown as ClientBase;
    remplacerFabrique(async () => client);
    const r = await lirePlanRoute(requete(), { params: Promise.resolve({ id: "plan-absent" }) });
    expect(r.status).toBe(404);
    remplacerFabrique(async (jeton) => (jeton === "jeton-valide" ? fauxClient : null));
  });
});

describe("route du profil du porteur", () => {
  it("refuse sans jeton (401) et renvoie un profil vide, ou 400 sur un champ invalide", async () => {
    const { GET, PATCH } = await import("@/app/api/cultiplan/exploitations/[id]/profil/route");
    const { fauxClientProfil } = await import("../test-utils/fausse-base-profil");
    const { client } = fauxClientProfil();
    const precedente = remplacerFabrique(async (jeton) => (jeton === "jeton-valide" ? client : null));
    try {
      const params = { params: Promise.resolve({ id: "exp-1" }) };
      expect((await GET(requete(undefined, null), params)).status).toBe(401);
      const vide = await GET(requete(), params);
      expect(vide.status).toBe(200);
      expect((await vide.json()).existe).toBe(false);
      const ecrit = await PATCH(requete({ epargneFcfa: 100000, eauSource: null }), params);
      expect(ecrit.status).toBe(200);
      expect(await ecrit.json()).toMatchObject({ existe: true, inconnus: ["eauSource"] });
      expect((await PATCH(requete({ epargneFcfa: -1 }), params)).status).toBe(400);
    } finally {
      remplacerFabrique(precedente);
    }
  });
});
