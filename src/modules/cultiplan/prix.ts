// Prix du marché injectés dans l'entrée du générateur de budget.
// Un modèle du référentiel désigne un produit de la base de prix (`produitPrix` = nom du produit dans `products`).
// Un prix ne remplace la référence que s'il est récent (moins d'un an par défaut) ET dans la même unité que la ligne :
// un prix au sac ne remplace jamais un prix au kilo.
import type { ClientBase } from "@/core/exploitation";
import type { EntreeBudget } from "@/moteurs/budget";
import { ErreurPlan } from "./erreurs";

/** Ancienneté maximale d'un relevé pour remplacer un prix de référence. */
export const ANCIENNETE_MAX_PRIX_JOURS = 365;

export interface ReleveRecent {
  produit: string;
  prix: number;
  unite: string;
  lieu: string | null;
  date: string;
  source: string | null;
}

/** Recherche tolérante : sans accents, en minuscules, espaces réduits. */
export function cleProduit(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const cle = (produit: string, unite: string) => `${cleProduit(produit)}|${cleProduit(unite)}`;

/**
 * Relie les modèles aux relevés de prix : chaque modèle qui désigne un produit reçoit la clé « produit|unité »,
 * et le prix correspondant est ajouté à `prix`. Fonction pure (les relevés sont lus par l'appelant).
 */
export function injecterPrix(entree: EntreeBudget, releves: ReleveRecent[]): EntreeBudget {
  const parCle = new Map<string, ReleveRecent>();
  for (const r of releves) {
    const k = cle(r.produit, r.unite);
    const deja = parCle.get(k);
    if (!deja || r.date > deja.date) parCle.set(k, r);
  }
  const prix = new Map<string, { produitId: string; prix: number; source: string; date: string }>();
  const relier = <M extends { produitPrix?: string; unite: string }>(m: M): M => {
    if (!m.produitPrix) return m;
    const k = cle(m.produitPrix, m.unite);
    const releve = parCle.get(k);
    if (!releve) return { ...m, produitPrix: undefined };
    prix.set(k, {
      produitId: k,
      prix: releve.prix,
      source: [releve.source ?? "Cours des prix Cultiso", releve.lieu].filter(Boolean).join(", "),
      date: releve.date,
    });
    return { ...m, produitPrix: k };
  };
  const modelesCharges = entree.modelesCharges.map(relier);
  const modelesRevenus = entree.modelesRevenus.map(relier);
  return { ...entree, modelesCharges, modelesRevenus, prix: [...(entree.prix ?? []), ...prix.values()] };
}

/** Produits désignés par les modèles d'une entrée de budget. */
export function produitsDesignes(entree: EntreeBudget): string[] {
  const noms = [...entree.modelesCharges, ...entree.modelesRevenus].map((m) => m.produitPrix).filter((p): p is string => !!p);
  return [...new Set(noms)];
}

/** Lit les derniers relevés des produits désignés, depuis `aujourdhui − ANCIENNETE_MAX_PRIX_JOURS`. */
export async function lireRelevesRecents(client: ClientBase, produits: string[], aujourdhui: Date): Promise<ReleveRecent[]> {
  if (produits.length === 0) return [];
  const depuis = new Date(aujourdhui.getTime() - ANCIENNETE_MAX_PRIX_JOURS * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await client.rpc("derniers_prix_produits", { p_produits: produits, p_depuis: depuis });
  if (error) throw new ErreurPlan(`Lecture des prix du marché impossible : ${error.message}`, "base");
  return (data ?? []).map((r) => ({
    produit: r.produit,
    prix: Number(r.prix),
    unite: r.unite,
    lieu: r.lieu ?? null,
    date: r.date_releve,
    source: r.source ?? null,
  }));
}
