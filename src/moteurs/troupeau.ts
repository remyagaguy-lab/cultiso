// Cheptel en flux (M14, ruminants et élevages sans bande) : effectif de chaque catégorie d'animaux mois par mois,
// avec ses entrées (naissances, achats, dons, confiage) et ses sorties (mortalité, ventes, autoconsommation, dons, vols et pertes)
// et le croît du troupeau (effectif de fin − effectif de début). Structure du tableau « Évolution numérique du cheptel » du carnet de
// gestion des exploitations agricoles (DOC-00279 p. 40), calculée au mois au lieu de l'année.
// Code pur : aucun taux de mise bas, de mortalité ou de vente n'est écrit ici ni deviné ; l'appelant donne les mouvements (avec leur
// origine : plan du porteur, hypothèse validée) et le moteur tient les comptes. Un mouvement impossible (vendre plus d'animaux qu'on
// n'en a) est refusé avec le mois et la catégorie.
import { z } from "zod";
import { ErreurMoteur, fcfa, valider, VERSION_MOTEURS } from "./commun";

export const TYPES_ENTREE = ["naissance", "achat", "don_recu", "confiage_recu"] as const;
export const TYPES_SORTIE = ["mortalite", "vente", "autoconsommation", "don_donne", "vol_perte"] as const;
export type TypeEntree = (typeof TYPES_ENTREE)[number];
export type TypeSortie = (typeof TYPES_SORTIE)[number];

export const schemaTroupeau = z.object({
  horizonMois: z.number().int().min(1).max(120),
  categories: z.array(z.object({ code: z.string().min(1), libelle: z.string().min(1).optional(), effectifInitial: z.number().min(0) })).min(1).max(30),
  mouvements: z
    .array(
      z.object({
        mois: z.number().int().min(1),
        categorie: z.string().min(1),
        type: z.enum([...TYPES_ENTREE, ...TYPES_SORTIE]),
        effectif: z.number().positive(),
        /** FCFA par animal : prix d'achat ou de vente. */
        prixUnitaire: z.number().min(0).optional(),
      }),
    )
    .default([]),
});
export type EntreeTroupeau = z.input<typeof schemaTroupeau>;

export interface MoisCategorie {
  mois: number;
  debut: number;
  entrees: Partial<Record<TypeEntree, number>>;
  sorties: Partial<Record<TypeSortie, number>>;
  fin: number;
  /** fin − début du mois. */
  croit: number;
}

export interface BilanCategorie {
  code: string;
  libelle: string;
  debut: number;
  totalEntrees: number;
  totalSorties: number;
  fin: number;
  /** Croît du troupeau : effectif de fin − effectif de début. */
  croit: number;
  mois: MoisCategorie[];
}

export interface ResultatTroupeau {
  versionMoteur: string;
  categories: BilanCategorie[];
  /** Argent des achats (sortie de caisse) et des ventes (entrée), par mois de 1 à l'horizon, d'après les prix donnés. */
  tresorerie: { mois: number; achats: number; ventes: number; solde: number }[];
  /** Mouvements sans prix : leur argent n'est pas compté. */
  mouvementsSansPrix: number;
}

export function simulerTroupeau(entree: EntreeTroupeau): ResultatTroupeau {
  const e = valider(schemaTroupeau, entree, "troupeau");
  const codes = new Set(e.categories.map((c) => c.code));
  if (codes.size !== e.categories.length) throw new ErreurMoteur("Deux catégories d'animaux portent le même code.");
  for (const m of e.mouvements) {
    if (!codes.has(m.categorie)) throw new ErreurMoteur(`Le mouvement du mois ${m.mois} vise une catégorie inconnue : ${m.categorie}.`);
    if (m.mois > e.horizonMois) throw new ErreurMoteur(`Le mouvement du mois ${m.mois} (${m.categorie}) dépasse l'horizon de ${e.horizonMois} mois.`);
  }
  const estEntree = (t: string): t is TypeEntree => (TYPES_ENTREE as readonly string[]).includes(t);
  const tresorerie = Array.from({ length: e.horizonMois }, (_, i) => ({ mois: i + 1, achats: 0, ventes: 0, solde: 0 }));
  let sansPrix = 0;

  const categories = e.categories.map((cat): BilanCategorie => {
    let effectif = cat.effectifInitial;
    const mois: MoisCategorie[] = [];
    let entrees = 0;
    let sorties = 0;
    for (let m = 1; m <= e.horizonMois; m++) {
      const ligne: MoisCategorie = { mois: m, debut: effectif, entrees: {}, sorties: {}, fin: effectif, croit: 0 };
      // Les entrées du mois d'abord, puis les sorties : un animal né ou acheté ce mois-là peut être vendu ce mois-là.
      const duMois = e.mouvements.filter((x) => x.categorie === cat.code && x.mois === m);
      for (const x of [...duMois.filter((y) => estEntree(y.type)), ...duMois.filter((y) => !estEntree(y.type))]) {
        if (estEntree(x.type)) {
          ligne.entrees[x.type] = (ligne.entrees[x.type] ?? 0) + x.effectif;
          effectif += x.effectif;
          entrees += x.effectif;
        } else {
          if (x.effectif > effectif + 1e-9) {
            throw new ErreurMoteur(`Au mois ${m}, la catégorie « ${cat.libelle ?? cat.code} » sortirait ${x.effectif} animaux (${x.type}) alors qu'elle n'en compte que ${effectif}.`);
          }
          ligne.sorties[x.type as TypeSortie] = (ligne.sorties[x.type as TypeSortie] ?? 0) + x.effectif;
          effectif -= x.effectif;
          sorties += x.effectif;
        }
        if ((x.type === "achat" || x.type === "vente") && x.prixUnitaire === undefined) sansPrix++;
        if (x.type === "achat" && x.prixUnitaire !== undefined) tresorerie[m - 1].achats += x.effectif * x.prixUnitaire;
        if (x.type === "vente" && x.prixUnitaire !== undefined) tresorerie[m - 1].ventes += x.effectif * x.prixUnitaire;
      }
      ligne.fin = effectif;
      ligne.croit = ligne.fin - ligne.debut;
      mois.push(ligne);
    }
    return { code: cat.code, libelle: cat.libelle ?? cat.code, debut: cat.effectifInitial, totalEntrees: entrees, totalSorties: sorties, fin: effectif, croit: effectif - cat.effectifInitial, mois };
  });
  for (const t of tresorerie) {
    t.achats = fcfa(t.achats);
    t.ventes = fcfa(t.ventes);
    t.solde = t.ventes - t.achats;
  }
  return { versionMoteur: VERSION_MOTEURS, categories, tresorerie, mouvementsSansPrix: sansPrix };
}
