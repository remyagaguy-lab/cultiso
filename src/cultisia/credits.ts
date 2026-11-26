/**
 * Crédits de Cultisia (en jetons du modèle).
 * - Solde vérifié AVANT l'appel : refus clair s'il est épuisé, sans appeler le modèle.
 * - Débit APRÈS l'appel, selon la consommation réelle.
 * - Aucune recharge automatique. 20 000 jetons offerts une seule fois (solde absent = jamais débité).
 */

export const SOLDE_INITIAL = 20000;

export class CreditsEpuises extends Error {
  constructor(readonly solde: number) {
    super("Tes crédits Cultisia sont épuisés.");
    this.name = "CreditsEpuises";
  }
}

export interface ServiceCredits {
  solde(utilisateurId: string): Promise<number>;
  /** Débite et renvoie le nouveau solde. */
  debiter(utilisateurId: string, jetons: number): Promise<number>;
}

/** Lit le solde stocké dans `app_metadata.tokens_balance` ; absent = solde initial offert. */
export function soldeDepuisMetadonnees(metadonnees: Record<string, unknown> | undefined | null): number {
  const valeur = metadonnees?.tokens_balance;
  if (typeof valeur === "number" && Number.isFinite(valeur)) return valeur;
  if (typeof valeur === "string" && valeur.trim() !== "" && Number.isFinite(Number(valeur))) return Number(valeur);
  return SOLDE_INITIAL;
}

export async function verifierSolde(credits: ServiceCredits, utilisateurId: string): Promise<number> {
  const solde = await credits.solde(utilisateurId);
  if (solde <= 0) throw new CreditsEpuises(solde);
  return solde;
}

/** Fausse implémentation en mémoire, pour les tests et le développement sans base. */
export class CreditsEnMemoire implements ServiceCredits {
  readonly debits: { utilisateurId: string; jetons: number }[] = [];
  constructor(private readonly soldes: Map<string, number> = new Map()) {}

  async solde(utilisateurId: string): Promise<number> {
    return this.soldes.get(utilisateurId) ?? SOLDE_INITIAL;
  }

  async debiter(utilisateurId: string, jetons: number): Promise<number> {
    const nouveau = (await this.solde(utilisateurId)) - jetons;
    this.soldes.set(utilisateurId, nouveau);
    this.debits.push({ utilisateurId, jetons });
    return nouveau;
  }
}
