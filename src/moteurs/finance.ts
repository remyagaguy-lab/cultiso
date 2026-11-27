// Moteur financier (version 2.0.0, moteur calendaire M1) : grille mensuelle sur tout l'horizon (calendrier.ts), compte de résultat
// annuel tiré de la grille, trésorerie mensuelle pluriannuelle, BFR, seuil de rentabilité, VAN, TRI, délai de récupération, trois scénarios,
// revenu du ménage et capacité de remboursement (M3), contrôles nommés et ratios (M4), sensibilité (M5).
// Formules par ligne du Cultiso Brouillon (ground truth §II.2), pluriannuel du Stimulateur, crédit d'Agripilot.
// Le moteur ne connaît aucune filière : seulement des lignes de charges et de revenus.
//
// Conventions :
// - une ligne « cycle » compte par cycle de production et se répète `cyclesParAn` fois ; une ligne « an » compte par an ;
// - les investissements sont décaissés au mois d'acquisition (le démarrage par défaut), amortis en linéaire par mois (prorata) et
//   renouvelés à la fin de leur durée de vie tant que l'horizon le permet ;
// - VAN et TRI portent sur les flux économiques (avant financement) : −investissement initial, puis l'excédent brut de chaque année
//   complète moins les investissements et renouvellements de l'année ; aucune valeur résiduelle n'est comptée (choix prudent) ;
//   ils ne sont calculés que si l'horizon compte au moins deux années complètes ;
// - pas d'impôt calculé sur le résultat (fiscalité par pays : M8) ; un montant d'impôts annuel peut être fourni ;
// - le ménage (prélèvements, revenus extérieurs) est constant d'une année sur l'autre, sans hausse.
// Contrat complet : src/moteurs/CONTRAT.md.
import { z } from "zod";
import {
  champsHausseLigne,
  coefficientProduction,
  construireGrille,
  HORIZON_MAX_MOIS,
  indiceHausse,
  schemaCalendrierLigne,
  schemaHorizon,
  schemaMontee,
  schemaSerieMensuelle,
  sommeAnnee,
  type Horizon,
  type InvestissementDate,
  type LigneGrille,
} from "./calendrier";
import { fcfa, somme, taux, valider, VERSION_MOTEURS } from "./commun";
import { calculerRatios, controler, type Controle, type DonneesControles, type Ratios } from "./controles";
import { schemaCredit } from "./credit";
import { alertesPrudence } from "./prudence";
import { analyserSensibilite, type Sensibilite } from "./sensibilite";

export const TAUX_ACTUALISATION_PAR_DEFAUT = 0.12;
export const HORIZON_PAR_DEFAUT = 3;
/** Rentabilité (résultat cumulé / charges cumulées) au-dessus de laquelle le projet est « rentable », en dessous de l'opposé « déficitaire ». */
export const SEUIL_STATUT = 0.05;

export const SCENARIOS = ["pessimiste", "realiste", "optimiste"] as const;
export type Scenario = (typeof SCENARIOS)[number];

const mois = z.array(z.number().int().min(1).max(12)).min(1);

export const schemaLigneCharge = z
  .object({
    id: z.string().min(1),
    libelle: z.string().min(1),
    typeCharge: z.string().min(1),
    quantite: z.number().min(0),
    prixUnitaire: z.number().min(0),
    frequence: z.number().min(0).default(1),
    base: z.enum(["cycle", "an"]).default("cycle"),
    cyclesParAn: z.number().positive().default(1),
    nature: z.enum(["fixe", "variable"]),
    classe: z.enum(["investissement", "exploitation"]),
    dureeVieAns: z.number().positive().optional(),
    /** Mois de décaissement (1 à 12, relatifs au démarrage) ; réparti sur 12 mois sinon. */
    moisDecaissement: mois.optional(),
    /** Atelier de la ligne : rattache la ligne à la montée en production de cet atelier (M2). */
    atelierId: z.string().min(1).optional(),
    ...champsHausseLigne,
    /** Profil mensuel du cycle (R1) : remplace `moisDecaissement` pour une ligne par cycle. */
    calendrier: schemaCalendrierLigne.optional(),
    /** Série mensuelle exacte d'un moteur autonome (bandes, cheptel...) : remplace quantité, prix et calendrier. */
    serieMensuelle: schemaSerieMensuelle.optional(),
    /** Investissement : mois de l'achat (0 = démarrage, 1 à 120). */
    moisAcquisition: z.number().int().min(0).max(HORIZON_MAX_MOIS).optional(),
    /** Investissement : renouvelé à la fin de sa durée de vie si l'horizon le permet (vrai par défaut). */
    renouvellement: z.boolean().default(true),
    /** Fournisseur de la ligne, pour mesurer la concentration des achats (M4). */
    fournisseur: z.string().min(1).optional(),
    /** Quantité attendue d'après l'itinéraire technique du référentiel, dans l'unité et la période de `quantite` : sert à signaler un écart (M4, §3.6). */
    referenceItineraire: z.object({ quantite: z.number().min(0), source: z.string().optional() }).optional(),
    /** Consommation d'une bande ou d'un cycle : mois que couvre la quantité budgétée, et durée réelle de la bande (M14 attendu pour le calcul complet). */
    couverture: z.object({ moisCouverts: z.number().positive(), dureeBandeMois: z.number().positive() }).optional(),
    /** Emploi : effectif, salaire mensuel et mois travaillés, en attendant la main d'oeuvre calculée depuis le calendrier (M1, R2). */
    emploi: z
      .object({
        effectif: z.number().positive(),
        salaireMensuel: z.number().min(0).optional(),
        saisonnier: z.boolean().default(false),
        moisTravailles: mois.optional(),
      })
      .optional(),
  })
  .refine((l) => l.classe !== "investissement" || l.dureeVieAns !== undefined, {
    message: "un investissement doit avoir une durée de vie",
    path: ["dureeVieAns"],
  });

