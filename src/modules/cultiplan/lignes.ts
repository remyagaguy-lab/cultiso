// Lignes d'un plan : schémas d'entrée (ajout, correction) et conversions entre la base, le générateur de budget
// et le moteur financier. Aucun calcul ici : les montants sont produits par src/moteurs/.
import { z } from "zod";
import type { AjustementApplique, LigneChargeBudget, LigneRevenuBudget, Origine } from "@/moteurs/budget";
import { schemaLigneCharge, schemaLigneRevenu, type LigneCharge, type LigneRevenu } from "@/moteurs/finance";
import type { Database, Json } from "@/types/supabase";

/** Valeur sérialisable pour une colonne jsonb non nulle. */
export const versJson = (valeur: unknown): NonNullable<Json> => valeur as NonNullable<Json>;
import { ErreurPlan } from "./erreurs";

/**
 * Champs optionnels que lisent les contrôles du §3.6 du moteur, rangés dans une seule colonne jsonb (`champs_controle`).
 * Les schémas reprennent ceux du moteur : un champ accepté ici l'est aussi par `calculerFinances`.
 */
const champsCharge = schemaLigneCharge.shape;
const champsRevenu = schemaLigneRevenu.shape;
export const schemaControlesCharge = z
  .object({
    fournisseur: champsCharge.fournisseur,
    referenceItineraire: champsCharge.referenceItineraire,
    couverture: champsCharge.couverture,
    emploi: champsCharge.emploi,
    // Moteur calendaire (M1, M2, R1) : profil de cycle du référentiel, hausses propres à la ligne, achat daté, série d'un moteur autonome.
    calendrier: champsCharge.calendrier,
    serieMensuelle: champsCharge.serieMensuelle,
    hausseAnnuelle: champsCharge.hausseAnnuelle,
    hausseParAn: champsCharge.hausseParAn,
    moisAcquisition: champsCharge.moisAcquisition,
    renouvellement: z.boolean().optional(),
  })
  .strict();
export const schemaControlesRevenu = z
  .object({
    bornesQuantite: champsRevenu.bornesQuantite,
    client: champsRevenu.client,
    perenne: champsRevenu.perenne,
    debouche: champsRevenu.debouche,
    calendrier: champsRevenu.calendrier,
    serieMensuelle: champsRevenu.serieMensuelle,
    hausseAnnuelle: champsRevenu.hausseAnnuelle,
    hausseParAn: champsRevenu.hausseParAn,
  })
  .strict();
export type ControlesCharge = z.output<typeof schemaControlesCharge>;
export type ControlesRevenu = z.output<typeof schemaControlesRevenu>;

/** Retire les clés non définies : le jsonb ne garde que ce qui est renseigné. */
function sansIndefini<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

export const TYPES_CHARGE = ["intrants", "main_oeuvre", "energie", "infrastructures", "sanitaire", "logistique", "frais_financiers"] as const;
export const TYPES_REVENU = ["principal", "coproduit", "sous_produit", "service"] as const;

/** Origine d'une ligne de plan : celles du générateur, plus la saisie de l'utilisateur et la proposition de Cultisia. */
export type OriginePlan = Origine | "utilisateur" | "cultisia";
/** Qui corrige ou ajoute une ligne. */
export type Auteur = "utilisateur" | "cultisia";

export type RangeeLigne = Database["public"]["Tables"]["plan_lignes"]["Row"];
export type InsertionLigne = Database["public"]["Tables"]["plan_lignes"]["Insert"];

interface LigneCommune {
  id: string;
  atelierId: string | null;
  libelle: string;
  unite: string;
  prixUnitaire: number;
  base: "cycle" | "an";
  cyclesParAn: number;
  /** Mois de décaissement (charge) ou de vente (revenu), 1 à 12 ; null = réparti sur l'année. */
  mois: number[] | null;
  origine: OriginePlan;
  modeleId: string | null;
  ajustements: Omit<AjustementApplique, "ligneId">[];
  sourcePrix: { source: string; date: string } | null;
  ordre: number;
}
export interface LigneChargePlan extends LigneCommune {
  sens: "charge";
  type: (typeof TYPES_CHARGE)[number];
  quantite: number;
  frequence: number;
  nature: "fixe" | "variable";
  classe: "investissement" | "exploitation";
  dureeVieAns: number | null;
  /** Champs lus par les contrôles du moteur (fournisseur, itinéraire de référence, bande, emploi). */
  controles: ControlesCharge;
}
export interface LigneRevenuPlan extends LigneCommune {
  sens: "revenu";
  type: (typeof TYPES_REVENU)[number];
  quantites: { pessimiste: number; realiste: number; optimiste: number };
  pertes: number;
  /** Champs lus par les contrôles du moteur (bornes de production, client, pérenne, débouché). */
  controles: ControlesRevenu;
}
export type LignePlan = LigneChargePlan | LigneRevenuPlan;

