// Export d'un plan (S4) : lit le plan, le profil, le financeur et le référentiel avec les droits de l'utilisateur, fait tourner les moteurs
// qui manquent (financement, crédit, débouchés, main d'oeuvre), puis laisse les constructeurs purs (dossier.ts, porteur.ts) mettre en forme.
// Aucun chiffre n'est calculé ici : tous viennent des moteurs. Aucune écriture en base.
import { z } from "zod";
import { lireExploitation, type ClientBase } from "@/core/exploitation";
import { calculerCredit, calculerFinancement } from "@/moteurs";
import type { ResultatScenario } from "@/moteurs/finance";
import { trouverRegleFinanceur } from "@/referentiel";
import { lireCircuits } from "@/referentiel/debouches";
import { analyserDebouches, schemaDebouches } from "../debouches";
import { ErreurPlan } from "../erreurs";
import { assemblerFinancement, financerPlan, schemaDemandeFinancement } from "../financement";
import { verifier } from "../lignes";
import { evaluerMainOeuvre, schemaDemandeMainOeuvre } from "../main-oeuvre";
import { lireProfil } from "../profil";
import { lirePlan, type Plan } from "../service";
import { construireDossier } from "./dossier";
import { construirePorteur } from "./porteur";
import { rendreHtml } from "./rendu-html";
import { rendrePdf } from "./rendu-pdf";
import type { DocumentExport, DonneesDossier, TresoreriePlan } from "./types";

const texteLibre = z.string().trim().min(1).max(6000);
export const schemaRedaction = z.object({
  contexteEtJustification: texteLibre.optional(),
  descriptionEntreprise: texteLibre.optional(),
  formeJuridique: z.string().trim().min(1).max(200).optional(),
  objectif: texteLibre.optional(),
  descriptionProjet: texteLibre.optional(),
  produitsEtServices: texteLibre.optional(),
  concurrence: texteLibre.optional(),
  positionnement: texteLibre.optional(),
  strategieCommerciale: texteLibre.optional(),
  risques: z.array(z.object({ risque: texteLibre, probabilite: z.string().trim().min(1).max(100), impact: z.string().trim().min(1).max(100), mesure: texteLibre })).max(10).optional(),
  impacts: z.object({ economiques: texteLibre.optional(), environnementaux: texteLibre.optional(), sociaux: texteLibre.optional() }).optional(),
  suretes: texteLibre.optional(),
  calendrier: z.array(z.object({ etape: z.string().trim().min(1).max(200), debutMois: z.number().int().min(0).max(120), finMois: z.number().int().min(0).max(120) })).max(40).optional(),
  planB: texteLibre.optional(),
});

export const schemaDemandeExport = z.object({
  format: z.enum(["pdf", "html", "json"]).default("pdf"),
  version: z.enum(["dossier", "porteur"]).default("dossier"),
  /** Financeur visé (organisme de ref.regles_financeurs), avec le produit s'il en a plusieurs. */
  financeur: z.object({ organisme: z.string().trim().min(2), produit: z.string().trim().min(1).optional() }).optional(),
  /** Financement détaillé (M6), comme dans POST /plans/:id/financement. Absent : l'apport et le crédit du plan. */
  financement: schemaDemandeFinancement.optional(),
  /** Débouchés (R3), comme dans POST /exploitations/:id/debouches. */
  debouches: schemaDebouches.optional(),
  /** Main d'oeuvre (R2), comme dans POST /exploitations/:id/main-oeuvre. */
  mainOeuvre: schemaDemandeMainOeuvre.optional(),
  promoteur: z
    .object({ nom: z.string().trim().min(1).max(200), adresse: z.string().trim().min(1).max(300), contacts: z.string().trim().min(1).max(300), rccm: z.string().trim().min(1).max(100), effectif: z.string().trim().min(1).max(200) })
    .partial()
    .default({}),
  redaction: schemaRedaction.default({}),
});
export type DemandeExport = z.input<typeof schemaDemandeExport>;

export interface FichierExporte {
  contentType: string;
  nomFichier: string;
  /** Octets (pdf), texte (html) ou objet (json). */
  contenu: Buffer | string | DocumentExport;
}

/**
 * Adaptateur : la trésorerie lue sur la sortie du moteur. Le moteur 2.0.0 (M1) donne la grille de tout l'horizon (`tresorerieMensuelle`) ;
 * un plan calculé avec le moteur 1.x n'a que l'an 1 (`tresorerieMensuelleAn1`). Seul ce point change si le contrat du moteur change.
 */
