/**
 * Accès aux données de Cultisia via Supabase, avec le jeton de l'utilisateur : les droits (RLS) de la base s'appliquent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErreurExploitation, lireExploitation, type ClientBase } from "@/core/exploitation";
import type { EntreeBudget } from "@/moteurs";
import { chargerEtat, type EtatEntretien } from "@/modules/cultiplan/entretien";
import { lireVariantesElevage, type VarianteElevage } from "@/referentiel/elevage";
import { deduireDuProfil, lireProfil, type ApportDuProfil, type ProfilPorteur } from "@/modules/cultiplan/profil";
import { preparerEntreeBudget } from "@/modules/cultiplan/service";
import { lireEntretien, lireReglesFinanceurs as lireReglesFinanceursRef, lireSpeculations, type Entretien, type RegleFinanceurRef } from "@/referentiel";
import type { AccesDonnees, AtelierSimule, Culture, ExtraitSavoir, LignePrix, ResumeExploitation, Sol, SpeculationRef, Zone } from "../donnees";
import type { Embeddeur } from "./embeddings";

const SEUIL_SIMILARITE = 0.75;

interface LignePrixBase {
  product_name: string;
  price: number | string;
  currency: string | null;
  unit: string | null;
  location: string | null;
  record_date: string;
  source: string | null;
}

function nombreOuNull(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined || valeur === "") return null;
  const n = Number(valeur);
  return Number.isFinite(n) ? n : null;
}

/** Échappe les caractères spéciaux d'un motif `ilike`. */
function motif(terme: string): string {
  return `%${terme.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
}

export class DonneesSupabase implements AccesDonnees {
  constructor(
    private readonly client: SupabaseClient,
    private readonly embeddeur: Embeddeur,
  ) {}

  private get clientType(): ClientBase {
    return this.client as unknown as ClientBase;
  }

  async listerSpeculations(): Promise<SpeculationRef[]> {
    return (await lireSpeculations(this.clientType)).map((s) => ({
      code: s.code,
      nom: s.nom,
      secteur: s.secteur,
      uniteEchelle: s.uniteEchelle,
      statut: s.statut,
    }));
  }

  async lireReglesFinanceurs(filtre: { organisme?: string; produit?: string } = {}): Promise<RegleFinanceurRef[]> {
    return lireReglesFinanceursRef(this.clientType, filtre);
  }

  async preparerBudget(entree: { ateliers: AtelierSimule[]; contexte: Record<string, string> }): Promise<EntreeBudget> {
    return preparerEntreeBudget(this.clientType, entree);
  }

  async lireAteliersEtContexte(exploitationId: string): Promise<{ ateliers: AtelierSimule[]; contexte: Record<string, string> } | null> {
    try {
      const e = await lireExploitation(this.clientType, exploitationId);
      return { ateliers: e.ateliers.map((a) => ({ id: a.id, speculationCode: a.speculationCode, taille: a.taille })), contexte: e.contexte };
    } catch (erreur) {
      if (erreur instanceof ErreurExploitation && erreur.code === "introuvable") return null;
      throw erreur;
    }
  }

  async lireProfil(exploitationId: string): Promise<ProfilPorteur | null> {
    try {
      await lireExploitation(this.clientType, exploitationId);
    } catch (erreur) {
      if (erreur instanceof ErreurExploitation && erreur.code === "introuvable") return null;
      throw erreur;
    }
    return lireProfil(this.clientType, exploitationId, { tolerant: true });
  }

  async lireVariantesElevage(speculationCode: string): Promise<VarianteElevage[]> {
    return lireVariantesElevage(this.clientType, speculationCode);
  }

  async lireProfilPorteur(exploitationId: string): Promise<ApportDuProfil | null> {
    // Base pas encore migrée : pas de profil, les outils retombent sur ce que dit l'utilisateur.
    return deduireDuProfil(await lireProfil(this.clientType, exploitationId, { tolerant: true }));
  }

  async lireConsultation(
    exploitationId: string,
    options: { secteurs?: string[]; reportees?: string[] } = {},
  ): Promise<{ entretien: Entretien; etat: EtatEntretien } | null> {
    try {
      const [entretien, etat] = await Promise.all([lireEntretien(this.clientType), chargerEtat(this.clientType, exploitationId, options)]);
      return { entretien, etat };
    } catch (erreur) {
      if (erreur instanceof ErreurExploitation && erreur.code === "introuvable") return null;
      throw erreur;
    }
  }

  async chercherPrix(terme: string): Promise<LignePrix[]> {
    const { data, error } = await this.client.rpc("lire_prix_marche", { p_terme: terme });
    if (error) throw error;
    return ((data ?? []) as LignePrixBase[]).map((l) => ({
      produit: l.product_name,
      prix: Number(l.price),
      devise: l.currency ?? "FCFA",
      unite: l.unit,
      lieu: l.location,
      date: l.record_date,
      source: l.source,
    }));
  }

  async lireExploitation(id: string): Promise<ResumeExploitation | null> {
    const { data: e, error } = await this.client
      .from("cultisos")
      .select("id, name, domain, status, surface_area, surface_unit, location")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!e) return null;

    const [plans, operations] = await Promise.all([
      this.client.from("business_plans").select("title, updated_at").eq("cultiso_id", id).order("updated_at", { ascending: false }).limit(5),
      this.client
        .from("transactions")
        .select("date, type, category, amount, description")
        .eq("cultiso_id", id)
        .order("date", { ascending: false })
        .limit(10),
    ]);
    if (plans.error) throw plans.error;
    if (operations.error) throw operations.error;

    return {
      id: e.id as string,
      nom: e.name as string,
      domaine: (e.domain as string | null) ?? null,
      statut: (e.status as string | null) ?? null,
      surface: nombreOuNull(e.surface_area),
      uniteSurface: (e.surface_unit as string | null) ?? null,
      localisation: (e.location as string | null) ?? null,
      plans: (plans.data ?? []).map((p) => ({ titre: p.title as string, misAJour: String(p.updated_at).slice(0, 10) })),
      operations: (operations.data ?? []).map((o) => ({
        date: String(o.date),
        type: o.type as "income" | "expense",
        categorie: o.category as string,
        montant: Number(o.amount),
        description: (o.description as string | null) ?? null,
      })),
    };
  }

  async chercherCultures(terme: string): Promise<Culture[]> {
    const { data, error } = await this.client
      .from("cultiplan_crops")
      .select("slug, name, base_temperature_c, upper_temperature_c, reference_harvest_index_pct")
      .or(`name.ilike.${motif(terme)},slug.ilike.${motif(terme)}`)
      .limit(5);
    if (error) throw error;
    return (data ?? []).map((c) => ({
      slug: c.slug as string,
      nom: c.name as string,
      temperatureBaseC: nombreOuNull(c.base_temperature_c),
      temperatureMaxC: nombreOuNull(c.upper_temperature_c),
      indiceRecoltePct: nombreOuNull(c.reference_harvest_index_pct),
    }));
  }

  async chercherSols(terme: string): Promise<Sol[]> {
    const { data, error } = await this.client
      .from("cultiplan_soils")
      .select("slug, name, field_capacity_vol_pct, wilting_point_vol_pct, ksat_mm_day")
      .or(`name.ilike.${motif(terme)},slug.ilike.${motif(terme)}`)
      .limit(5);
    if (error) throw error;
    return (data ?? []).map((s) => ({
      slug: s.slug as string,
      nom: s.name as string,
      capaciteChampPct: nombreOuNull(s.field_capacity_vol_pct),
      pointFletrissementPct: nombreOuNull(s.wilting_point_vol_pct),
      ksatMmJour: nombreOuNull(s.ksat_mm_day),
    }));
  }

  async listerZones(): Promise<Zone[]> {
    const { data, error } = await this.client
      .from("cultiplan_zae_togo")
      .select("zone_id, name, description, rainfall_min_mm, rainfall_max_mm")
      .order("zone_id");
    if (error) throw error;
    return (data ?? []).map((z) => ({
      code: z.zone_id as string,
      nom: z.name as string,
      description: (z.description as string | null) ?? null,
      pluieMinMm: nombreOuNull(z.rainfall_min_mm),
      pluieMaxMm: nombreOuNull(z.rainfall_max_mm),
    }));
  }

  async chercherSavoir(question: string): Promise<ExtraitSavoir[]> {
    const vecteur = await this.embeddeur.requete(question);
    if (!vecteur) return [];
    const { data, error } = await this.client.rpc("chercher_savoir_autorise", {
      p_embedding: vecteur,
      p_seuil: SEUIL_SIMILARITE,
      p_nombre: 3,
    });
    if (error) throw error;
    return ((data ?? []) as { file_name: string; content: string; similarity: number }[]).map((d) => ({
      document: d.file_name,
      contenu: d.content,
      similarite: d.similarity,
    }));
  }
}
