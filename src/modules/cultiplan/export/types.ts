// Dossier exporté (S4) : le modèle de document et les données d'entrée.
// Principe : le texte est rédigé (gabarits de ce dossier) et les chiffres viennent UNIQUEMENT des moteurs (plan.resultats, financement,
// débouchés, main d'oeuvre, crédit). Le constructeur de document est pur : il met en forme, il ne calcule rien d'important et ne lit aucune base.
import type { ResultatCredit, ResultatFinancement } from "@/moteurs";
import type { ResultatFinance, ResultatScenario } from "@/moteurs/finance";
import type { ResultatMainOeuvre } from "@/moteurs/main-oeuvre";
import type { RegleFinanceurRef } from "@/referentiel";
import type { ResultatDebouches } from "../debouches";
import type { LignePlan } from "../lignes";
import type { ProfilPorteur } from "../profil";
import type { Hypotheses, InfosGeneration } from "../service";

/** Un bloc de contenu. Les rendus HTML et PDF savent tous afficher ces cinq blocs. */
export type Bloc =
  | { type: "paragraphe"; texte: string }
  | { type: "liste"; items: string[] }
  | { type: "definitions"; lignes: { terme: string; definition: string }[] }
  | { type: "cle_valeur"; lignes: [string, string][] }
  | { type: "tableau"; legende?: string; entetes: string[]; lignes: string[][]; /** Indices des lignes à mettre en gras (totaux). */ gras?: number[] }
  | { type: "alerte"; niveau: "info" | "alerte" | "bloquant"; texte: string }
  | { type: "case_a_cocher"; items: { coche: boolean; texte: string; detail?: string }[] };

export interface SectionDocument {
  /** Numéro affiché (« 1 », « 10.8 »...) ; vide pour une partie sans numéro. */
  numero: string;
  titre: string;
  blocs: Bloc[];
  /** Commence sur une nouvelle page. */
  nouvellePage?: boolean;
}

export interface DocumentExport {
  /** « dossier » : dossier de financement ; « porteur » : version courte en langage simple. */
  version: "dossier" | "porteur";
  /** « anpgf » : au format du canevas ANPGF (financeur togolais) ; « generique » : mêmes parties, sans les renvois au canevas. */
  format: "anpgf" | "generique";
  titre: string;
  sousTitre: string;
  /** Lignes de la page de titre (cle, valeur). */
  pageDeTitre: [string, string][];
  sections: SectionDocument[];
  /** Ce que l'équipe ou le porteur doit encore fournir ou rédiger : liste reprise en dernière page du dossier. */
  aCompleter: string[];
  pied: string;
}

/** Textes rédigés par le porteur (ou proposés par Cultisia puis relus). Un texte absent est signalé « à compléter », jamais inventé. */
export interface Redaction {
  contexteEtJustification?: string;
  descriptionEntreprise?: string;
  formeJuridique?: string;
  objectif?: string;
  descriptionProjet?: string;
  produitsEtServices?: string;
  concurrence?: string;
  positionnement?: string;
  strategieCommerciale?: string;
  risques?: { risque: string; probabilite: string; impact: string; mesure: string }[];
  impacts?: { economiques?: string; environnementaux?: string; sociaux?: string };
  suretes?: string;
  /** Étapes du calendrier de réalisation, en mois à partir du démarrage. */
  calendrier?: { etape: string; debutMois: number; finMois: number }[];
  /** Plan B du porteur, en langage simple, pour la version porteur. */
  planB?: string;
}

export interface Promoteur {
  nom?: string;
  adresse?: string;
  contacts?: string;
  rccm?: string;
  effectif?: string;
}

/** Trésorerie mensuelle lue sur la sortie du moteur par son contrat actuel (an 1). Quand M1 donnera une grille pluriannuelle, seul l'adaptateur du service change. */
export interface TresoreriePlan {
  /** Nombre de mois couverts par la grille (12 aujourd'hui). */
  horizonMois: number;
  mois: { mois: number; entrees: number; sorties: number; prelevementsNets: number; solde: number; cumul: number; retraitPossible: number }[];
  pointBas: { montant: number; mois: number };
  moisDeficitaires: number[];
}

export interface DonneesDossier {
  /** Date de génération (ISO), fournie par l'appelant : le constructeur n'appelle pas l'horloge. */
  genereLe: string;
  titrePlan: string;
  exploitation: { nom: string; lieu: string | null; ateliers: { libelle: string | null; speculationCode: string; taille: number; unite: string }[] };
  promoteur: Promoteur;
  profil: ProfilPorteur;
  hypotheses: Hypotheses;
  generation: InfosGeneration;
  lignes: LignePlan[];
  resultats: ResultatFinance;
  /** Scénario affiché dans les tableaux (réaliste). */
  scenario: ResultatScenario;
  /** Échéancier du crédit du plan (moteur de crédit) ; null sans crédit. */
  credit: ResultatCredit | null;
  /** Financeur visé et sa règle de `ref` ; null si aucun n'est choisi. */
  financeur: RegleFinanceurRef | null;
  financement: ResultatFinancement;
  debouches: ResultatDebouches | null;
  mainOeuvre: ResultatMainOeuvre | null;
  tresorerie: TresoreriePlan;
  redaction: Redaction;
}
