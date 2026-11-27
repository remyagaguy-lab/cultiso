// Générateur de budget : modèles du référentiel × taille de chaque atelier, puis prix de marché s'il y en a,
// puis règles d'ajustement du contexte terrain. Repris du Cultiso Brouillon (pré-remplissage et modificateurs),
// les modificateurs écrits en dur dans le code devenant des données (règles du référentiel).
// Chaque ligne garde son origine et le journal des ajustements appliqués : c'est ce qui rend le plan défendable.
//
// Ordre : prix de marché d'abord, règles ensuite (lignes ajoutées, puis coefficients) (une règle « +15 % avec emballage premium » s'applique au prix du marché).
import { z } from "zod";
import { valider } from "./commun";
import type { LigneCharge, LigneRevenu } from "./finance";

const statut = z.enum(["brouillon_ia", "a_valider", "validee"]);
const moisListe = z.array(z.number().int().min(1).max(12)).min(1).optional();

export const schemaModeleCharge = z.object({
  id: z.string().min(1),
  speculationCode: z.string().min(1),
  typeCharge: z.string().min(1),
  libelle: z.string().min(1),
  unite: z.string().min(1),
  /** Quantité pour 1 unité d'échelle de la spéculation. */
  quantite: z.number().min(0),
  prixReference: z.number().min(0),
  /** Produit de la base de prix dont le prix peut remplacer la référence. */
  produitPrix: z.string().optional(),
  frequence: z.number().min(0).default(1),
  base: z.enum(["cycle", "an"]).default("cycle"),
  nature: z.enum(["fixe", "variable"]),
  classe: z.enum(["investissement", "exploitation"]),
  dureeVieAns: z.number().positive().optional(),
  moisDecaissement: moisListe,
  statut,
});

export const schemaModeleRevenu = z.object({
  id: z.string().min(1),
  speculationCode: z.string().min(1),
  typeRevenu: z.string().min(1),
  libelle: z.string().min(1),
  unite: z.string().min(1),
  quantite: z.object({ pessimiste: z.number().min(0), realiste: z.number().min(0), optimiste: z.number().min(0) }),
  pertes: z.number().min(0).max(1).default(0),
  prixReference: z.number().min(0),
  produitPrix: z.string().optional(),
  base: z.enum(["cycle", "an"]).default("cycle"),
  moisVente: moisListe,
  /** Bornes de production pour 1 unité d'échelle, dans l'unité et la période de `quantite` (R10) ; mises à la taille de l'atelier par le générateur. */
  bornes: z
    .object({
      min: z.number().min(0).optional(),
      typique: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      source: z.string().min(1),
      dateSource: z.string().min(1),
      statut,
    })
    .optional(),
  statut,
});

const ligneAjoutee = schemaModeleCharge.omit({ id: true, speculationCode: true, statut: true });

export const schemaRegle = z
  .object({
    id: z.string().min(1),
    cleQuestion: z.string().min(1),
    valeur: z.string().min(1),
    /** Limite la règle à une spéculation ; toutes sinon. */
    speculationCode: z.string().optional(),
    effet: z.enum(["multiplier", "ajouter_ligne"]),
    /** Cible d'un « multiplier » : un sens, et un type de charge ou de revenu, ou un modèle précis. */
    cible: z
      .object({
        sens: z.enum(["charge", "revenu"]),
        type: z.string().optional(),
        modeleId: z.string().optional(),
      })
      .optional(),
    coefficient: z.number().positive().optional(),
    /** Ligne de charge ajoutée, pour 1 unité d'échelle. */
    ligne: ligneAjoutee.optional(),
    statut,
  })
  .refine((r) => r.effet !== "multiplier" || (r.cible !== undefined && r.coefficient !== undefined), {
    message: "une règle « multiplier » demande une cible et un coefficient",
  })
  .refine((r) => r.effet !== "ajouter_ligne" || r.ligne !== undefined, {
    message: "une règle « ajouter_ligne » demande une ligne",
  });

