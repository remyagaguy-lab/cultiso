/**
 * Implémentation de `ModeleLangage` via OpenRouter (SDK `openai`).
 * Seul fichier de Cultisia qui parle au réseau du fournisseur de modèle.
 */
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import type { ModeleLangage, MorceauModele, RequeteModele } from "./client";

export class ModeleOpenRouter implements ModeleLangage {
  private readonly client: OpenAI;

  constructor(cleApi: string) {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: cleApi,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://cultiso.com",
        "X-Title": "Cultiso",
      },
    });
  }

  async *generer(requete: RequeteModele): AsyncIterable<MorceauModele> {
    const parametres = {
      model: requete.modele,
      messages: requete.messages,
      temperature: requete.temperature ?? 0.3,
      stream: true,
      stream_options: { include_usage: true },
      ...(requete.outils && requete.outils.length > 0 ? { tools: requete.outils } : {}),
    } as ChatCompletionCreateParamsStreaming;

    const flux = await this.client.chat.completions.create(parametres);

    for await (const morceau of flux) {
      if (morceau.usage?.total_tokens) {
        yield { type: "usage", jetons: morceau.usage.total_tokens };
      }
      const delta = morceau.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        yield { type: "texte", contenu: delta.content };
      }
      for (const appel of delta.tool_calls ?? []) {
        yield {
          type: "appel_outil",
          index: appel.index,
          id: appel.id,
          nom: appel.function?.name,
          arguments: appel.function?.arguments,
        };
      }
    }
  }
}

export function creerModeleOpenRouter(): ModeleOpenRouter {
  const cle = process.env.OPENROUTER_API_KEY;
  if (!cle) throw new Error("OPENROUTER_API_KEY n'est pas définie sur le serveur.");
  return new ModeleOpenRouter(cle);
}