const mois = z.array(z.number().int().min(1).max(12)).min(1).max(12);
const commun = {
  atelierId: z.uuid().nullable().optional(),
  libelle: z.string().trim().min(2, "libellé trop court").max(120),
  unite: z.string().trim().min(1).max(30),
  prixUnitaire: z.number().min(0, "le prix ne peut pas être négatif"),
  base: z.enum(["cycle", "an"]).default("cycle"),
  cyclesParAn: z.number().positive().default(1),
  mois: mois.nullable().optional(),
};
const quantites = z.object({ pessimiste: z.number().min(0), realiste: z.number().min(0), optimiste: z.number().min(0) });

export const schemaNouvelleCharge = z
  .object({
    sens: z.literal("charge"),
    type: z.enum(TYPES_CHARGE),
    quantite: z.number().min(0),
    frequence: z.number().min(0).default(1),
    nature: z.enum(["fixe", "variable"]),
    classe: z.enum(["investissement", "exploitation"]),
    dureeVieAns: z.number().positive().nullable().optional(),
    controles: schemaControlesCharge.optional(),
    ...commun,
  })
  .refine((l) => l.classe !== "investissement" || (l.dureeVieAns ?? null) !== null, {
    message: "un investissement doit avoir une durée de vie",
    path: ["dureeVieAns"],
  });
export const schemaNouveauRevenu = z.object({
  sens: z.literal("revenu"),
  type: z.enum(TYPES_REVENU),
  quantites,
  pertes: z.number().min(0).max(1).default(0),
  controles: schemaControlesRevenu.optional(),
  ...commun,
});
export const schemaNouvelleLigne = z.union([schemaNouvelleCharge, schemaNouveauRevenu]);
export type NouvelleLigne = z.input<typeof schemaNouvelleLigne>;

/** Correction d'une ligne : seuls les champs fournis changent ; le sens et la trace du référentiel restent. */
export const schemaCorrectionLigne = z
  .object({
    libelle: commun.libelle,
    unite: commun.unite,
    prixUnitaire: commun.prixUnitaire,
    base: z.enum(["cycle", "an"]),
    cyclesParAn: z.number().positive(),
    mois: mois.nullable(),
    quantite: z.number().min(0),
    frequence: z.number().min(0),
    nature: z.enum(["fixe", "variable"]),
    classe: z.enum(["investissement", "exploitation"]),
    dureeVieAns: z.number().positive().nullable(),
    quantites,
    pertes: z.number().min(0).max(1),
    /** Remplace tout le groupe de champs de contrôle de la ligne. */
    controles: z.union([schemaControlesCharge, schemaControlesRevenu]),
  })
  .partial()
  .strict()
  .refine((c) => Object.keys(c).length > 0, { message: "aucune correction fournie" });
export type CorrectionLigne = z.input<typeof schemaCorrectionLigne>;

export function verifier<S extends z.ZodType>(schema: S, entree: unknown): z.output<S> {
  const r = schema.safeParse(entree);
  if (!r.success) {
    const details = r.error.issues.map((i) => `${i.path.join(".") || "entrée"} : ${i.message}`);
    throw new ErreurPlan(details.join(" ; "), "invalide", details);
  }
  return r.data;
}

