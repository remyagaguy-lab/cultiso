// Atelier animal ou cheptel dans le plan : les lignes de `lignesDepuisBandes` / `lignesDepuisTroupeau` (src/moteurs/raccord.ts) sont
// rangées dans le plan et calculées dans la grille de `calculerFinances` (trésorerie pluriannuelle, VAN, ménage, contrôles).
// Rien n'est inventé : courbes du référentiel, prix et effectifs de l'appelant, durée de vie du référentiel ou de l'appelant avec sa source.
// Les lignes d'un atelier raccordé portent le libellé « <nom> : ... » ; raccorder à nouveau le même nom REMPLACE ses lignes.
import { z } from "zod";
import type { ClientBase } from "@/core/exploitation";
import { lignesDepuisBandes, lignesDepuisTroupeau, simulerTroupeau, schemaTroupeau, type LignesRaccordees, type ResultatTroupeau } from "@/moteurs";
import { lireSpeculations } from "@/referentiel";
import { lireVariantesElevage } from "@/referentiel/elevage";
import { choisirDureeVie, lireInvestissementsReference, type DureeVieReferentiel } from "@/referentiel/duree-vie";
import { erreurBase, ErreurPlan } from "./erreurs";
import { simulerAtelierAnimal, schemaAtelierAnimal, type ResultatAtelierAnimal } from "./atelier-animal";
import { depuisSaisie, TYPES_CHARGE, TYPES_REVENU, verifier, type NouvelleLigne } from "./lignes";
import { lirePlan, recalculer, type Plan } from "./service";

const commun = {
  /** Nom de l'atelier dans le plan (2 à 40 caractères) : préfixe des lignes, clé de remplacement. */
  nom: z.string().trim().min(2).max(40),
  atelierId: z.uuid().optional(),
  /** Le mois 1 de l'atelier tombe au mois `decalageMois + 1` du plan. */
  decalageMois: z.number().int().min(0).max(119).default(0),
};
const parametre = z.object({ valeur: z.number().positive().max(100), source: z.string().trim().min(2, "la source est obligatoire") });

const demandeBandes = schemaAtelierAnimal.extend({
  type: z.literal("bandes"),
  speculation: z.string().trim().min(2).max(60),
  /** Durée de vie (ans) de l'investissement, si le référentiel n'en donne pas une seule ; l'emporte sinon. */
  dureeVieInvestissement: parametre.optional(),
  ...commun,
});
const demandeTroupeau = schemaTroupeau.extend({ type: z.literal("troupeau"), ...commun });
export const schemaDemandeAtelierPlan = z.discriminatedUnion("type", [demandeBandes, demandeTroupeau]);
export type DemandeAtelierPlan = z.input<typeof schemaDemandeAtelierPlan>;

export interface ResultatAtelierPlan {
  statut: "raccorde" | "non_evalue";
  type: "bandes" | "troupeau";
  /** Plan recalculé ; null si l'atelier n'a pas pu être évalué (le plan n'est alors pas touché). */
  plan: Plan | null;
  lignes: { ajoutees: number; remplacees: number };
  /** Origine de la durée de vie de l'investissement (bandes). */
  dureeVie: { valeur: number; source: string; origine: "referentiel" | "appelant"; statut?: string } | null;
  manques: string[];
  avertissements: string[];
  simulation: ResultatAtelierAnimal | ResultatTroupeau;
}

const prefixe = (nom: string) => `${nom} : `;

/** Pur : lignes raccordées → lignes de plan (libellé préfixé, série mensuelle rangée dans `controles`). */
export function lignesDePlan(r: LignesRaccordees, nom: string, atelierId?: string): NouvelleLigne[] {
  const types = new Set<string>(TYPES_CHARGE);
  const typesRevenu = new Set<string>(TYPES_REVENU);
  const lignes: NouvelleLigne[] = [];
  for (const c of r.charges) {
    if (!types.has(c.typeCharge)) throw new ErreurPlan(`Type de charge inconnu : ${c.typeCharge}.`, "invalide");
    lignes.push({
      sens: "charge",
      type: c.typeCharge as (typeof TYPES_CHARGE)[number],
      libelle: `${prefixe(nom)}${c.libelle}`.slice(0, 120),
      unite: "forfait",
      quantite: c.quantite,
      prixUnitaire: c.prixUnitaire,
      nature: c.nature,
      classe: c.classe,
      dureeVieAns: c.dureeVieAns ?? null,
      atelierId: atelierId ?? null,
      controles: { serieMensuelle: c.serieMensuelle, moisAcquisition: c.classe === "investissement" ? c.moisAcquisition : undefined },
    });
  }
  for (const v of r.revenus) {
    if (!typesRevenu.has(v.typeRevenu)) throw new ErreurPlan(`Type de revenu inconnu : ${v.typeRevenu}.`, "invalide");
    lignes.push({
      sens: "revenu",
      type: v.typeRevenu as (typeof TYPES_REVENU)[number],
      libelle: `${prefixe(nom)}${v.libelle}`.slice(0, 120),
      unite: "forfait",
      quantites: v.quantite,
      prixUnitaire: v.prixUnitaire,
      atelierId: atelierId ?? null,
      controles: { serieMensuelle: v.serieMensuelle },
    });
  }
  return lignes;
}

