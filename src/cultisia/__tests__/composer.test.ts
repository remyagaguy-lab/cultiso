/** @jest-environment node */
import { choisirExpertises, composerPrompt } from "../noyau/composer";
import { PROMPT_NOYAU } from "../noyau/prompt";

describe("composition du prompt", () => {
  it("prend l'expertise du module par défaut", () => {
    expect(choisirExpertises("cultisia", "Bonjour")).toEqual(["agronome"]);
    expect(choisirExpertises("cultiplan", "Bonjour")).toEqual(["agroeconomiste"]);
    expect(choisirExpertises("cultima", "Bonjour")).toEqual(["pilotage"]);
    expect(choisirExpertises("cours-des-prix", "Bonjour")).toEqual(["marche"]);
  });

  it("ajoute une seconde expertise selon la question, accents compris", () => {
    expect(choisirExpertises("cultisia", "Mes poulets pondeuses ont une forte mortalité")).toEqual(["agronome", "zootechnicien"]);
    expect(choisirExpertises("cultisia", "Quel est le prix du maïs au marché ?")).toEqual(["agronome", "marche"]);
    expect(choisirExpertises("cultima", "Comment sécher et stocker mon gari ?")).toEqual(["pilotage", "transformation"]);
  });

  it("n'ajoute jamais plus de deux expertises", () => {
    expect(choisirExpertises("cultisia", "prix du poulet, budget de la provende et séchage").length).toBeLessThanOrEqual(2);
  });

  it("contient le noyau, l'expertise et le contexte", () => {
    const { prompt, expertises } = composerPrompt({
      module: "cultima",
      question: "J'ai acheté de l'engrais",
      ecran: "Trésorerie",
      exploitation: { id: "exp-1", nom: "Ferme de Tsévié" },
    });
    expect(prompt.startsWith(PROMPT_NOYAU)).toBe(true);
    expect(prompt).toContain("EXPERTISE : PILOTAGE");
    expect(prompt).toContain("Écran : Trésorerie");
    expect(prompt).toContain("Ferme de Tsévié");
    expect(expertises[0]).toBe("pilotage");
  });

  it("ajoute le contrat de module transitoire quand il est fourni", () => {
    const { prompt } = composerPrompt({ module: "cultiplan", question: "x", contratModule: "FORMAT JSON v1.2" });
    expect(prompt).toContain("CONTRAT DE SORTIE DU MODULE\nFORMAT JSON v1.2");
    expect(prompt).toContain("Aucune exploitation active");
  });

  it("le noyau interdit le calcul de tête et les emojis", () => {
    expect(PROMPT_NOYAU).toMatch(/ne calcules jamais de tête/);
    expect(PROMPT_NOYAU).toMatch(/Aucun emoji/);
    expect(PROMPT_NOYAU).toMatch(/Une seule question à la fois/);
  });
});
