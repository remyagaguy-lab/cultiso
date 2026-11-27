// Lecture du référentiel agricole (schéma ref) : spéculations, modèles de charges et de revenus,
// questions de terrain, règles d'ajustement. Lecture seule ; l'écriture passe par le serveur.
// Chaque ligne lue est validée par le schéma du moteur qui la consommera : une donnée incohérente
// en base est signalée ici, pas au milieu d'un calcul.
import { z } from "zod";
import type { Atelier, ClientBase } from "@/core/exploitation";
import {
  schemaModeleCharge,
  schemaModeleRevenu,
  schemaRegle,
  type EntreeBudget,
  type ModeleCharge,
  type ModeleRevenu,
  type RegleAjustement,
} from "@/moteurs/budget";

export type StatutDonnee = "brouillon_ia" | "a_valider" | "validee";

export interface Speculation {
  code: string;
  nom: string;
  secteur: "vegetal" | "animal" | "halieutique" | "transformation" | "services";
  sousSecteur: string | null;
  uniteEchelle: string;
  dureeCycleJours: number | null;
  cyclesParAn: number;
  zones: string[];
  statut: StatutDonnee;
  source: string | null;
}

export interface QuestionTerrain {
  cle: string;
  libelle: string;
  sousTitre: string | null;
  reponses: { valeur: string; libelle: string }[];
  secteurs: string[];
  ordre: number;
  statut: StatutDonnee;
}

/** Donnée du référentiel absente ou incohérente. */
export class ErreurReferentiel extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurReferentiel";
  }
}

const schemaSpeculation = z.object({
  code: z.string(),
  nom: z.string(),
  secteur: z.enum(["vegetal", "animal", "halieutique", "transformation", "services"]),
  sousSecteur: z.string().nullable(),
  uniteEchelle: z.string(),
  dureeCycleJours: z.number().nullable(),
  cyclesParAn: z.number().positive(),
  zones: z.array(z.string()),
  statut: z.enum(["brouillon_ia", "a_valider", "validee"]),
  source: z.string().nullable(),
});

const schemaQuestion = z.object({
  cle: z.string(),
  libelle: z.string(),
  sousTitre: z.string().nullable(),
  reponses: z.array(z.object({ valeur: z.string().min(1), libelle: z.string().min(1) })),
  secteurs: z.array(z.string()),
  ordre: z.number(),
  statut: z.enum(["brouillon_ia", "a_valider", "validee"]),
});

function conforme<S extends z.ZodType>(schema: S, donnee: unknown, quoi: string): z.output<S> {
  const r = schema.safeParse(donnee);
  if (!r.success) {
    const details = r.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" ; ");
    throw new ErreurReferentiel(`Donnée du référentiel incohérente (${quoi}) : ${details}`);
  }
  return r.data;
}

function echec(quoi: string, error: { message: string }): never {
  throw new ErreurReferentiel(`Lecture du référentiel impossible (${quoi}) : ${error.message}`);
}

const ref = (client: ClientBase) => client.schema("ref");

export async function lireSpeculations(
  client: ClientBase,
  filtres: { codes?: string[]; secteur?: Speculation["secteur"] } = {},
): Promise<Speculation[]> {
  let requete = ref(client).from("speculations").select("*").order("nom");
  if (filtres.codes) requete = requete.in("code", filtres.codes);
  if (filtres.secteur) requete = requete.eq("secteur", filtres.secteur);
  const { data, error } = await requete;
  if (error) echec("spéculations", error);
  return data.map((s) =>
    conforme(
      schemaSpeculation,
      {
        code: s.code,
        nom: s.nom,
        secteur: s.secteur,
        sousSecteur: s.sous_secteur,
        uniteEchelle: s.unite_echelle,
        dureeCycleJours: s.duree_cycle_jours,
        cyclesParAn: Number(s.cycles_par_an),
        zones: s.zones,
        statut: s.statut,
        source: s.source,
      },
      `spéculation ${s.code}`,
    ),
  );
}