export const schemaLigneRevenu = z.object({
  id: z.string().min(1),
  libelle: z.string().min(1),
  typeRevenu: z.string().min(1),
  quantite: z.object({ pessimiste: z.number().min(0), realiste: z.number().min(0), optimiste: z.number().min(0) }),
  prixUnitaire: z.number().min(0),
  pertes: z.number().min(0).max(1).default(0),
  base: z.enum(["cycle", "an"]).default("cycle"),
  cyclesParAn: z.number().positive().default(1),
  /** Mois de vente (1 à 12) ; réparti sur 12 mois sinon. */
  moisVente: mois.optional(),
  /** Atelier de la ligne : rattache la ligne à la montée en production de cet atelier (M2). */
  atelierId: z.string().min(1).optional(),
  ...champsHausseLigne,
  /** Profil mensuel du cycle (R1) : remplace `moisVente` pour une ligne par cycle. */
  calendrier: schemaCalendrierLigne.optional(),
  /** Série mensuelle exacte d'un moteur autonome (bandes, cheptel...) : remplace quantité, prix, calendrier et montée en production. */
  serieMensuelle: schemaSerieMensuelle.optional(),
  /** Bornes de production du référentiel, dans l'unité et la période de `quantite`, déjà mises à la taille de l'atelier (M4). */
  bornesQuantite: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      source: z.string().optional(),
      /** Statut de la donnée du référentiel (brouillon_ia, a_valider, validee), repris dans les contrôles. */
      statut: z.string().optional(),
    })
    .optional(),
  /** Client principal de la ligne, pour mesurer la concentration des ventes (M4). */
  client: z.string().min(1).optional(),
  /** Culture pérenne ou cheptel à constituer : année où l'atelier produit (1 = dès la première année). Le moteur ne compte aucune vente avant cette année (M1, R4) ;
   *  la seule présence de `perenne` oblige à déclarer l'année. */
  perenne: z.object({ anneeEntreeProduction: z.number().int().min(1).optional() }).optional(),
  /** Débouché justifié : volume que le marché ou un contrat absorbe, dans l'unité et la période de `quantite`, pertes déduites (M13 attendu pour le dimensionnement à rebours). */
  debouche: z.object({ volumeAbsorbable: z.number().min(0), source: z.string().optional() }).optional(),
});

/** Seuils des contrôles du §3.6. Aucune valeur par défaut : un seuil absent veut dire « seuil inconnu », et le contrôle se borne à donner la mesure. */
export const schemaSeuilsControles = z.object({
  /** Écart relatif toléré entre un intrant saisi et l'itinéraire (0,2 = 20 %). */
  ecartIntrants: z.number().min(0).optional(),
  /** Écart relatif toléré entre la masse salariale saisie et effectif × salaire × mois. */
  ecartMasseSalariale: z.number().min(0).optional(),
  /** Part maximale d'un seul client dans les ventes, ou d'un seul fournisseur dans les achats (0,5 = 50 %). */
  concentrationMax: z.number().min(0).max(1).optional(),
});

/** Le ménage du porteur (M3). Absent : le revenu du ménage n'est pas évalué. */
export const schemaMenage = z.object({
  /** Coût de vie annuel du ménage, c'est-à-dire les prélèvements privés à faire sur l'exploitation (FCFA par an). */
  prelevementsAnnuels: z.number().min(0),
  /** Revenus du ménage hors de ce projet (autre activité, transferts), FCFA par an. Ils réduisent les prélèvements nécessaires. */
  revenusExterieursAnnuels: z.number().min(0).default(0),
  /** Mois des prélèvements (1 à 12) ; répartis sur 12 mois sinon. Les revenus extérieurs sont répartis sur 12 mois. */
  moisPrelevements: mois.optional(),
});

const variation = z.number().min(-0.9, "variation sous −90 %").max(2, "variation au-delà de +200 %");
const ecart = z.object({ prix: variation.default(0), charges: variation.default(0) });

/** Écarts des scénarios (M5) : le pessimiste et l'optimiste croisent prix, rendement (quantités des lignes) et charges d'exploitation. */
export const schemaEcartsScenarios = z
  .object({ pessimiste: ecart.prefault({}), optimiste: ecart.prefault({}) })
  .refine((x) => x.pessimiste.prix <= x.optimiste.prix && x.pessimiste.charges >= x.optimiste.charges, {
    message: "le scénario pessimiste doit avoir un prix plus bas et des charges plus hautes que l'optimiste",
  });

/** Grille de la sensibilité (M5). Les pas suivent les sources (±10 et ±20 % ; tableau du seuil par pas de 5 et 10 %, DOC-00106 p. 13). */
export const schemaParametresSensibilite = z.object({
  variations: z.array(variation).min(1).default([-0.2, -0.1, 0.1, 0.2]),
  /** Baisse de prix du test du prix bas (−0,25 = −25 %). Sinon : l'écart de prix du pessimiste s'il est négatif, ou la plus forte baisse de la grille. */
  baissePrixBas: z.number().min(-0.9).max(0).optional(),
  axeRendement: z.array(variation).min(1).default([-0.2, -0.1, 0, 0.1, 0.2]),
  axeCharges: z.array(variation).min(1).default([-0.1, -0.05, 0, 0.05, 0.1]),
});

const flux = z.number().min(0).default(0);
/**
 * Financement détaillé (M6) mois par mois, tel que `financementPourMoteur` le tire de `calculerFinancement`. Il remplace l'apport et le crédit simples dans la grille :
 * `apport` et `credit` ne servent plus qu'aux contrôles et aux ratios.
 */
