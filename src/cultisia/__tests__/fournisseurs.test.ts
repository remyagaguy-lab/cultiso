/** @jest-environment node */
import type { MorceauModele } from "../llm/client";
import { ModeleCompatibleOpenAI } from "../llm/compatible-openai";
import { CATALOGUE, configurationModele } from "../llm/fournisseurs";

describe("choix du fournisseur de modèle", () => {
  it("garde OpenRouter par défaut", () => {
    const c = configurationModele({ OPENROUTER_API_KEY: "k" });
    expect(c.fournisseur.nom).toBe("openrouter");
    expect(c.modele).toBe("google/gemini-2.5-flash");
  });

  it("bascule sur Groq ou xAI, avec le modèle réglable", () => {
    expect(configurationModele({ CULTISIA_FOURNISSEUR: "groq", GROQ_API_KEY: "k" })).toMatchObject({
      modele: "llama-3.3-70b-versatile",
      fournisseur: { urlBase: "https://api.groq.com/openai/v1" },
    });
    expect(configurationModele({ CULTISIA_FOURNISSEUR: "XAI", XAI_API_KEY: "k", CULTISIA_MODEL: "grok-4" })).toMatchObject({
      modele: "grok-4",
      fournisseur: { urlBase: "https://api.x.ai/v1" },
    });
  });

  it("refuse un fournisseur inconnu ou une clé absente, avec un message clair", () => {
    expect(() => configurationModele({ CULTISIA_FOURNISSEUR: "mistral" })).toThrow(/CULTISIA_FOURNISSEUR inconnu/);
    expect(() => configurationModele({ CULTISIA_FOURNISSEUR: "groq", OPENROUTER_API_KEY: "k" })).toThrow(/GROQ_API_KEY/);
  });
});

/** Faux serveur SSE au format OpenAI : renvoie les morceaux donnés et mémorise le corps de la requête. */
function fauxServeur(morceaux: Record<string, unknown>[]) {
  const corps: Record<string, unknown>[] = [];
  const appeler = (async (_url: unknown, init?: { body?: unknown }) => {
    corps.push(JSON.parse(String(init?.body)));
    const texte = morceaux.map((m) => `data: ${JSON.stringify(m)}\n\n`).join("") + "data: [DONE]\n\n";
    return new Response(texte, { status: 200, headers: { "Content-Type": "text/event-stream" } });
  }) as typeof fetch;
  return { appeler, corps };
}

const morceau = (delta: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id: "c",
  object: "chat.completion.chunk",
  created: 0,
  model: "m",
  choices: [{ index: 0, delta, finish_reason: null }],
  ...extra,
});

async function lire(modele: ModeleCompatibleOpenAI): Promise<MorceauModele[]> {
  const sortie: MorceauModele[] = [];
  for await (const m of modele.generer({ modele: "m", messages: [{ role: "user", content: "q" }] })) sortie.push(m);
  return sortie;
}

describe("client compatible OpenAI", () => {
  it("Groq : pas de stream_options, consommation lue dans x_groq", async () => {
    const { appeler, corps } = fauxServeur([
      morceau({ content: "Bon" }),
      morceau({ content: "jour" }),
      { ...morceau({}), choices: [], x_groq: { usage: { total_tokens: 57 } } },
    ]);
    const sortie = await lire(new ModeleCompatibleOpenAI(CATALOGUE.groq, "k", appeler));
    expect(corps[0]).not.toHaveProperty("stream_options");
    expect(sortie).toEqual([
      { type: "texte", contenu: "Bon" },
      { type: "texte", contenu: "jour" },
      { type: "usage", jetons: 57 },
    ]);
  });

  it("xAI : demande la consommation en flux et transmet les appels d'outils", async () => {
    const { appeler, corps } = fauxServeur([
      morceau({ tool_calls: [{ index: 0, id: "a1", type: "function", function: { name: "lire_prix", arguments: '{"produits":' } }] }),
      morceau({ tool_calls: [{ index: 0, function: { arguments: '["maïs"]}' } }] }),
      { ...morceau({}), choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
    ]);
    const sortie = await lire(new ModeleCompatibleOpenAI(CATALOGUE.xai, "k", appeler));
    expect(corps[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(sortie).toEqual([
      { type: "appel_outil", index: 0, id: "a1", nom: "lire_prix", arguments: '{"produits":' },
      { type: "appel_outil", index: 0, id: undefined, nom: undefined, arguments: '["maïs"]}' },
      { type: "usage", jetons: 15 },
    ]);
  });
});