/** Ligne du générateur de budget → rangée à insérer. */
export function depuisBudget(
  planId: string,
  ligne: LigneChargeBudget | LigneRevenuBudget,
  journal: AjustementApplique[],
  ordre: number,
): InsertionLigne {
  const ajustements = journal
    .filter((j) => j.ligneId === ligne.id)
    .map(({ regleId, effet, coefficient }) => ({ regleId, effet, coefficient }));
  const trace = {
    plan_id: planId,
    atelier_id: ligne.atelierId,
    libelle: ligne.libelle,
    unite: ligne.unite,
    prix_unitaire: ligne.prixUnitaire,
    base: ligne.base ?? "cycle",
    cycles_par_an: ligne.cyclesParAn ?? 1,
    origine: ligne.origine,
    modele_id: ligne.modeleId,
    ajustements: versJson(ajustements),
    source_prix: ligne.sourcePrix as unknown as Json,
    ordre,
  };
  if ("typeCharge" in ligne) {
    return {
      ...trace,
      sens: "charge",
      type: ligne.typeCharge,
      quantite: ligne.quantite,
      frequence: ligne.frequence ?? 1,
      nature: ligne.nature,
      classe: ligne.classe,
      duree_vie_ans: ligne.dureeVieAns ?? null,
      mois: ligne.moisDecaissement ?? null,
      champs_controle: versJson(
        sansIndefini({
          fournisseur: ligne.fournisseur,
          referenceItineraire: ligne.referenceItineraire,
          couverture: ligne.couverture,
          emploi: ligne.emploi,
          calendrier: ligne.calendrier,
          serieMensuelle: ligne.serieMensuelle,
          hausseAnnuelle: ligne.hausseAnnuelle,
          hausseParAn: ligne.hausseParAn,
          moisAcquisition: ligne.moisAcquisition,
          renouvellement: ligne.renouvellement,
        }),
      ),
      quantite_pessimiste: null,
      quantite_realiste: null,
      quantite_optimiste: null,
      pertes: 0,
    };
  }
  return {
    ...trace,
    sens: "revenu",
    type: ligne.typeRevenu,
    quantite: null,
    frequence: 1,
    nature: null,
    classe: null,
    duree_vie_ans: null,
    mois: ligne.moisVente ?? null,
    champs_controle: versJson(
      sansIndefini({
        bornesQuantite: ligne.bornesQuantite,
        client: ligne.client,
        perenne: ligne.perenne,
        debouche: ligne.debouche,
        calendrier: ligne.calendrier,
        serieMensuelle: ligne.serieMensuelle,
        hausseAnnuelle: ligne.hausseAnnuelle,
        hausseParAn: ligne.hausseParAn,
      }),
    ),
    quantite_pessimiste: ligne.quantite.pessimiste,
    quantite_realiste: ligne.quantite.realiste,
    quantite_optimiste: ligne.quantite.optimiste,
    pertes: ligne.pertes ?? 0,
  };
}

/** Relit le groupe jsonb d'une rangée ; une valeur hors schéma est signalée plutôt que passée sous silence. */
function lireControles<S extends z.ZodType>(schema: S, r: RangeeLigne): z.output<S> {
  const p = schema.safeParse(r.champs_controle ?? {});
  if (!p.success) {
    throw new ErreurPlan(`Champs de contrôle illisibles sur la ligne « ${r.libelle} » : ${p.error.issues.map((i) => i.path.join(".") + " " + i.message).join(" ; ")}`, "base");
  }
  return p.data;
}

/** Rangée de la base → ligne du plan. */
export function versLigne(r: RangeeLigne): LignePlan {
  const commune: LigneCommune = {
    id: r.id,
    atelierId: r.atelier_id,
    libelle: r.libelle,
    unite: r.unite,
    prixUnitaire: Number(r.prix_unitaire),
    base: r.base as "cycle" | "an",
    cyclesParAn: Number(r.cycles_par_an),
    mois: r.mois,
    origine: r.origine as OriginePlan,
    modeleId: r.modele_id,
    ajustements: (r.ajustements ?? []) as unknown as LigneCommune["ajustements"],
    sourcePrix: (r.source_prix ?? null) as unknown as LigneCommune["sourcePrix"],
    ordre: r.ordre,
  };
  if (r.sens === "charge") {
    return {
      ...commune,
      controles: lireControles(schemaControlesCharge, r),
      sens: "charge",
      type: r.type as LigneChargePlan["type"],
      quantite: Number(r.quantite),
      frequence: Number(r.frequence),
      nature: r.nature as LigneChargePlan["nature"],
      classe: r.classe as LigneChargePlan["classe"],
      dureeVieAns: r.duree_vie_ans === null ? null : Number(r.duree_vie_ans),
    };
  }
  return {
    ...commune,
    controles: lireControles(schemaControlesRevenu, r),
    sens: "revenu",
    type: r.type as LigneRevenuPlan["type"],
    quantites: {
      pessimiste: Number(r.quantite_pessimiste),
      realiste: Number(r.quantite_realiste),
      optimiste: Number(r.quantite_optimiste),
    },
    pertes: Number(r.pertes),
  };
}

/** Ligne du plan → ligne du moteur financier. */
export function versMoteur(l: LignePlan): { charge: LigneCharge } | { revenu: LigneRevenu } {
  if (l.sens === "charge") {
    return {
      charge: {
        id: l.id,
        libelle: l.libelle,
        typeCharge: l.type,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        frequence: l.frequence,
        base: l.base,
        cyclesParAn: l.cyclesParAn,
        nature: l.nature,
        classe: l.classe,
        dureeVieAns: l.dureeVieAns ?? undefined,
        moisDecaissement: l.mois ?? undefined,
        atelierId: l.atelierId ?? undefined,
        ...l.controles,
      },
    };
  }
  return {
    revenu: {
      id: l.id,
      libelle: l.libelle,
      typeRevenu: l.type,
      quantite: l.quantites,
      prixUnitaire: l.prixUnitaire,
      pertes: l.pertes,
      base: l.base,
      cyclesParAn: l.cyclesParAn,
      moisVente: l.mois ?? undefined,
      atelierId: l.atelierId ?? undefined,
      ...l.controles,
    },
  };
}