export const schemaBudget = z.object({
  ateliers: z
    .array(
      z.object({
        atelierId: z.string().min(1),
        speculationCode: z.string().min(1),
        taille: z.number().positive("la taille d'un atelier doit être positive"),
        cyclesParAn: z.number().positive().default(1),
      }),
    )
    .min(1, "au moins un atelier"),
  modelesCharges: z.array(schemaModeleCharge),
  modelesRevenus: z.array(schemaModeleRevenu),
  contexte: z.record(z.string(), z.string()).default({}),
  regles: z.array(schemaRegle).default([]),
  prix: z
    .array(z.object({ produitId: z.string().min(1), prix: z.number().positive(), source: z.string(), date: z.string() }))
    .default([]),
});

export type EntreeBudget = z.input<typeof schemaBudget>;
export type ModeleCharge = z.input<typeof schemaModeleCharge>;
export type ModeleRevenu = z.input<typeof schemaModeleRevenu>;
export type RegleAjustement = z.input<typeof schemaRegle>;

/** D'où vient une ligne : référence validée, estimation (donnée non validée), ajustée au terrain, prix du marché. */
export type Origine = "reference" | "estimation" | "ajustee_terrain" | "prix_marche";

interface Trace {
  atelierId: string;
  modeleId: string | null;
  unite: string;
  origine: Origine;
  sourcePrix: { source: string; date: string } | null;
}
export type LigneChargeBudget = LigneCharge & Trace;
export type LigneRevenuBudget = LigneRevenu & Trace;

export interface AjustementApplique {
  regleId: string;
  ligneId: string;
  effet: "multiplier" | "ajouter_ligne";
  coefficient: number | null;
}

export interface ResultatBudget {
  charges: LigneChargeBudget[];
  revenus: LigneRevenuBudget[];
  journal: AjustementApplique[];
  /** Ateliers dont la spéculation n'a aucun modèle : pas de données de référence, à signaler à l'utilisateur. */
  ateliersSansModele: string[];
}

const origineDe = (s: z.infer<typeof statut>): Origine => (s === "validee" ? "reference" : "estimation");