export const schemaFinancementMensuel = z.object({
  origine: z.string().optional(),
  mois: z
    .array(
      z.object({
        mois: z.number().int().min(0).max(HORIZON_MAX_MOIS),
        apportEspeces: flux,
        /** Prêts, campagne, chaîne de valeur et avances reçues. */
        tirages: flux,
        /** Subventions encaissées, nettes des avances remboursées. */
        subventionsEncaissees: flux,
        /** Intérêts de tous les crédits (prêts, campagne, chaîne, avances). */
        interets: flux,
        taxeInterets: flux,
        /** Capital remboursé, retenues de l'acheteur comprises. */
        capital: flux,
        /** Subventions reprises au résultat (produit non encaissé). */
        repriseSubventions: flux,
      }),
    )
    .min(1),
});

/** Travail familial valorisé (R2) : coût de revient. Jamais compté dans la trésorerie, le résultat ni la CAF. */
export const schemaTravailFamilial = z.object({
  /** Heures de la famille utilisées × prix de l'heure, par an (`calculerMainOeuvre`, `valorisationFamille`). */
  montantAnnuel: z.number().min(0),
  origine: z.string().optional(),
});

export const schemaFinance = z.object({
  charges: z.array(schemaLigneCharge),
  revenus: z.array(schemaLigneRevenu),
  /** Horizon libre (M17) : `horizonMois`, `horizonCycles` ou `horizonAnnees` ; sans aucun des trois, le plus long entre un cycle, la durée du crédit et le plein régime. */
  ...schemaHorizon,
  /** Montée en production par atelier (M2, R4) : coefficients de rendement et d'utilisation par année, rendement du débutant. */
  montee: z.array(schemaMontee).default([]),
  /** Mois où le crédit est tiré (0 = démarrage). Les échéances suivent ce mois. */
  moisTirageCredit: z.number().int().min(0).max(HORIZON_MAX_MOIS).default(0),
  tauxActualisation: z.number().min(0).max(1).default(TAUX_ACTUALISATION_PAR_DEFAUT),
  hausseCharges: z.number().min(-0.5).max(1).default(0),
  haussePrix: z.number().min(-0.5).max(1).default(0),
  apport: z.number().min(0).default(0),
  credit: schemaCredit.optional(),
  /** Financement détaillé (M6) : remplace, dans la grille, les flux de `apport` et de `credit`. */
  financement: schemaFinancementMensuel.optional(),
  /** Travail familial valorisé (R2) : sert au coût de revient seulement. */
  travailFamilial: schemaTravailFamilial.optional(),
  menage: schemaMenage.optional(),
  /** Salaires annuels des employés non saisis en lignes de charges (charge fixe d'exploitation, soumise à la hausse des charges). */
  salairesAnnuels: z.number().min(0).default(0),
  /** Mois de paiement des salaires ; répartis sur 12 mois sinon. */
  moisSalaires: mois.optional(),
  /** Impôts et taxes annuels, en attendant la fiscalité par pays (M8) ; répartis sur 12 mois. */
  impotsAnnuels: z.number().min(0).default(0),
  seuilsControles: schemaSeuilsControles.optional(),
  ecartsScenarios: schemaEcartsScenarios.prefault({}),
  sensibilite: schemaParametresSensibilite.prefault({}),
  /** Règle du financeur visé (R11), pour les contrôles : par exemple { nom: "ANPGF", apportMinimum: 0.2 }. Aucune valeur par défaut. */
  regleFinanceur: z
    .object({
      nom: z.string().min(1),
      apportMinimum: z.number().min(0).max(1).optional(),
      dureeMaxMois: z.number().int().min(1).optional(),
      dureeInclutDiffere: z.boolean().optional(),
      differeMaxMois: z.number().int().min(0).optional(),
      source: z.string().optional(),
      statut: z.string().optional(),
    })
    .optional(),
});

export type LigneCharge = z.input<typeof schemaLigneCharge>;
export type LigneRevenu = z.input<typeof schemaLigneRevenu>;
export type EntreeMenage = z.input<typeof schemaMenage>;
export type EntreeFinance = z.input<typeof schemaFinance>;
type Entree = z.output<typeof schemaFinance>;
type Charge = z.output<typeof schemaLigneCharge>;
type Revenu = z.output<typeof schemaLigneRevenu>;

export interface AnneeResultat {
  an: number;
  /** Mois de la grille que couvre cette année (12, sauf la dernière année d'un horizon qui n'est pas un multiple de 12). */
  mois: number;
  /** Investissements décaissés dans l'année (achats datés et renouvellements ; l'achat du démarrage compte dans l'an 1). */
  investissements: number;
  chiffreAffaires: number;
  chargesVariables: number;
  /** Charges fixes d'exploitation, salaires des employés compris. */
  chargesFixes: number;
  margeBrute: number;
  /** Excédent brut d'exploitation : chiffre d'affaires moins charges d'exploitation. */
  excedentBrut: number;
  amortissements: number;
  interets: number;
  /** Taxe sur les intérêts (financement détaillé) ; 0 sans elle. */
  taxeInterets: number;
  /** Intérêts + taxe : charge financière de l'année. */
  fraisFinanciers: number;
  /** Subventions reprises au résultat (produit non encaissé, retiré de la CAF). */
  repriseSubventions: number;
  /** Travail familial valorisé (R2) : jamais dans le résultat ni la trésorerie. */
  travailFamilial: number;
  /** Résultat après valorisation du travail familial : à comparer au prix de vente (coût de revient complet). */
  resultatApresTravailFamilial: number;
  impots: number;
  resultat: number;
  cafNette: number;
  remboursementCapital: number;
  /** Trésorerie dégagée dans l'année après service de la dette (avant prélèvements du ménage). */
  fluxTresorerie: number;
  // M3 : ménage et capacité de remboursement.
  /** Salaires des employés (entrée `salairesAnnuels`), déjà compris dans les charges fixes. */
  salaires: number;
  /** Marge avant intérêts, salaires et amortissements : excédent brut + salaires. */
  margeAvantInteretsSalairesAmortissements: number;
  /** Intérêts + remboursement du capital. */
  annuites: number;
  /** Prélèvements du ménage moins ses revenus extérieurs (négatif si le ménage apporte de l'argent). 0 sans ménage. */
  prelevementsNets: number;
  /** Capacité de remboursement : marge avant intérêts, salaires et amortissements − salaires − prélèvements nets − impôts. */
  capaciteRemboursement: number;
  /** Capacité de remboursement − annuités : doit rester positif. */
  soldeResiduel: number;
  /** CAF disponible : excédent brut − annuités − prélèvements nets. */
  cafDisponible: number;
}

