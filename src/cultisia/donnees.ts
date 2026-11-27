import type { EntreeBudget } from "@/moteurs";
import type { RegleFinanceurRef } from "@/referentiel";

/**
 * Accès aux données lues par les outils de Cultisia.
 * L'interface est injectée : Supabase en production (`donnees-supabase.ts`), une fausse base dans les tests.
 */

export interface LignePrix {
  produit: string;
  prix: number;
  devise: string;
  unite: string | null;
  lieu: string | null;
  date: string;
  source: string | null;
}

export interface ResumeExploitation {
  id: string;
  nom: string;
  domaine: string | null;
  statut: string | null;
  surface: number | null;
  uniteSurface: string | null;
  localisation: string | null;
  plans: { titre: string; misAJour: string }[];
  operations: { date: string; type: "income" | "expense"; categorie: string; montant: number; description: string | null }[];
}

export interface Culture {
  slug: string;
  nom: string;
  temperatureBaseC: number | null;
  temperatureMaxC: number | null;
  indiceRecoltePct: number | null;
}

export interface Sol {
  slug: string;
  nom: string;
  capaciteChampPct: number | null;
  pointFletrissementPct: number | null;
  ksatMmJour: number | null;
}

export interface Zone {
  code: string;
  nom: string;
  description: string | null;
  pluieMinMm: number | null;
  pluieMaxMm: number | null;
}

export interface ExtraitSavoir {
  document: string;
  contenu: string;
  similarite: number;
}

/** Spéculation du référentiel, telle que les outils de calcul la présentent. */
export interface SpeculationRef {
  code: string;
  nom: string;
  secteur: string;
  uniteEchelle: string;
  statut: "brouillon_ia" | "a_valider" | "validee";
}

/** Atelier à simuler : une spéculation du référentiel et une taille dans son unité d'échelle. */
export interface AtelierSimule {
  id: string;
  speculationCode: string;
  taille: number;
}

export interface AccesDonnees {
  /** Spéculations du référentiel (catalogue court). */
  listerSpeculations(): Promise<SpeculationRef[]>;
  /** Entrée du générateur de budget (référentiel + prix du marché récents) pour des ateliers et un contexte terrain. */
  preparerBudget(entree: { ateliers: AtelierSimule[]; contexte: Record<string, string> }): Promise<EntreeBudget>;
  /** Ateliers et contexte terrain d'une exploitation, lus avec les droits de l'utilisateur ; null si inaccessible. */
  lireAteliersEtContexte(exploitationId: string): Promise<{ ateliers: AtelierSimule[]; contexte: Record<string, string> } | null>;

  /** Règles des financeurs du référentiel (R11), éventuellement d'un organisme (et d'un produit) précis. */
  lireReglesFinanceurs(filtre?: { organisme?: string; produit?: string }): Promise<RegleFinanceurRef[]>;

  chercherPrix(terme: string): Promise<LignePrix[]>;
  /** Lu avec les droits de l'utilisateur : renvoie null si l'exploitation n'existe pas ou ne lui appartient pas. */
  lireExploitation(id: string): Promise<ResumeExploitation | null>;
  chercherCultures(terme: string): Promise<Culture[]>;
  chercherSols(terme: string): Promise<Sol[]>;
  listerZones(): Promise<Zone[]>;
  /** Ne renvoie que des extraits de documents dont la licence est marquée autorisée. */
  chercherSavoir(question: string): Promise<ExtraitSavoir[]>;
}

/** Retire les accents et met en minuscules (recherche tolérante). */
export function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
