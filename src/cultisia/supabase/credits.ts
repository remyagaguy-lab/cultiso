/**
 * Crédits stockés dans `auth.users.raw_app_meta_data.tokens_balance`.
 * Lecture et débit avec la clé de service, côté serveur uniquement ; le débit passe par la fonction
 * SQL `debiter_credits`, atomique et réservée au rôle serveur.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { soldeDepuisMetadonnees, type ServiceCredits } from "../credits";

export class CreditsSupabase implements ServiceCredits {
  constructor(private readonly admin: SupabaseClient) {}

  async solde(utilisateurId: string): Promise<number> {
    const { data, error } = await this.admin.auth.admin.getUserById(utilisateurId);
    if (error || !data.user) throw error ?? new Error("Utilisateur introuvable");
    return soldeDepuisMetadonnees(data.user.app_metadata);
  }

  async debiter(utilisateurId: string, jetons: number): Promise<number> {
    const { data, error } = await this.admin.rpc("debiter_credits", { p_user_id: utilisateurId, p_montant: Math.ceil(jetons) });
    if (error) throw error;
    return Number(data);
  }
}
