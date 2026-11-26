/**
 * Fournisseurs de modèle compatibles avec l'API OpenAI, choisis par `CULTISIA_FOURNISSEUR`.
 * - openrouter (défaut) : clé OPENROUTER_API_KEY
 * - groq : clé GROQ_API_KEY (offre gratuite avec limites de débit)
 * - xai (Grok) : clé XAI_API_KEY
 * Le modèle se règle par `CULTISIA_MODEL` ; sinon, le modèle par défaut du fournisseur.
 */

export const FOURNISSEURS = ["openrouter", "groq", "xai"] as const;
export type NomFournisseur = (typeof FOURNISSEURS)[number];

export interface Fournisseur {
  nom: NomFournisseur;
  urlBase: string;
  variableCle: string;
  modeleParDefaut: string;
  /** Le fournisseur accepte `stream_options.include_usage` (consommation dans le dernier morceau). */
  usageEnFlux: boolean;
  entetes?: Record<string, string>;
}

export const CATALOGUE: Record<NomFournisseur, Fournisseur> = {
  openrouter: {
    nom: "openrouter",
    urlBase: "https://openrouter.ai/api/v1",
    variableCle: "OPENROUTER_API_KEY",
    modeleParDefaut: "google/gemini-2.5-flash",
    usageEnFlux: true,
    entetes: { "HTTP-Referer": "https://cultiso.com", "X-Title": "Cultiso" },
  },
  groq: {
    nom: "groq",
    urlBase: "https://api.groq.com/openai/v1",
    variableCle: "GROQ_API_KEY",
    modeleParDefaut: "openai/gpt-oss-120b",
    usageEnFlux: false,
  },
  xai: {
    nom: "xai",
    urlBase: "https://api.x.ai/v1",
    variableCle: "XAI_API_KEY",
    modeleParDefaut: "grok-3-mini",
    usageEnFlux: true,
  },
};

export interface ConfigurationModele {
  fournisseur: Fournisseur;
  cle: string;
  modele: string;
}

/** Lit la configuration dans l'environnement ; lève une erreur claire si elle est incomplète. */
export function configurationModele(env: Record<string, string | undefined> = process.env): ConfigurationModele {
  const demande = (env.CULTISIA_FOURNISSEUR ?? "openrouter").trim().toLowerCase();
  if (!(FOURNISSEURS as readonly string[]).includes(demande)) {
    throw new Error(`CULTISIA_FOURNISSEUR inconnu : « ${demande} » (attendu : ${FOURNISSEURS.join(", ")}).`);
  }
  const fournisseur = CATALOGUE[demande as NomFournisseur];
  const cle = env[fournisseur.variableCle]?.trim();
  if (!cle) throw new Error(`${fournisseur.variableCle} n'est pas définie sur le serveur (fournisseur ${fournisseur.nom}).`);
  return { fournisseur, cle, modele: env.CULTISIA_MODEL?.trim() || fournisseur.modeleParDefaut };
}