export interface MoisTresorerie {
  mois: number;
  entrees: number;
  /** Sorties de l'exploitation : investissements (mois 0), charges, salaires, impôts, échéances du crédit. */
  sorties: number;
  /** Prélèvements du ménage moins ses revenus extérieurs, ce mois-ci. */
  prelevementsNets: number;
  solde: number;
  cumul: number;
  /** Argent que le ménage peut retirer ce mois-ci sans rendre la trésorerie négative d'ici la fin de l'an 1. */
  retraitPossible: number;
}

export interface LigneSeuilCommercialisation {
  ligneId: string;
  libelle: string;
  /** Quantité vendue dans l'année retenue (pertes déduites). */
  quantiteVendue: number;
  prixActuel: number;
  /** Prix de vente minimum de cette ligne, si tous les prix baissent dans la même proportion. */
  prixSeuil: number;
}

export interface SeuilCommercialisation {
  /** Année la plus exigeante de l'horizon (celle où le coefficient est le plus haut). */
  an: number;
  /** Charges décaissées + impôts + annuités + prélèvements nets de cette année. */
  besoinAnnuel: number;
  chiffreAffaires: number;
  /** Besoin / chiffre d'affaires : 0,8 = les prix peuvent baisser de 20 % ; 1,1 = il faut vendre 10 % plus cher. null sans vente. */
  coefficientPrix: number | null;
  parLigne: LigneSeuilCommercialisation[];
}

export type StatutRentabilite = "rentable" | "limite" | "deficitaire";

export interface Verdict {
  rentabilite: StatutRentabilite;
  /** Trésorerie cumulée jamais négative de mois 0 à mois 12 (financement et prélèvements compris). */
  tresorerieToujoursPositive: boolean;
  /** Solde résiduel positif chaque année ; null si le ménage n'est pas renseigné. */
  menageCouvert: boolean | null;
}

/** Un point bas de trésorerie, daté : mois de la grille (0 = démarrage), année et mois dans l'année (0 pour le démarrage). */
export interface PointBas {
  montant: number;
  mois: number;
  an: number;
  moisDansAn: number;
}

export interface ResultatScenario {
  annees: AnneeResultat[];
  /** Horizon résolu (M17) : mois, années, origine, cycle, crédit, plein régime, indicateurs annuels disponibles. */
  horizon: Horizon;
  /** Trésorerie mensuelle sur tout l'horizon : mois 0 (démarrage : apport, crédit, investissements) puis mois 1 à N. */
  tresorerieMensuelle: MoisTresorerie[];
  /** Les 13 premiers mois de `tresorerieMensuelle` (mois 0 à 12), conservés pour les lecteurs de la version 1. */
  tresorerieMensuelleAn1: MoisTresorerie[];
  /** Grille mensuelle de toutes les lignes (revenus, charges d'exploitation, investissements avec renouvellements), mois 0 à N. */
  grille: { lignes: LigneGrille[] };
  /** Investissements et renouvellements datés. */
  investissementsDates: InvestissementDate[];
  /** Ce que le moteur n'a pas pu placer (achat ou tirage après l'horizon). */
  avertissements: string[];
  /** Vrai si l'horizon compte au moins deux années complètes : sinon VAN, TRI et délai de récupération sont null. */
  indicateursAnnuels: boolean;
  besoinFondsRoulement: number;
  seuilRentabilite: { chiffreAffaires: number | null; moisAtteint: number | null };
  /** null si l'horizon est trop court (`indicateursAnnuels` faux). */
  van: number | null;
  tri: number | null;
  delaiRecuperationAns: number | null;
  rentabilite: number | null;
  /** rentable : rentable, trésorerie jamais négative et ménage couvert (ou non renseigné) ;
   *  limite : rentabilité limite, ou rentable mais trésorerie négative ou ménage non couvert ; deficitaire : rentabilité déficitaire. */
  statut: StatutRentabilite;
  // M3
  verdict: Verdict;
  /** Point bas de la trésorerie cumulée sur tout l'horizon (financement et prélèvements compris) et le premier mois où il est atteint. */
  pointBasTresorerie: PointBas;
  /** Point bas sans financement : ni apport, ni crédit (tirage et échéances), investissements, impôts et ménage compris. */
  pointBasSansFinancement: PointBas;
  /** Mois (1 à N) dont le solde est négatif (on dépense plus qu'on ne reçoit ce mois-là). */
  moisDeficitaires: number[];
  /** Mois (0 à N) où la trésorerie cumulée est négative. */
  moisTresorerieNegative: number[];
  seuilCommercialisation: SeuilCommercialisation;
  // M4
  /** Contrôles nommés { code, niveau, valeurs, message } (voir controles.ts). */
  controles: Controle[];
  ratios: Ratios;
}