export async function lireModeles(
  client: ClientBase,
  codes: string[],
): Promise<{ modelesCharges: ModeleCharge[]; modelesRevenus: ModeleRevenu[] }> {
  const [charges, revenus] = await Promise.all([
    ref(client).from("modeles_charges").select("*").in("speculation_code", codes).order("ordre"),
    ref(client).from("modeles_revenus").select("*").in("speculation_code", codes).order("ordre"),
  ]);
  if (charges.error) echec("modèles de charges", charges.error);
  if (revenus.error) echec("modèles de revenus", revenus.error);
  return {
    modelesCharges: charges.data.map((c) =>
      conforme(
        schemaModeleCharge,
        {
          id: c.id,
          speculationCode: c.speculation_code,
          typeCharge: c.type_charge,
          libelle: c.libelle,
          unite: c.unite,
          quantite: Number(c.quantite),
          prixReference: Number(c.prix_reference),
          produitPrix: c.produit_prix ?? undefined,
          frequence: Number(c.frequence),
          base: c.base,
          nature: c.nature,
          classe: c.classe,
          dureeVieAns: c.duree_vie_ans === null ? undefined : Number(c.duree_vie_ans),
          moisDecaissement: c.mois_decaissement ?? undefined,
          statut: c.statut,
        },
        `charge « ${c.libelle} »`,
      ),
    ),
    modelesRevenus: revenus.data.map((r) =>
      conforme(
        schemaModeleRevenu,
        {
          id: r.id,
          speculationCode: r.speculation_code,
          typeRevenu: r.type_revenu,
          libelle: r.libelle,
          unite: r.unite,
          quantite: {
            pessimiste: Number(r.quantite_pessimiste),
            realiste: Number(r.quantite_realiste),
            optimiste: Number(r.quantite_optimiste),
          },
          pertes: Number(r.pertes),
          prixReference: Number(r.prix_reference),
          produitPrix: r.produit_prix ?? undefined,
          base: r.base,
          moisVente: r.mois_vente ?? undefined,
          statut: r.statut,
        },
        `revenu « ${r.libelle} »`,
      ),
    ),
  };
}

/** Questions de terrain, dans l'ordre ; avec un secteur, seulement celles qui le concernent (ou tous les secteurs). */
export async function lireQuestionsTerrain(client: ClientBase, secteurs?: string[]): Promise<QuestionTerrain[]> {
  const { data, error } = await ref(client).from("questions_terrain").select("*").order("ordre");
  if (error) echec("questions de terrain", error);
  return data
    .map((q) =>
      conforme(
        schemaQuestion,
        {
          cle: q.cle,
          libelle: q.libelle,
          sousTitre: q.sous_titre,
          reponses: q.reponses,
          secteurs: q.secteurs,
          ordre: q.ordre,
          statut: q.statut,
        },
        `question ${q.cle}`,
      ),
    )
    .filter((q) => !secteurs || q.secteurs.length === 0 || q.secteurs.some((s) => secteurs.includes(s)));
}

/** Règles applicables à ces spéculations (règles générales comprises). */
export async function lireRegles(client: ClientBase, codes: string[]): Promise<RegleAjustement[]> {
  const { data, error } = await ref(client).from("regles_ajustement").select("*");
  if (error) echec("règles d'ajustement", error);
  return data
    .filter((r) => r.speculation_code === null || codes.includes(r.speculation_code))
    .map((r) =>
      conforme(
        schemaRegle,
        {
          id: r.id,
          cleQuestion: r.cle_question,
          valeur: r.valeur,
          speculationCode: r.speculation_code ?? undefined,
          effet: r.effet,
          cible: r.cible_sens
            ? { sens: r.cible_sens, type: r.cible_type ?? undefined, modeleId: r.cible_modele_id ?? undefined }
            : undefined,
          coefficient: r.coefficient === null ? undefined : Number(r.coefficient),
          ligne: r.ligne ?? undefined,
          statut: r.statut,
        },
        `règle ${r.id}`,
      ),
    );
}

/**
 * Prépare l'entrée du générateur de budget pour les ateliers et le contexte terrain d'une exploitation.
 * Les prix du marché sont ajoutés par l'appelant (étape du plan persistant).
 */
export async function preparerBudget(
  client: ClientBase,
  exploitation: { ateliers: Pick<Atelier, "id" | "speculationCode" | "taille">[]; contexte: Record<string, string> },
): Promise<EntreeBudget> {
  if (exploitation.ateliers.length === 0) throw new ErreurReferentiel("Ajoute au moins un atelier avant de générer le budget.");
  const codes = [...new Set(exploitation.ateliers.map((a) => a.speculationCode))];
  const [speculations, modeles, regles] = await Promise.all([
    lireSpeculations(client, { codes }),
    lireModeles(client, codes),
    lireRegles(client, codes),
  ]);
  const cycles = new Map(speculations.map((s) => [s.code, s.cyclesParAn]));
  return {
    ateliers: exploitation.ateliers.map((a) => {
      const cyclesParAn = cycles.get(a.speculationCode);
      if (cyclesParAn === undefined) throw new ErreurReferentiel(`Spéculation inconnue du référentiel : ${a.speculationCode}.`);
      return { atelierId: a.id, speculationCode: a.speculationCode, taille: a.taille, cyclesParAn };
    }),
    ...modeles,
    contexte: exploitation.contexte,
    regles,
    prix: [],
  };
}
