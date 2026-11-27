/** @jest-environment node */
// listerMesPlans : plans visibles, avec le nom du projet. Client simulé.
import type { ClientBase } from "@/core/exploitation";
import { listerMesPlans } from "..";

const ligne = (id: string, cultiso_id: string) => ({
  id, cultiso_id, titre: `Plan ${id}`, version: 1, variante_de: null, statut: "brouillon", version_moteur: "1.7.0", calcule_le: null, updated_at: "2026-11-27T10:00:00Z",
});

function client(plans: unknown[], cultisos: unknown[], erreur?: string): ClientBase {
  const requete = (data: unknown[]) => {
    const r: Record<string, unknown> = {};
    for (const m of ["select", "order", "in"]) r[m] = () => r;
    r.then = (ok: (v: unknown) => unknown) => ok(erreur ? { data: null, error: { message: erreur } } : { data, error: null });
    return r;
  };
  return { from: (t: string) => requete(t === "plans" ? plans : cultisos) } as unknown as ClientBase;
}

describe("listerMesPlans", () => {
  it("joint le nom du projet à chaque plan", async () => {
    const r = await listerMesPlans(client([ligne("a", "e1"), ligne("b", "e2")], [{ id: "e1", name: "Ferme de Kara" }]));
    expect(r.map((p) => [p.id, p.exploitationNom])).toEqual([["a", "Ferme de Kara"], ["b", null]]);
    expect(r[0]).toMatchObject({ exploitationId: "e1", statut: "brouillon", majLe: "2026-11-27T10:00:00Z" });
  });

  it("sans plan, ne demande aucun nom de projet", async () => {
    expect(await listerMesPlans(client([], []))).toEqual([]);
  });

  it("une erreur de la base devient une erreur de plan lisible", async () => {
    await expect(listerMesPlans(client([], [], "boom"))).rejects.toThrow();
  });
});
