/** @jest-environment node */
import { CreditsEnMemoire, CreditsEpuises } from "../credits";
import { appel, FauxModele, texte, usage, type TourScripte } from "../llm/faux-modele";
import { lancerCultisia, MESSAGE_PLAFOND, type RequeteCultisia } from "../orchestrateur";
import { registreParDefaut } from "../outils";
import { fausseBase } from "../test-utils/fausse-base";
import { collecter, texteDe } from "../test-utils/utilitaires";

function preparer(tours: TourScripte[], soldes = new Map<string, number>()) {
  const modele = new FauxModele(tours);
  const credits = new CreditsEnMemoire(soldes);
  const dependances = { modele, registre: registreParDefaut(), credits, donnees: fausseBase(), nomModele: "faux/modele" };
  return { modele, credits, dependances };
}

const requete = (surcharge: Partial<RequeteCultisia> = {}): RequeteCultisia => ({
  module: "cultisia",
  utilisateurId: "u1",
  messages: [{ role: "user", content: "Comment lutter contre la chenille légionnaire ?" }],
  ...surcharge,
});

describe("orchestrateur Cultisia", () => {
  it("diffuse une réponse simple en flux puis débite la consommation réelle", async () => {
    const { modele, credits, dependances } = preparer([[texte("Bonjour, "), texte("voici."), usage(120)]]);
    const evenements = await collecter(await lancerCultisia(requete(), dependances));

    expect(texteDe(evenements)).toBe("Bonjour, voici.");
    expect(evenements.at(-1)).toEqual({ type: "done", jetons: 120, solde: 20000 - 120 });
    expect(credits.debits).toEqual([{ utilisateurId: "u1", jetons: 120 }]);

    const envoye = modele.requetes[0];
    expect(envoye.modele).toBe("faux/modele");
    expect(envoye.messages[0].role).toBe("system");
    expect(envoye.messages[1]).toEqual({ role: "user", content: "Comment lutter contre la chenille légionnaire ?" });
    expect(envoye.outils?.map((o) => o.function.name)).toContain("lire_prix");
  });

  it("exécute un outil de lecture, diffuse ses sources, puis relance le modèle avec le résultat", async () => {
    const { modele, dependances } = preparer([
      [appel("lire_prix", { produits: ["maïs"], lieu: "Lomé" }), usage(50)],
      [texte("Le maïs est à 350 FCFA/kg à Lomé (relevé du 20/11)."), usage(80)],
    ]);
    const evenements = await collecter(await lancerCultisia(requete(), dependances));

    const sources = evenements.find((e) => e.type === "sources");
    expect(sources).toEqual({
      type: "sources",
      sources: [{ file_name: "Cours des prix Cultiso : Maïs grain (2026-11-20)", origine: "prix", date: "2026-11-20" }],
    });
    expect(texteDe(evenements)).toContain("350 FCFA");
    expect(evenements.at(-1)).toMatchObject({ type: "done", jetons: 130 });

    const second = modele.requetes[1].messages;
    expect(second.at(-2)).toMatchObject({ role: "assistant", tool_calls: [{ function: { name: "lire_prix" } }] });
    expect(second.at(-1)).toMatchObject({ role: "tool", tool_call_id: "appel_lire_prix_0" });
    expect(second.at(-1)?.content).toContain("350 FCFA / kg ; lieu : Lomé, Adawlato ; date : 2026-11-20");
  });

  it("transforme un outil d'action en action_proposee, sans l'exécuter ni relancer le modèle", async () => {
    const { modele, dependances } = preparer([
      [appel("saisir_operation", { quantity: 4, unit_price: 18000, type: "expense", category: "Engrais" }), usage(40)],
    ]);
    const evenements = await collecter(
      await lancerCultisia(requete({ module: "cultima", messages: [{ role: "user", content: "J'ai acheté 4 sacs d'engrais à 18 000" }] }), dependances),
    );

    expect(evenements).toContainEqual({
      type: "action_proposee",
      outil: "saisir_operation",
      arguments: { amount: 72000, type: "expense", category: "Engrais", quantity: 4, unit_price: 18000 },
      message: expect.stringContaining("Enregistrer"),
    });
    expect(modele.requetes).toHaveLength(1);
    expect(evenements.at(-1)).toMatchObject({ type: "done" });
  });

  it("transforme ouvrir_module en orientation", async () => {
    const { dependances } = preparer([[appel("ouvrir_module", { module: "cultiplan", raison: "Cultiplan calcule ton budget." })]]);
    const evenements = await collecter(await lancerCultisia(requete(), dependances));
    expect(evenements).toContainEqual({ type: "orientation", module: "cultiplan", raison: "Cultiplan calcule ton budget." });
  });

  it("renvoie au modèle l'erreur d'un outil non permis, sans l'exécuter", async () => {
    const { modele, dependances } = preparer([
      [appel("saisir_operation", { amount: 1000, type: "expense", category: "x" })],
      [texte("Je ne peux pas enregistrer d'opération ici.")],
    ]);
    const evenements = await collecter(await lancerCultisia(requete({ module: "cultisia" }), dependances));
    expect(evenements.some((e) => e.type === "action_proposee")).toBe(false);
    expect(modele.requetes[1].messages.at(-1)?.content).toMatch(/^ERREUR : .*n'est pas disponible/);
  });

  it("renvoie au modèle les arguments invalides", async () => {
    const { modele, dependances } = preparer([[appel("lire_prix", { produits: [] })], [texte("Quel produit ?")]]);
    await collecter(await lancerCultisia(requete(), dependances));
    expect(modele.requetes[1].messages.at(-1)?.content).toMatch(/Arguments invalides pour lire_prix/);
  });

  it("assemble les arguments d'un appel d'outil reçus en plusieurs morceaux", async () => {
    const { dependances } = preparer([
      [
        { type: "appel_outil", index: 0, id: "c1", nom: "ouvrir_module", arguments: '{"module":"cult' },
        { type: "appel_outil", index: 0, arguments: 'ima","raison":"Pour ta trésorerie."}' },
      ],
    ]);
    const evenements = await collecter(await lancerCultisia(requete(), dependances));
    expect(evenements).toContainEqual({ type: "orientation", module: "cultima", raison: "Pour ta trésorerie." });
  });

  it("s'arrête au plafond de tours", async () => {
    const boucle = [appel("lire_referentiel", { type: "zone" })];
    const { modele, dependances } = preparer([boucle, boucle, boucle, boucle, boucle]);
    const evenements = await collecter(await lancerCultisia(requete(), { ...dependances, toursMax: 3 }));
    expect(modele.requetes).toHaveLength(3);
    expect(texteDe(evenements)).toBe(MESSAGE_PLAFOND);
    expect(evenements.at(-1)).toMatchObject({ type: "done" });
  });

  it("transforme une erreur du modèle en événement error et débite ce qui a été consommé", async () => {
    const { credits, dependances } = preparer([[appel("lire_referentiel", { type: "zone" }), usage(30)], new Error("OpenRouter 503")]);
    const evenements = await collecter(await lancerCultisia(requete(), dependances));
    expect(evenements.at(-1)).toEqual({ type: "error", content: expect.stringContaining("n'a pas pu répondre") });
    expect(evenements.some((e) => e.type === "done")).toBe(false);
    expect(credits.debits).toEqual([{ utilisateurId: "u1", jetons: 30 }]);
  });

  it("refuse avant tout appel au modèle quand le solde est épuisé", async () => {
    const { modele, dependances } = preparer([[texte("ne doit pas être appelé")]], new Map([["u1", 0]]));
    await expect(lancerCultisia(requete(), dependances)).rejects.toBeInstanceOf(CreditsEpuises);
    expect(modele.requetes).toHaveLength(0);
  });

  it("n'envoie au modèle que la fenêtre de mémoire, sans rôle system venu du client", async () => {
    const { modele, dependances } = preparer([[texte("ok")]]);
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `message ${i}`,
    }));
    await collecter(await lancerCultisia(requete({ messages }), dependances));
    const envoyes = modele.requetes[0].messages;
    expect(envoyes.filter((m) => m.role === "system")).toHaveLength(1);
    expect(envoyes.length).toBeLessThanOrEqual(21);
    expect(envoyes[1].role).toBe("user");
    expect(envoyes.at(-1)?.content).toBe("message 29");
  });
});