export interface ResultatFinance {
  versionMoteur: string;
  /** Horizon résolu (M17), identique pour les trois scénarios. */
  horizon: Horizon;
  investissementTotal: number;
  /** Investissement + BFR (scénario réaliste) − apport, jamais négatif. */
  besoinFinancement: number;
  scenarios: Record<Scenario, ResultatScenario>;
  /** Sensibilité du scénario réaliste (M5). */
  sensibilite: Sensibilite;
}

const parAn = (montant: number, l: { base: "cycle" | "an"; cyclesParAn: number }) =>
  l.base === "an" ? montant : montant * l.cyclesParAn;
const montantCharge = (c: Charge) => c.quantite * c.prixUnitaire * c.frequence;
const quantiteVendueAn = (r: Revenu, scenario: Scenario) => parAn(r.quantite[scenario] * (1 - r.pertes), r);
/** Tolérance d'arrondi pour comparer des montants en FCFA. */
const DEMI_FCFA = 0.5;

/** VAN de flux annuels (index 0 = démarrage). */
export function van(flux: readonly number[], tauxActualisation: number): number {
  return somme(flux.map((f, t) => f / Math.pow(1 + tauxActualisation, t)));
}

/** TRI par dichotomie entre −99 % et 1 000 % ; null si la VAN ne change pas de signe. */
export function tri(flux: readonly number[]): number | null {
  let bas = -0.99;
  let haut = 10;
  const vBas = van(flux, bas);
  const vHaut = van(flux, haut);
  if (vBas === 0) return bas;
  if (Math.sign(vBas) === Math.sign(vHaut)) return null;
  for (let k = 0; k < 200; k++) {
    const milieu = (bas + haut) / 2;
    const v = van(flux, milieu);
    if (Math.abs(v) < 1e-6) return milieu;
    if (Math.sign(v) === Math.sign(vBas)) bas = milieu;
    else haut = milieu;
  }
  return (bas + haut) / 2;
}

/** Délai de récupération en années (fractionnaire) ; null si non récupéré dans l'horizon. */
export function delaiRecuperation(flux: readonly number[]): number | null {
  let cumul = flux[0];
  if (cumul >= 0) return 0;
  for (let t = 1; t < flux.length; t++) {
    const precedent = cumul;
    cumul += flux[t];
    if (cumul >= 0) return t - 1 + -precedent / flux[t];
  }
  return null;
}

/** Retrait possible au mois m : le plus bas des cumuls de m à 12, jamais négatif. */
export function retraitsPossibles(cumuls: readonly number[]): number[] {
  const retraits = new Array<number>(cumuls.length).fill(0);
  let minimum = Infinity;
  for (let m = cumuls.length - 1; m >= 0; m--) {
    minimum = Math.min(minimum, cumuls[m]);
    retraits[m] = Math.max(0, minimum);
  }
  return retraits;
}

function statutRentabilite(rentabilite: number | null, resultatCumule: number): StatutRentabilite {
  if (rentabilite === null) return resultatCumule > 0 ? "rentable" : "deficitaire";
  if (rentabilite > SEUIL_STATUT) return "rentable";
  if (rentabilite >= -SEUIL_STATUT) return "limite";
  return "deficitaire";
}

/** Statut combiné : la rentabilité, puis la trésorerie et le ménage peuvent le dégrader en « limite ». */
export function statutCombine(v: Verdict): StatutRentabilite {
  if (v.rentabilite !== "rentable") return v.rentabilite;
  return v.tresorerieToujoursPositive && v.menageCouvert !== false ? "rentable" : "limite";
}

/** Calcul brut (non arrondi) d'un scénario, réutilisé par la sensibilité. */
export interface CalculScenario {
  annees: AnneeResultat[];
  horizon: Horizon;
  grille: ReturnType<typeof construireGrille>;
  tresorerie: MoisTresorerie[];
  creux: number;
  seuilCA: number | null;
  moisAtteint: number | null;
  fluxEconomiques: number[];
  rentabilite: number | null;
  verdict: Verdict;
  pointBas: PointBas;
  pointBasSansFinancement: PointBas;
  seuilCommercialisation: SeuilCommercialisation;
}

/** Applique au pessimiste et à l'optimiste leurs écarts de prix et de charges d'exploitation (salaires compris). */
function appliquerEcarts(e: Entree, scenario: Scenario): Entree {
  if (scenario === "realiste") return e;
  const { prix, charges } = e.ecartsScenarios[scenario];
  if (prix === 0 && charges === 0) return e;
  return {
    ...e,
    revenus: e.revenus.map((r) => ({ ...r, prixUnitaire: r.prixUnitaire * (1 + prix) })),
    charges: e.charges.map((c) => (c.classe === "exploitation" ? { ...c, prixUnitaire: c.prixUnitaire * (1 + charges) } : c)),
    salairesAnnuels: e.salairesAnnuels * (1 + charges),
  };
}

const datation = (mois: number) => ({ an: mois <= 0 ? 1 : Math.ceil(mois / 12), moisDansAn: mois <= 0 ? 0 : ((mois - 1) % 12) + 1 });

