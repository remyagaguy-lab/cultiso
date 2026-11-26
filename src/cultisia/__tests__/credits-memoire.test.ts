/** @jest-environment node */
import { CreditsEnMemoire, CreditsEpuises, SOLDE_INITIAL, soldeDepuisMetadonnees, verifierSolde } from "../credits";
import { derniereQuestion, fenetreGlissante, rattacherSession } from "../memoire";

describe("crédits", () => {
  it("offre le solde initial une seule fois : absent = 20 000, présent = valeur stockée", () => {
    expect(SOLDE_INITIAL).toBe(20000);
    expect(soldeDepuisMetadonnees(undefined)).toBe(20000);
    expect(soldeDepuisMetadonnees({})).toBe(20000);
    expect(soldeDepuisMetadonnees({ tokens_balance: 0 })).toBe(0);
    expect(soldeDepuisMetadonnees({ tokens_balance: -340 })).toBe(-340);
    expect(soldeDepuisMetadonnees({ tokens_balance: "1500" })).toBe(1500);
  });

  it("refuse à solde nul ou négatif, sans recharge", async () => {
    const credits = new CreditsEnMemoire(new Map([["u1", 0], ["u2", -10]]));
    await expect(verifierSolde(credits, "u1")).rejects.toBeInstanceOf(CreditsEpuises);
    await expect(verifierSolde(credits, "u2")).rejects.toBeInstanceOf(CreditsEpuises);
    expect(await credits.solde("u1")).toBe(0);
  });

  it("débite après usage", async () => {
    const credits = new CreditsEnMemoire(new Map([["u1", 500]]));
    expect(await verifierSolde(credits, "u1")).toBe(500);
    expect(await credits.debiter("u1", 700)).toBe(-200);
    await expect(verifierSolde(credits, "u1")).rejects.toBeInstanceOf(CreditsEpuises);
  });
});

describe("mémoire", () => {
  it("garde les derniers messages et commence par l'utilisateur", () => {
    const messages = [
      { role: "user" as const, content: "a" },
      { role: "assistant" as const, content: "b" },
      { role: "user" as const, content: "c" },
      { role: "assistant" as const, content: "d" },
    ];
    expect(fenetreGlissante(messages, 3)).toEqual([{ role: "user", content: "c" }, { role: "assistant", content: "d" }]);
    expect(fenetreGlissante(messages, 10)).toHaveLength(4);
  });

  it("écarte les messages vides et tronque les messages trop longs", () => {
    const fenetre = fenetreGlissante([
      { role: "user", content: "   " },
      { role: "user", content: "x".repeat(10000) },
    ]);
    expect(fenetre).toHaveLength(1);
    expect(fenetre[0].content).toHaveLength(8000);
  });

  it("trouve la dernière question", () => {
    expect(derniereQuestion([{ role: "user", content: "q1" }, { role: "assistant", content: "r" }])).toBe("q1");
    expect(derniereQuestion([])).toBe("");
  });

  it("rattache la session à l'exploitation et au module, sans bloquer en cas d'erreur", async () => {
    const appels: unknown[] = [];
    await rattacherSession({ rattacher: async (id, r) => void appels.push({ id, ...r }) }, "s1", "cultima", "exp-1");
    expect(appels).toEqual([{ id: "s1", exploitation_id: "exp-1", module: "cultima" }]);

    await rattacherSession({ rattacher: async () => void appels.push("ne doit pas") }, undefined, "cultima", "exp-1");
    expect(appels).toHaveLength(1);

    const espion = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      rattacherSession({ rattacher: async () => { throw new Error("RLS"); } }, "s2", "cultisia", undefined),
    ).resolves.toBeUndefined();
    espion.mockRestore();
  });
});