export function genererBudget(entree: EntreeBudget): ResultatBudget {
  const e = valider(schemaBudget, entree, "budget");
  const prixParProduit = new Map(e.prix.map((p) => [p.produitId, p]));
  const charges: LigneChargeBudget[] = [];
  const revenus: LigneRevenuBudget[] = [];
  const journal: AjustementApplique[] = [];
  const ateliersSansModele: string[] = [];

  for (const atelier of e.ateliers) {
    const modelesC = e.modelesCharges.filter((m) => m.speculationCode === atelier.speculationCode);
    const modelesR = e.modelesRevenus.filter((m) => m.speculationCode === atelier.speculationCode);
    if (modelesC.length === 0 && modelesR.length === 0) ateliersSansModele.push(atelier.atelierId);

    const chargesAtelier: LigneChargeBudget[] = modelesC.map((m) => {
      const prix = m.produitPrix ? prixParProduit.get(m.produitPrix) : undefined;
      return {
        id: `${atelier.atelierId}:${m.id}`,
        libelle: m.libelle,
        typeCharge: m.typeCharge,
        quantite: m.quantite * atelier.taille,
        prixUnitaire: prix?.prix ?? m.prixReference,
        frequence: m.frequence,
        base: m.base,
        cyclesParAn: atelier.cyclesParAn,
        nature: m.nature,
        classe: m.classe,
        dureeVieAns: m.dureeVieAns,
        moisDecaissement: m.moisDecaissement,
        atelierId: atelier.atelierId,
        modeleId: m.id,
        unite: m.unite,
        origine: prix ? "prix_marche" : origineDe(m.statut),
        sourcePrix: prix ? { source: prix.source, date: prix.date } : null,
      };
    });

    const revenusAtelier: LigneRevenuBudget[] = modelesR.map((m) => {
      const prix = m.produitPrix ? prixParProduit.get(m.produitPrix) : undefined;
      return {
        id: `${atelier.atelierId}:${m.id}`,
        libelle: m.libelle,
        typeRevenu: m.typeRevenu,
        quantite: {
          pessimiste: m.quantite.pessimiste * atelier.taille,
          realiste: m.quantite.realiste * atelier.taille,
          optimiste: m.quantite.optimiste * atelier.taille,
        },
        prixUnitaire: prix?.prix ?? m.prixReference,
        pertes: m.pertes,
        base: m.base,
        cyclesParAn: atelier.cyclesParAn,
        moisVente: m.moisVente,
        bornesQuantite: m.bornes
          ? {
              ...(m.bornes.min !== undefined ? { min: m.bornes.min * atelier.taille } : {}),
              ...(m.bornes.max !== undefined ? { max: m.bornes.max * atelier.taille } : {}),
              source: `${m.bornes.source} (source du ${m.bornes.dateSource})`,
              statut: m.bornes.statut,
            }
          : undefined,
        atelierId: atelier.atelierId,
        modeleId: m.id,
        unite: m.unite,
        origine: prix ? "prix_marche" : origineDe(m.statut),
        sourcePrix: prix ? { source: prix.source, date: prix.date } : null,
      };
    });

    const reglesActives = e.regles.filter(
      (r) =>
        e.contexte[r.cleQuestion] === r.valeur &&
        (r.speculationCode === undefined || r.speculationCode === atelier.speculationCode),
    );
    // Les lignes ajoutées passent d'abord, pour que les coefficients s'y appliquent aussi
    // (ex. : le carburant de la motopompe est majoré en contre-saison).
    const ordonnees = [...reglesActives.filter((r) => r.effet === "ajouter_ligne"), ...reglesActives.filter((r) => r.effet === "multiplier")];
    for (const regle of ordonnees) {
      if (regle.effet === "multiplier" && regle.cible && regle.coefficient !== undefined) {
        const { sens, type, modeleId } = regle.cible;
        const vise = (typeLigne: string, idModele: string | null) =>
          (type === undefined || type === typeLigne) && (modeleId === undefined || modeleId === idModele);
        if (sens === "charge") {
          for (const l of chargesAtelier.filter((x) => vise(x.typeCharge, x.modeleId))) {
            l.quantite *= regle.coefficient;
            l.origine = "ajustee_terrain";
            journal.push({ regleId: regle.id, ligneId: l.id, effet: "multiplier", coefficient: regle.coefficient });
          }
        } else {
          for (const l of revenusAtelier.filter((x) => vise(x.typeRevenu, x.modeleId))) {
            l.prixUnitaire *= regle.coefficient;
            l.origine = "ajustee_terrain";
            journal.push({ regleId: regle.id, ligneId: l.id, effet: "multiplier", coefficient: regle.coefficient });
          }
        }
      } else if (regle.effet === "ajouter_ligne" && regle.ligne) {
        const m = regle.ligne;
        const id = `${atelier.atelierId}:${regle.id}`;
        chargesAtelier.push({
          id,
          libelle: m.libelle,
          typeCharge: m.typeCharge,
          quantite: m.quantite * atelier.taille,
          prixUnitaire: m.prixReference,
          frequence: m.frequence,
          base: m.base,
          cyclesParAn: atelier.cyclesParAn,
          nature: m.nature,
          classe: m.classe,
          dureeVieAns: m.dureeVieAns,
          moisDecaissement: m.moisDecaissement,
          atelierId: atelier.atelierId,
          modeleId: null,
          unite: m.unite,
          origine: "ajustee_terrain",
          sourcePrix: null,
        });
        journal.push({ regleId: regle.id, ligneId: id, effet: "ajouter_ligne", coefficient: null });
      }
    }

    charges.push(...chargesAtelier);
    revenus.push(...revenusAtelier);
  }

  return { charges, revenus, journal, ateliersSansModele };
}