export function calculerScenarioBrut(entree: Entree, scenario: Scenario): CalculScenario {
  const e = appliquerEcarts(entree, scenario);
  const g = construireGrille(e, scenario);
  const N = g.horizon.mois;
  const annuel = (serie: readonly number[], an: number) => sommeAnnee(serie, an, N);

  const annees: AnneeResultat[] = [];
  for (let an = 1; an <= g.horizon.annees; an++) {
    const chiffreAffaires = annuel(g.chiffreAffaires, an);
    const chargesVariables = annuel(g.chargesVariables, an);
    const chargesFixes = annuel(g.chargesFixes, an);
    const salaires = annuel(g.salaires, an);
    const amortissements = annuel(g.amortissements, an);
    const interets = annuel(g.interets, an);
    const remboursementCapital = annuel(g.capitalRembourse, an);
    const impots = annuel(g.impots, an);
    const prelevementsNets = annuel(g.menage, an);
    const excedentBrut = chiffreAffaires - chargesVariables - chargesFixes;
    const taxeInterets = annuel(g.taxeInterets, an);
    const repriseSubventions = annuel(g.repriseSubventions, an);
    const travailFamilial = annuel(g.travailFamilial, an);
    const resultat = excedentBrut - amortissements - interets - taxeInterets - impots + repriseSubventions;
    // La reprise d'une subvention est un produit non encaissé : elle ne fait pas partie de la CAF.
    const cafNette = resultat + amortissements - repriseSubventions;
    const annuites = interets + taxeInterets + remboursementCapital;
    const margeAvantISA = excedentBrut + salaires;
    const capaciteRemboursement = margeAvantISA - salaires - prelevementsNets - impots;
    annees.push({
      an,
      mois: Math.min(12, N - (an - 1) * 12),
      investissements: annuel(g.investissements, an) + (an === 1 ? g.investissements[0] : 0),
      chiffreAffaires,
      chargesVariables,
      chargesFixes,
      margeBrute: chiffreAffaires - chargesVariables,
      excedentBrut,
      amortissements,
      interets,
      taxeInterets,
      fraisFinanciers: interets + taxeInterets,
      repriseSubventions,
      travailFamilial,
      resultatApresTravailFamilial: resultat - travailFamilial,
      impots,
      resultat,
      cafNette,
      remboursementCapital,
      fluxTresorerie: cafNette - remboursementCapital,
      salaires,
      margeAvantInteretsSalairesAmortissements: margeAvantISA,
      annuites,
      prelevementsNets,
      capaciteRemboursement,
      soldeResiduel: capaciteRemboursement - annuites,
      cafDisponible: excedentBrut - annuites - prelevementsNets,
    });
  }

  // Trésorerie mensuelle sur tout l'horizon, avec et sans financement.
  const lignesTreso: Omit<MoisTresorerie, "retraitPossible">[] = [];
  let cumul = 0;
  let cumulSans = 0;
  let cumulExploitation = 0;
  let creux = 0;
  let pointBas: PointBas = { montant: 0, mois: 0, ...datation(0) };
  let pointBasSans: PointBas = { montant: 0, mois: 0, ...datation(0) };
  for (let m = 0; m <= N; m++) {
    const entrees = g.apport[m] + g.tirageCredit[m] + g.subventions[m] + g.chiffreAffaires[m];
    const sorties = g.investissements[m] + g.chargesExploitation[m] + g.impots[m] + g.echeances[m];
    const solde = entrees - sorties - g.menage[m];
    cumul += solde;
    cumulSans += g.chiffreAffaires[m] - g.investissements[m] - g.chargesExploitation[m] - g.impots[m] - g.menage[m];
    lignesTreso.push({ mois: m, entrees, sorties, prelevementsNets: g.menage[m], solde, cumul });
    if (m === 0 || cumul < pointBas.montant) pointBas = { montant: cumul, mois: m, ...datation(m) };
    if (m === 0 || cumulSans < pointBasSans.montant) pointBasSans = { montant: cumulSans, mois: m, ...datation(m) };
    if (m > 0) {
      cumulExploitation += g.chiffreAffaires[m] - g.chargesExploitation[m];
      creux = Math.min(creux, cumulExploitation);
    }
  }
  const retraits = retraitsPossibles(lignesTreso.map((t) => t.cumul));
  const tresorerie: MoisTresorerie[] = lignesTreso.map((t, m) => ({ ...t, retraitPossible: retraits[m] }));

  // Seuil de rentabilité de l'an 1 : charges fixes (amortissements, intérêts et impôts compris) / taux de marge sur coûts variables.
  const a1 = annees[0];
  const tauxMarge = a1.chiffreAffaires > 0 ? 1 - a1.chargesVariables / a1.chiffreAffaires : 0;
  const fixesTotales = a1.chargesFixes + a1.amortissements + a1.fraisFinanciers + a1.impots;
  const seuilCA = tauxMarge > 0 ? fixesTotales / tauxMarge : null;
  let moisAtteint: number | null = null;
  if (seuilCA !== null) {
    let caCumule = 0;
    for (let m = 1; m <= Math.min(12, N) && moisAtteint === null; m++) {
      caCumule += g.chiffreAffaires[m];
      if (caCumule >= seuilCA - DEMI_FCFA) moisAtteint = m;
    }
  }

  // Flux économiques annuels : −investissement du démarrage, puis excédent brut − investissements de chaque année complète.
  const fluxEconomiques = [-g.investissements[0]];
  for (let an = 1; an <= g.horizon.anneesCompletes; an++) fluxEconomiques.push(annees[an - 1].excedentBrut - annuel(g.investissements, an));
  const chargesCumulees = somme(annees.map((a) => a.chargesVariables + a.chargesFixes + a.amortissements + a.fraisFinanciers + a.impots));
  const resultatCumule = somme(annees.map((a) => a.resultat));
  const rentabilite = chargesCumulees > 0 ? resultatCumule / chargesCumulees : null;
  const verdict: Verdict = {
    rentabilite: statutRentabilite(rentabilite, resultatCumule),
    tresorerieToujoursPositive: pointBas.montant >= -DEMI_FCFA,
    menageCouvert: e.menage ? annees.every((a) => a.soldeResiduel >= -DEMI_FCFA) : null,
  };

  return {
    annees,
    horizon: g.horizon,
    grille: g,
    tresorerie,
    creux,
    seuilCA,
    moisAtteint,
    fluxEconomiques,
    rentabilite,
    verdict,
    pointBas,
    pointBasSansFinancement: pointBasSans,
    seuilCommercialisation: seuilCommercialisation(e, scenario, annees),
  };
}