export function tresorerieDepuisScenario(s: Pick<ResultatScenario, "tresorerieMensuelleAn1" | "pointBasTresorerie" | "moisDeficitaires"> & { tresorerieMensuelle?: ResultatScenario["tresorerieMensuelleAn1"] }): TresoreriePlan {
  const grille = s.tresorerieMensuelle ?? s.tresorerieMensuelleAn1;
  return {
    horizonMois: Math.max(...grille.map((m) => m.mois)),
    mois: grille.map((m) => ({ mois: m.mois, entrees: m.entrees, sorties: m.sorties, prelevementsNets: m.prelevementsNets, solde: m.solde, cumul: m.cumul, retraitPossible: m.retraitPossible })),
    pointBas: s.pointBasTresorerie,
    moisDeficitaires: s.moisDeficitaires,
  };
}

/** Pur : le document d'après les données déjà réunies. */
export function composerDocument(version: "dossier" | "porteur", donnees: DonneesDossier): DocumentExport {
  return version === "dossier" ? construireDossier(donnees) : construirePorteur(donnees);
}

const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "plan";

export async function reunirDonnees(client: ClientBase, plan: Plan, demande: z.output<typeof schemaDemandeExport>, genereLe: string): Promise<DonneesDossier> {
  if (!plan.resultats) throw new ErreurPlan("Ce plan n'a pas encore de résultat : calcule-le d'abord.", "invalide");
  const resultats = plan.resultats;
  const [exploitation, profil, regle] = await Promise.all([
    lireExploitation(client, plan.exploitationId),
    lireProfil(client, plan.exploitationId, { tolerant: true }),
    demande.financeur ? trouverRegleFinanceur(client, demande.financeur.organisme, demande.financeur.produit) : Promise.resolve(null),
  ]);
  if (demande.financeur && !regle) throw new ErreurPlan(`Financeur inconnu du référentiel : ${demande.financeur.organisme}.`, "invalide");

  const financement = demande.financement
    ? (await financerPlan(client, plan.id, demande.financement)).financement
    : calculerFinancement(
        assemblerFinancement(
          plan,
          schemaDemandeFinancement.parse({
            apportEspeces: plan.financement.apport,
            prets: plan.financement.credit ? [{ id: "credit-du-plan", libelle: "Crédit du plan", moisTirage: 0, credit: plan.financement.credit }] : [],
          }),
          new Map(),
        ).entree,
      );

  const debouches = demande.debouches ? analyserDebouches(demande.debouches, await lireCircuits(client)) : null;
  const mainOeuvre = demande.mainOeuvre ? (await evaluerMainOeuvre(client, plan.exploitationId, demande.mainOeuvre)).mainOeuvre : null;

  return {
    genereLe,
    titrePlan: plan.titre,
    exploitation: { nom: exploitation.nom, lieu: exploitation.lieu, ateliers: exploitation.ateliers.map((a) => ({ libelle: a.libelle, speculationCode: a.speculationCode, taille: a.taille, unite: a.unite })) },
    promoteur: demande.promoteur,
    profil,
    hypotheses: plan.hypotheses,
    generation: plan.generation,
    lignes: plan.lignes,
    resultats,
    scenario: resultats.scenarios.realiste,
    credit: plan.financement.credit ? calculerCredit(plan.financement.credit) : null,
    financeur: regle,
    financement,
    debouches,
    mainOeuvre,
    tresorerie: tresorerieDepuisScenario(resultats.scenarios.realiste),
    redaction: demande.redaction,
  };
}

/**
 * Exporte un plan : PDF (par défaut), HTML ou JSON du document. `genereLe` est injectable (tests).
 * Le plan doit avoir un résultat : un plan jamais calculé n'a rien à exporter.
 */
export async function exporterPlan(client: ClientBase, planId: string, corps: unknown, { genereLe = new Date().toISOString() } = {}): Promise<FichierExporte> {
  const demande = verifier(schemaDemandeExport, corps);
  const plan = await lirePlan(client, planId);
  const donnees = await reunirDonnees(client, plan, demande, genereLe);
  const document = composerDocument(demande.version, donnees);
  const base = `${demande.version === "dossier" ? "dossier-financement" : "mon-projet"}-${slug(plan.titre)}`;
  if (demande.format === "json") return { contentType: "application/json", nomFichier: `${base}.json`, contenu: document };
  if (demande.format === "html") return { contentType: "text/html; charset=utf-8", nomFichier: `${base}.html`, contenu: rendreHtml(document) };
  return { contentType: "application/pdf", nomFichier: `${base}.pdf`, contenu: await rendrePdf(document) };
}
