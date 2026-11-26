/**
 * Embeddings de la recherche documentaire : modèle multilingue `intfloat/multilingual-e5-small` (384 dimensions,
 * même taille que la colonne actuelle). Les requêtes sont préfixées par « query: », les morceaux du corpus par « passage: ».
 *
 * Point d'accès : HuggingFace Inference Providers (`router.huggingface.co`). À vérifier au premier essai réel :
 * en cas d'échec, la recherche renvoie « aucune source » et Cultisia le dit, sans inventer.
 */
export const MODELE_EMBEDDING = "intfloat/multilingual-e5-small";
export const DIMENSION_EMBEDDING = 384;
const URL_EMBEDDING = `https://router.huggingface.co/hf-inference/models/${MODELE_EMBEDDING}/pipeline/feature-extraction`;

export interface Embeddeur {
  /** Vecteur d'une question, ou null si le service est indisponible. */
  requete(texte: string): Promise<number[] | null>;
}

export class EmbeddeurHuggingFace implements Embeddeur {
  constructor(
    private readonly cle: string | undefined,
    private readonly appeler: typeof fetch = fetch,
  ) {}

  async requete(texte: string): Promise<number[] | null> {
    if (!this.cle) return null;
    try {
      const reponse = await this.appeler(URL_EMBEDDING, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: `query: ${texte}`, normalize: true }),
      });
      if (!reponse.ok) {
        console.warn(`[cultisia] embeddings indisponibles (HTTP ${reponse.status})`);
        return null;
      }
      const resultat: unknown = await reponse.json();
      const vecteur = Array.isArray(resultat) && Array.isArray(resultat[0]) ? resultat[0] : resultat;
      if (!Array.isArray(vecteur) || vecteur.length !== DIMENSION_EMBEDDING || !vecteur.every((x) => typeof x === "number")) {
        console.warn("[cultisia] réponse d'embeddings inattendue");
        return null;
      }
      return vecteur as number[];
    } catch (erreur) {
      console.warn("[cultisia] appel d'embeddings en échec", erreur);
      return null;
    }
  }
}