/** Besoin annuel à couvrir par les ventes (DOC-00106 p. 4-5) : charges décaissées, impôts, annuités, prélèvements nets. */
export const besoinCommercialisation = (a: Pick<AnneeResultat, "chargesVariables" | "chargesFixes" | "impots" | "annuites" | "prelevementsNets">) =>
  a.chargesVariables + a.chargesFixes + a.impots + a.annuites + a.prelevementsNets;

function seuilCommercialisation(e: Entree, scenario: Scenario, annees: AnneeResultat[]): SeuilCommercialisation {
  // L'année la plus exigeante : coefficient le plus haut, parmi les années où il y a des ventes (une année sans vente, comme l'an 1 d'une
  // plantation, n'a pas de prix seuil) ; sans aucune vente, le besoin le plus haut.
  const coef = (a: AnneeResultat) => (a.chiffreAffaires > 0 ? besoinCommercialisation(a) / a.chiffreAffaires : Infinity);
  const avecVentes = annees.filter((a) => a.chiffreAffaires > 0);
  const candidats = avecVentes.length > 0 ? avecVentes : annees;
  const retenue = candidats.reduce((pire, a) => {
    const c = coef(a);
    const p = coef(pire);
    return c > p || (c === p && besoinCommercialisation(a) > besoinCommercialisation(pire)) ? a : pire;
  }, candidats[0]);
  const besoin = besoinCommercialisation(retenue);
  const coefficientPrix = retenue.chiffreAffaires > 0 ? besoin / retenue.chiffreAffaires : null;
  const vendue = (r: Revenu) => quantiteVendueAn(r, scenario) * coefficientProduction(e, r, retenue.an);
  return {
    an: retenue.an,
    besoinAnnuel: besoin,
    chiffreAffaires: retenue.chiffreAffaires,
    coefficientPrix,
    parLigne: e.revenus
      .filter((r) => vendue(r) > 0)
      .map((r) => {
        const prixActuel = r.prixUnitaire * indiceHausse(r, e.haussePrix, retenue.an);
        return { ligneId: r.id, libelle: r.libelle, quantiteVendue: vendue(r), prixActuel, prixSeuil: coefficientPrix === null ? 0 : prixActuel * coefficientPrix };
      }),
  };
}

const arrondirAnnee = (a: AnneeResultat): AnneeResultat => ({
  an: a.an,
  mois: a.mois,
  investissements: fcfa(a.investissements),
  chiffreAffaires: fcfa(a.chiffreAffaires),
  chargesVariables: fcfa(a.chargesVariables),
  chargesFixes: fcfa(a.chargesFixes),
  margeBrute: fcfa(a.margeBrute),
  excedentBrut: fcfa(a.excedentBrut),
  amortissements: fcfa(a.amortissements),
  interets: fcfa(a.interets),
  taxeInterets: fcfa(a.taxeInterets),
  fraisFinanciers: fcfa(a.fraisFinanciers),
  repriseSubventions: fcfa(a.repriseSubventions),
  travailFamilial: fcfa(a.travailFamilial),
  resultatApresTravailFamilial: fcfa(a.resultatApresTravailFamilial),
  impots: fcfa(a.impots),
  resultat: fcfa(a.resultat),
  cafNette: fcfa(a.cafNette),
  remboursementCapital: fcfa(a.remboursementCapital),
  fluxTresorerie: fcfa(a.fluxTresorerie),
  salaires: fcfa(a.salaires),
  margeAvantInteretsSalairesAmortissements: fcfa(a.margeAvantInteretsSalairesAmortissements),
  annuites: fcfa(a.annuites),
  prelevementsNets: fcfa(a.prelevementsNets),
  capaciteRemboursement: fcfa(a.capaciteRemboursement),
  soldeResiduel: fcfa(a.soldeResiduel),
  cafDisponible: fcfa(a.cafDisponible),
});

/** Prix unitaire : arrondi au centime de FCFA près (0,01), car un kg de légume se vend parfois moins de 100 FCFA. */
const prixArrondi = (p: number) => Math.round(p * 100) / 100;