/** Nouvelle ligne validée → rangée à insérer. */
export function depuisSaisie(planId: string, entree: NouvelleLigne, origine: Auteur, ordre: number): InsertionLigne {
  const l = verifier(schemaNouvelleLigne, entree);
  const trace = {
    plan_id: planId,
    atelier_id: l.atelierId ?? null,
    libelle: l.libelle,
    unite: l.unite,
    prix_unitaire: l.prixUnitaire,
    base: l.base,
    cycles_par_an: l.cyclesParAn,
    mois: l.mois ?? null,
    origine,
    modele_id: null,
    ajustements: versJson([]),
    source_prix: null,
    ordre,
  };
  if (l.sens === "charge") {
    return {
      ...trace,
      sens: "charge",
      type: l.type,
      quantite: l.quantite,
      frequence: l.frequence,
      nature: l.nature,
      classe: l.classe,
      duree_vie_ans: l.dureeVieAns ?? null,
      champs_controle: versJson(sansIndefini(l.controles ?? {})),
      pertes: 0,
    };
  }
  return {
    ...trace,
    sens: "revenu",
    type: l.type,
    quantite_pessimiste: l.quantites.pessimiste,
    quantite_realiste: l.quantites.realiste,
    quantite_optimiste: l.quantites.optimiste,
    champs_controle: versJson(sansIndefini(l.controles ?? {})),
    pertes: l.pertes,
  };
}

/**
 * Applique une correction à une ligne et renvoie les colonnes à mettre à jour.
 * La ligne corrigée est revalidée par le schéma du moteur : une correction incohérente est refusée avant la base.
 */
export function appliquerCorrection(ligne: LignePlan, correction: CorrectionLigne, origine: Auteur): Database["public"]["Tables"]["plan_lignes"]["Update"] {
  const c = verifier(schemaCorrectionLigne, correction);
  const propresCharge = ["quantite", "frequence", "nature", "classe", "dureeVieAns"] as const;
  const propresRevenu = ["quantites", "pertes"] as const;
  const interdits = ligne.sens === "charge" ? propresRevenu : propresCharge;
  const fautifs = interdits.filter((k) => k in c);
  if (fautifs.length > 0) {
    throw new ErreurPlan(`Champs sans objet pour une ligne de ${ligne.sens} : ${fautifs.join(", ")}.`, "invalide");
  }
  if (c.controles !== undefined) {
    const p = (ligne.sens === "charge" ? schemaControlesCharge : schemaControlesRevenu).safeParse(c.controles);
    if (!p.success) {
      const details = p.error.issues.map((i) => `controles.${i.path.join(".")} : ${i.message}`);
      throw new ErreurPlan(`Champs de contrôle sans objet pour une ligne de ${ligne.sens} : ${details.join(" ; ")}`, "invalide", details);
    }
  }
  const corrigee = { ...ligne, ...c } as LignePlan;
  const moteur = versMoteur(corrigee);
  const r = "charge" in moteur ? schemaLigneCharge.safeParse(moteur.charge) : schemaLigneRevenu.safeParse(moteur.revenu);
  if (!r.success) {
    const details = r.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`);
    throw new ErreurPlan(`Correction incohérente : ${details.join(" ; ")}`, "invalide", details);
  }
  const maj: Database["public"]["Tables"]["plan_lignes"]["Update"] = { origine };
  if (c.libelle !== undefined) maj.libelle = c.libelle;
  if (c.unite !== undefined) maj.unite = c.unite;
  if (c.prixUnitaire !== undefined) {
    maj.prix_unitaire = c.prixUnitaire;
    maj.source_prix = null;
  }
  if (c.base !== undefined) maj.base = c.base;
  if (c.cyclesParAn !== undefined) maj.cycles_par_an = c.cyclesParAn;
  if (c.mois !== undefined) maj.mois = c.mois;
  if (c.quantite !== undefined) maj.quantite = c.quantite;
  if (c.frequence !== undefined) maj.frequence = c.frequence;
  if (c.nature !== undefined) maj.nature = c.nature;
  if (c.classe !== undefined) maj.classe = c.classe;
  if (c.dureeVieAns !== undefined) maj.duree_vie_ans = c.dureeVieAns;
  if (c.quantites !== undefined) {
    maj.quantite_pessimiste = c.quantites.pessimiste;
    maj.quantite_realiste = c.quantites.realiste;
    maj.quantite_optimiste = c.quantites.optimiste;
  }
  if (c.pertes !== undefined) maj.pertes = c.pertes;
  if (c.controles !== undefined) maj.champs_controle = versJson(sansIndefini(c.controles));
  return maj;
}