/** Pur : durée de vie retenue (appelant d'abord, sinon référentiel) ou la raison pour laquelle il n'y en a pas. */
export function retenirDureeVie(demandee: { valeur: number; source: string } | undefined, ref: DureeVieReferentiel | null): { dureeVie: ResultatAtelierPlan["dureeVie"]; manque: string | null } {
  if (demandee) return { dureeVie: { valeur: demandee.valeur, source: demandee.source, origine: "appelant" }, manque: null };
  if (ref?.statut === "trouvee") return { dureeVie: { valeur: ref.dureeVieAns, source: ref.source, origine: "referentiel", statut: ref.statutDonnee }, manque: null };
  return { dureeVie: null, manque: ref?.message ?? null };
}

/** Ajoute les nouvelles lignes, retire les anciennes du même nom (dans cet ordre : une panne ne fait rien perdre), puis recalcule. */
async function ranger(client: ClientBase, plan: Plan, nom: string, nouvelles: NouvelleLigne[]): Promise<{ plan: Plan; remplacees: number }> {
  const anciennes = plan.lignes.filter((l) => l.libelle.startsWith(prefixe(nom)));
  const ordre = plan.lignes.reduce((max, l) => Math.max(max, l.ordre), -1) + 1;
  if (nouvelles.length > 0) {
    const ins = await client.from("plan_lignes").insert(nouvelles.map((l, i) => depuisSaisie(plan.id, l, "utilisateur", ordre + i)));
    if (ins.error) throw erreurBase(ins.error);
  }
  if (anciennes.length > 0) {
    const sup = await client
      .from("plan_lignes")
      .delete()
      .eq("plan_id", plan.id)
      .in("id", anciennes.map((l) => l.id));
    if (sup.error) throw erreurBase(sup.error);
  }
  return { plan: await recalculer(client, plan.id), remplacees: anciennes.length };
}

const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "_");

/** Raccorde un atelier animal à bandes ou un cheptel à un plan en brouillon, puis recalcule le plan. */
export async function raccorderAtelierAuPlan(client: ClientBase, planId: string, corps: unknown): Promise<ResultatAtelierPlan> {
  const d = verifier(schemaDemandeAtelierPlan, corps);
  const plan = await lirePlan(client, planId);
  if (plan.statut !== "brouillon") throw new ErreurPlan("Ce plan est figé (lancé ou archivé). Duplique-le pour tester une variante.", "fige");

  if (d.type === "troupeau") {
    const { type: _t, nom, atelierId, decalageMois, ...entree } = d;
    void _t;
    const simulation = simulerTroupeau(entree);
    const l = lignesDepuisTroupeau(simulation, { prefixe: nom, atelierId, decalageMois });
    const r = await ranger(client, plan, nom, lignesDePlan(l, nom, atelierId));
    return { statut: "raccorde", type: "troupeau", plan: r.plan, lignes: { ajoutees: l.charges.length + l.revenus.length, remplacees: r.remplacees }, dureeVie: null, manques: [], avertissements: l.avertissements, simulation };
  }

  const { type: _t, nom, atelierId, decalageMois, speculation: terme, dureeVieInvestissement, ...parametres } = d;
  void _t;
  const catalogue = await lireSpeculations(client);
  const trouvee = catalogue.find((s) => s.code === normaliser(terme) || normaliser(s.nom) === normaliser(terme));
  if (!trouvee) throw new ErreurPlan(`Spéculation inconnue du référentiel : ${terme}. Disponibles : ${catalogue.map((s) => s.nom).join(", ")}.`, "invalide");
  const simulation = simulerAtelierAnimal({ speculation: trouvee.nom, variantes: await lireVariantesElevage(client, trouvee.code), parametres });
  if (simulation.statut !== "calculee" || !simulation.resultat) {
    return { statut: "non_evalue", type: "bandes", plan: null, lignes: { ajoutees: 0, remplacees: 0 }, dureeVie: null, manques: simulation.manques, avertissements: [], simulation };
  }
  const investissement = simulation.resultat.mois[0]?.investissement ?? 0;
  // La durée de vie n'est cherchée que s'il y a un investissement à amortir et que l'appelant n'en donne pas.
  const ref = investissement > 0 && !dureeVieInvestissement ? choisirDureeVie(trouvee.nom, await lireInvestissementsReference(client, trouvee.code)) : null;
  const { dureeVie, manque } = investissement > 0 ? retenirDureeVie(dureeVieInvestissement, ref) : { dureeVie: null, manque: null };
  const l = lignesDepuisBandes(simulation.resultat, { prefixe: nom, atelierId, decalageMois, dureeVieAns: dureeVie?.valeur });
  const r = await ranger(client, plan, nom, lignesDePlan(l, nom, atelierId));
  return {
    statut: "raccorde",
    type: "bandes",
    plan: r.plan,
    lignes: { ajoutees: l.charges.length + l.revenus.length, remplacees: r.remplacees },
    dureeVie,
    manques: [...simulation.manques, ...(manque ? [manque] : [])],
    avertissements: l.avertissements,
    simulation,
  };
}