function arrondirScenario(c: CalculScenario, e: Entree, scenario: Scenario): ResultatScenario {
  const triBrut = tri(c.fluxEconomiques);
  const delai = delaiRecuperation(c.fluxEconomiques);
  const s = c.seuilCommercialisation;
  const tresorerie = c.tresorerie.map((t) => ({
    mois: t.mois,
    entrees: fcfa(t.entrees),
    sorties: fcfa(t.sorties),
    prelevementsNets: fcfa(t.prelevementsNets),
    solde: fcfa(t.solde),
    cumul: fcfa(t.cumul),
    retraitPossible: fcfa(t.retraitPossible),
  }));
  const annees = c.annees.map(arrondirAnnee);
  const moisTresorerieNegative = c.tresorerie.filter((t) => t.cumul < -DEMI_FCFA).map((t) => t.mois);
  const pointBasTresorerie = { ...c.pointBas, montant: fcfa(c.pointBas.montant) };
  const pointBasSansFinancement = { ...c.pointBasSansFinancement, montant: fcfa(c.pointBasSansFinancement.montant) };
  const indicateursAnnuels = c.horizon.indicateursAnnuels;
  const donnees: DonneesControles = {
    charges: e.charges.map((c) => ({ ...c, montantAnnuel: parAn(montantCharge(c), c) })),
    revenus: e.revenus.map((r) => ({
      id: r.id,
      libelle: r.libelle,
      quantite: r.quantite[scenario],
      pertes: r.pertes,
      chiffreAffaires: quantiteVendueAn(r, scenario) * r.prixUnitaire,
      bornesQuantite: r.bornesQuantite,
      client: r.client,
      perenne: r.perenne,
      debouche: r.debouche,
    })),
    seuils: e.seuilsControles,
    apport: e.apport,
    credit: e.credit ? { montant: e.credit.montant, dureeMois: e.credit.dureeMois, differeMois: e.credit.differeMois ?? 0 } : null,
    menageRenseigne: e.menage !== undefined,
    salairesAnnuels: e.salairesAnnuels,
    impotsAnnuels: e.impotsAnnuels,
    listesMois: [
      ...e.charges.filter((l) => l.moisDecaissement).map((l) => ({ nom: l.libelle, mois: l.moisDecaissement as number[] })),
      ...e.revenus.filter((l) => l.moisVente).map((l) => ({ nom: l.libelle, mois: l.moisVente as number[] })),
      ...(e.moisSalaires ? [{ nom: "Salaires", mois: e.moisSalaires }] : []),
      ...(e.menage?.moisPrelevements ? [{ nom: "Prélèvements du ménage", mois: e.menage.moisPrelevements }] : []),
    ],
    regleFinanceur: e.regleFinanceur,
    investissementTotal: fcfa(somme(e.charges.filter((x) => x.classe === "investissement").map(montantCharge))),
    besoinFondsRoulement: fcfa(-c.creux),
    annees,
    moisTresorerieNegative,
    pointBasTresorerie,
    horizon: c.horizon,
  };
  const ratios = calculerRatios(donnees);
  return {
    annees,
    horizon: c.horizon,
    tresorerieMensuelle: tresorerie,
    tresorerieMensuelleAn1: tresorerie.slice(0, 13),
    grille: { lignes: c.grille.lignes.map((l) => ({ ...l, mensuel: l.mensuel.map(fcfa) })) },
    investissementsDates: c.grille.investissementsDates.map((i) => ({ ...i, montant: fcfa(i.montant) })),
    avertissements: c.grille.avertissements,
    indicateursAnnuels,
    besoinFondsRoulement: fcfa(-c.creux),
    seuilRentabilite: { chiffreAffaires: c.seuilCA === null ? null : fcfa(c.seuilCA), moisAtteint: c.moisAtteint },
    van: indicateursAnnuels ? fcfa(van(c.fluxEconomiques, e.tauxActualisation)) : null,
    tri: !indicateursAnnuels || triBrut === null ? null : taux(triBrut),
    delaiRecuperationAns: !indicateursAnnuels || delai === null ? null : Math.round(delai * 100) / 100,
    rentabilite: c.rentabilite === null ? null : taux(c.rentabilite),
    statut: statutCombine(c.verdict),
    verdict: c.verdict,
    pointBasTresorerie,
    pointBasSansFinancement,
    moisDeficitaires: c.tresorerie.filter((t) => t.mois > 0 && t.solde < -DEMI_FCFA).map((t) => t.mois),
    moisTresorerieNegative,
    seuilCommercialisation: {
      an: s.an,
      besoinAnnuel: fcfa(s.besoinAnnuel),
      chiffreAffaires: fcfa(s.chiffreAffaires),
      coefficientPrix: s.coefficientPrix === null ? null : taux(s.coefficientPrix),
      parLigne: s.parLigne.map((l) => ({
        ligneId: l.ligneId,
        libelle: l.libelle,
        quantiteVendue: Math.round(l.quantiteVendue * 100) / 100,
        prixActuel: prixArrondi(l.prixActuel),
        prixSeuil: prixArrondi(l.prixSeuil),
      })),
    },
    controles: controler(donnees, ratios),
    ratios,
  };
}

/** Valide l'entrée du moteur financier (utile aux modules qui enchaînent plusieurs calculs). */
export const validerFinance = (entree: EntreeFinance): Entree => valider(schemaFinance, entree, "financier");
export type EntreeFinanceValidee = Entree;

export function calculerFinances(entree: EntreeFinance): ResultatFinance {
  const e = validerFinance(entree);
  const bruts = Object.fromEntries(SCENARIOS.map((s) => [s, calculerScenarioBrut(e, s)])) as Record<Scenario, CalculScenario>;
  const scenarios = Object.fromEntries(SCENARIOS.map((s) => [s, arrondirScenario(bruts[s], e, s)])) as Record<Scenario, ResultatScenario>;
  const investissementTotal = somme(e.charges.filter((c) => c.classe === "investissement").map(montantCharge));
  const sensibilite = analyserSensibilite(e, (x) => {
    const c = calculerScenarioBrut(x, "realiste");
    return { annees: c.annees, pointBas: c.pointBas.montant, van: van(c.fluxEconomiques, x.tauxActualisation), verdict: c.verdict, statut: statutCombine(c.verdict) };
  });
  // S5 : les alertes de prudence s'ajoutent aux contrôles (l'exposition au prix se lit sur le scénario réaliste).
  for (const s of SCENARIOS) scenarios[s].controles.push(...alertesPrudence(scenarios[s], s === "realiste" ? sensibilite : undefined));
  return {
    versionMoteur: VERSION_MOTEURS,
    horizon: scenarios.realiste.horizon,
    investissementTotal: fcfa(investissementTotal),
    besoinFinancement: fcfa(Math.max(0, investissementTotal + scenarios.realiste.besoinFondsRoulement - e.apport)),
    scenarios,
    sensibilite,
  };
}
