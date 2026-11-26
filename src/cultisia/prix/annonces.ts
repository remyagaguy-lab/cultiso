/**
 * Conversion des annonces de prix extraites de WhatsApp (`src/data/prix_extraits_togo.json`) en relevés de prix.
 * Règles :
 * - seules les annonces avec un prix chiffré sont gardées (« Inbox pour ton prix » est écarté) ;
 * - le vendeur (souvent un numéro de téléphone) n'est JAMAIS conservé ;
 * - la date JJ/MM/AAAA devient AAAA-MM-JJ.
 */

export interface AnnonceWhatsApp {
  date: string | null;
  produit: string | null;
  prix: string | null;
  vendeur?: string | null;
  localisation?: string | null;
  type?: string | null;
}

export interface ReleveAnnonce {
  produit: string;
  prix: number;
  unite: string | null;
  lieu: string | null;
  date: string;
  source: string;
}

export const SOURCE_ANNONCES = "Annonce WhatsApp (groupe agricole, prix demandé par le vendeur)";

/** Extrait le premier montant d'un texte de prix : « 6 000 FCFA par guide » donne 6000 et l'unité « guide ». */
export function lirePrixAnnonce(texte: string | null): { prix: number; unite: string | null } | null {
  if (!texte) return null;
  const correspondance = texte.match(/(\d{1,3}(?:[ .  ]\d{3})+|\d+)\s*(?:f\s?cfa|fcfa|frs?|f)?\b/i);
  if (!correspondance) return null;
  const prix = Number(correspondance[1].replace(/[ .  ]/g, ""));
  if (!Number.isFinite(prix) || prix <= 0) return null;
  const unite = texte.match(/(?:\b(?:par|le|la)\s+|l['’]|\/\s*|\bf\s+(?!(?:le|la|les|par)\b))([a-zà-ÿ]+(?:\s+de\s+\d+\s*kg)?)/i)?.[1]?.toLowerCase() ?? null;
  return { prix, unite };
}

export function lireDateAnnonce(texte: string | null): string | null {
  const m = texte?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function annoncesVersReleves(annonces: AnnonceWhatsApp[]): ReleveAnnonce[] {
  const releves: ReleveAnnonce[] = [];
  for (const a of annonces) {
    const produit = a.produit?.trim();
    const prix = lirePrixAnnonce(a.prix);
    const date = lireDateAnnonce(a.date);
    if (!produit || !prix || !date) continue;
    releves.push({ produit, prix: prix.prix, unite: prix.unite, lieu: a.localisation?.trim() || null, date, source: SOURCE_ANNONCES });
  }
  return releves;
}
