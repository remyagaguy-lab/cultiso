/**
 * Implémentation de `ModeleLangage` pour tout fournisseur compatible avec l'API OpenAI
 * (OpenRouter, Groq, xAI), via le SDK `openai`. Seul fichier de Cultisia qui parle au réseau du fournisseur.
 */
import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import type { ModeleLangage, MorceauModele, RequeteModele } from "./client";
import { configurationModele, type Fournisseur } from "./fournisseurs";

/** Consommation renvoyée par Groq dans une extension du dernier morceau. */
interface MorceauAvecUsageGroq {
  x_groq?: { usage?: { total_tokens?: number } };
}

export class ModeleCompatibleOpenAI implements ModeleLangage {
  private readonly client: OpenAI;

  constructor(
    private readonly fournisseur: Fournisseur,
    cleApi: string,
    appeler?: typeof fetch,
  ) {
    this.client = new OpenAI({
      baseURL: fournisseur.urlBase,
      apiKey: cleApi,
      defaultHeaders: fournisseur.entetes,
      ...(appeler ? { fetch: appeler } : {}),
    });
  }

  async *generer(requete: RequeteModele): AsyncIterable<MorceauModele> {
    const parametres = {
      model: requete.modele,
      messages: requete.messages,
      temperature: requete.temperature ?? 0.3,
      stream: true,
      ...(this.fournisseur.usageEnFlux ? { stream_options: { include_usage: true } } : {}),
      ...(requete.outils && requete.outils.length > 0 ? { tools: requete.outils } : {}),
    } as ChatCompletionCreateParamsStreaming;

    const flux = await this.client.chat.completions.create(parametres);

    for await (const morceau of flux) {
      const jetons = morceau.usage?.total_tokens ?? (morceau as MorceauAvecUsageGroq).x_groq?.usage?.total_tokens;
      if (jetons) yield { type: "usage", jetons };

      const delta = morceau.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) yield { type: "texte", contenu: delta.content };
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

/** Crée le modèle configuré par l'environnement et renvoie aussi le nom du modèle à demander. */
export function creerModeleConfigure(): { modele: ModeleCompatibleOpenAI; nomModele: string } {
  const configuration = configurationModele();
  return { modele: new ModeleCompatibleOpenAI(configuration.fournisseur, configuration.cle), nomModele: configuration.modele };
}
