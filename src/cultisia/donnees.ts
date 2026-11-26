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

export interface AccesDonnees {
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
