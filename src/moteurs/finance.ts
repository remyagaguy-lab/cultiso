// Moteur financier : compte de résultat pluriannuel, trésorerie mensuelle de l'an 1, BFR,
// seuil de rentabilité, VAN, TRI, délai de récupération, trois scénarios,
// revenu du ménage et capacité de remboursement (M3), contrôles nommés et ratios (M4).
// Formules par ligne du Cultiso Brouillon (ground truth §II.2), pluriannuel du Stimulateur, crédit d'Agripilot.
// Le moteur ne connaît aucune filière : seulement des lignes de charges et de revenus.
//
// Conventions :
// - une ligne « cycle » compte par cycle de production et se répète `cyclesParAn` fois ; une ligne « an » compte par an ;
// - les investissements sont décaissés au démarrage (mois 0) et amortis en linéaire sur leur durée de vie ;
// - VAN et TRI portent sur les flux économiques (avant financement) : −investissement, puis l'excédent brut de chaque année ;
//   aucune valeur résiduelle n'est comptée (choix prudent) ;
// - pas d'impôt calculé sur le résultat (fiscalité par pays : M8) ; un montant d'impôts annuel peut être fourni ;
// - le ménage (prélèvements, revenus extérieurs) est constant d'une année sur l'autre, sans hausse.
// Contrat complet : src/moteurs/CONTRAT.md.
import { z } from "zod";
import { fcfa, somme, taux, valider, VERSION_MOTEURS } from "./commun";
import { calculerRatios, controler, type Controle, type DonneesControles, type Ratios } from "./controles";
import { echeancierBrut, schemaCredit } from "./credit";

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
  /** Bornes de production du référentiel, dans l'unité et la période de `quantite`, déjà mises à la taille de l'atelier (M4). */
  bornesQuantite: z
    .object({ min: z.number().min(0).optional(), max: z.number().min(0).optional(), source: z.string().optional() })
    .optional(),
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

export const schemaFinance = z.object({
  charges: z.array(schemaLigneCharge),
  revenus: z.array(schemaLigneRevenu),
  horizonAnnees: z.number().int().min(1).max(5).default(HORIZON_PAR_DEFAUT),
  tauxActualisation: z.number().min(0).max(1).default(TAUX_ACTUALISATION_PAR_DEFAUT),
  hausseCharges: z.number().min(-0.5).max(1).default(0),
  haussePrix: z.number().min(-0.5).max(1).default(0),
  apport: z.number().min(0).default(0),
  credit: schemaCredit.optional(),
  menage: schemaMenage.optional(),
  /** Salaires annuels des employés non saisis en lignes de charges (charge fixe d'exploitation, soumise à la hausse des charges). */
  salairesAnnuels: z.number().min(0).default(0),
  /** Mois de paiement des salaires ; répartis sur 12 mois sinon. */
  moisSalaires: mois.optional(),
  /** Impôts et taxes annuels, en attendant la fiscalité par pays (M8) ; répartis sur 12 mois. */
  impotsAnnuels: z.number().min(0).default(0),
  /** Règle du financeur visé (R11), pour les contrôles : par exemple { nom: "ANPGF", apportMinimum: 0.2 }. Aucune valeur par défaut. */
  regleFinanceur: z
    .object({ nom: z.string().min(1), apportMinimum: z.number().min(0).max(1).optional(), source: z.string().optional() })
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
  chiffreAffaires: number;
  chargesVariables: number;
  /** Charges fixes d'exploitation, salaires des employés compris. */
  chargesFixes: number;
  margeBrute: number;
  /** Excédent brut d'exploitation : chiffre d'affaires moins charges d'exploitation. */
  excedentBrut: number;
  amortissements: number;
  interets: number;
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

export interface ResultatScenario {
  annees: AnneeResultat[];
  /** Mois 0 (démarrage : apport, crédit, investissements) puis mois 1 à 12. */
  tresorerieMensuelleAn1: MoisTresorerie[];
  besoinFondsRoulement: number;
  seuilRentabilite: { chiffreAffaires: number | null; moisAtteint: number | null };
  van: number;
  tri: number | null;
  delaiRecuperationAns: number | null;
  rentabilite: number | null;
  /** rentable : rentable, trésorerie jamais négative et ménage couvert (ou non renseigné) ;
   *  limite : rentabilité limite, ou rentable mais trésorerie négative ou ménage non couvert ; deficitaire : rentabilité déficitaire. */
  statut: StatutRentabilite;
  // M3
  verdict: Verdict;
  /** Point bas de la trésorerie cumulée de l'an 1 (mois 0 à 12) et le premier mois où il est atteint. */
  pointBasTresorerie: { montant: number; mois: number };
  /** Mois (1 à 12) dont le solde est négatif (on dépense plus qu'on ne reçoit ce mois-là). */
  moisDeficitaires: number[];
  /** Mois (0 à 12) où la trésorerie cumulée est négative. */
  moisTresorerieNegative: number[];
  seuilCommercialisation: SeuilCommercialisation;
  // M4
  /** Contrôles nommés { code, niveau, valeurs, message } (voir controles.ts). */
  controles: Controle[];
  ratios: Ratios;
}

export interface ResultatFinance {
  versionMoteur: string;
  investissementTotal: number;
  /** Investissement + BFR (scénario réaliste) − apport, jamais négatif. */
  besoinFinancement: number;
  scenarios: Record<Scenario, ResultatScenario>;
}

const montantCharge = (c: Charge) => c.quantite * c.prixUnitaire * c.frequence;
const parAn = (montant: number, l: { base: "cycle" | "an"; cyclesParAn: number }) =>
  l.base === "an" ? montant : montant * l.cyclesParAn;
const quantiteVendueAn = (r: Revenu, scenario: Scenario) => parAn(r.quantite[scenario] * (1 - r.pertes), r);
/** Tolérance d'arrondi pour comparer des montants en FCFA. */
const DEMI_FCFA = 0.5;

/** Répartit un montant annuel sur des mois (index 1 à 12). */
function repartir(montant: number, moisListe: number[] | undefined): number[] {
  const tableau = new Array<number>(13).fill(0);
  const cibles = moisListe && moisListe.length > 0 ? moisListe : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (const m of cibles) tableau[m] += montant / cibles.length;
  return tableau;
}

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
  tresorerie: MoisTresorerie[];
  creux: number;
  seuilCA: number | null;
  moisAtteint: number | null;
  fluxEconomiques: number[];
  rentabilite: number | null;
  verdict: Verdict;
  pointBas: { montant: number; mois: number };
  seuilCommercialisation: SeuilCommercialisation;
}

export function calculerScenarioBrut(e: Entree, scenario: Scenario): CalculScenario {
  const credit = e.credit ? echeancierBrut(e.credit) : null;
  const investissements = e.charges.filter((c) => c.classe === "investissement");
  const exploitation = e.charges.filter((c) => c.classe === "exploitation");
  const investissementTotal = somme(investissements.map(montantCharge));
  const caAn1 = (r: Revenu) => parAn(r.quantite[scenario] * r.prixUnitaire * (1 - r.pertes), r);
  const prelevementsNets = e.menage ? e.menage.prelevementsAnnuels - e.menage.revenusExterieursAnnuels : 0;

  const annees: AnneeResultat[] = [];
  for (let an = 1; an <= e.horizonAnnees; an++) {
    const hPrix = Math.pow(1 + e.haussePrix, an - 1);
    const hCharges = Math.pow(1 + e.hausseCharges, an - 1);
    const chiffreAffaires = somme(e.revenus.map(caAn1)) * hPrix;
    const coutAn = (nature: "fixe" | "variable") =>
      somme(exploitation.filter((c) => c.nature === nature).map((c) => parAn(montantCharge(c), c))) * hCharges;
    const salaires = e.salairesAnnuels * hCharges;
    const chargesVariables = coutAn("variable");
    const chargesFixes = coutAn("fixe") + salaires;
    const amortissements = somme(
      investissements.map((c) => {
        const duree = c.dureeVieAns as number;
        // Amortissement linéaire ; la dernière année peut être partielle.
        const deja = Math.min(an - 1, duree);
        return (montantCharge(c) * Math.max(0, Math.min(1, duree - deja))) / duree;
      }),
    );
    const echeancesAn = credit ? credit.echeancier.filter((x) => Math.ceil(x.mois / 12) === an) : [];
    const interets = somme(echeancesAn.map((x) => x.interets));
    const remboursementCapital = somme(echeancesAn.map((x) => x.amortissement));
    const impots = e.impotsAnnuels;
    const excedentBrut = chiffreAffaires - chargesVariables - chargesFixes;
    const resultat = excedentBrut - amortissements - interets - impots;
    const cafNette = resultat + amortissements;
    const annuites = interets + remboursementCapital;
    const margeAvantISA = excedentBrut + salaires;
    const capaciteRemboursement = margeAvantISA - salaires - prelevementsNets - impots;
    annees.push({
      an,
      chiffreAffaires,
      chargesVariables,
      chargesFixes,
      margeBrute: chiffreAffaires - chargesVariables,
      excedentBrut,
      amortissements,
      interets,
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

  // Trésorerie mensuelle de l'an 1.
  const entreesExploitation = new Array<number>(13).fill(0);
  const sortiesExploitation = new Array<number>(13).fill(0);
  for (const r of e.revenus) repartir(caAn1(r), r.moisVente).forEach((v, m) => (entreesExploitation[m] += v));
  for (const c of exploitation)
    repartir(parAn(montantCharge(c), c), c.moisDecaissement).forEach((v, m) => (sortiesExploitation[m] += v));
  repartir(e.salairesAnnuels, e.moisSalaires).forEach((v, m) => (sortiesExploitation[m] += v));
  const impotsMois = repartir(e.impotsAnnuels, undefined);
  const echeances = new Array<number>(13).fill(0);
  for (const x of credit?.echeancier ?? []) if (x.mois <= 12) echeances[x.mois] += x.echeance;
  const menageMois = new Array<number>(13).fill(0);
  if (e.menage) {
    repartir(e.menage.prelevementsAnnuels, e.menage.moisPrelevements).forEach((v, m) => (menageMois[m] += v));
    repartir(e.menage.revenusExterieursAnnuels, undefined).forEach((v, m) => (menageMois[m] -= v));
  }

  const lignesTreso: Omit<MoisTresorerie, "retraitPossible">[] = [];
  let cumul = 0;
  let cumulExploitation = 0;
  let creux = 0;
  for (let m = 0; m <= 12; m++) {
    const entrees = m === 0 ? e.apport + (e.credit?.montant ?? 0) : entreesExploitation[m];
    const sorties = m === 0 ? investissementTotal : sortiesExploitation[m] + impotsMois[m] + echeances[m];
    const solde = entrees - sorties - menageMois[m];
    cumul += solde;
    lignesTreso.push({ mois: m, entrees, sorties, prelevementsNets: menageMois[m], solde, cumul });
    if (m > 0) {
      cumulExploitation += entreesExploitation[m] - sortiesExploitation[m];
      creux = Math.min(creux, cumulExploitation);
    }
  }
  const retraits = retraitsPossibles(lignesTreso.map((t) => t.cumul));
  const tresorerie: MoisTresorerie[] = lignesTreso.map((t, m) => ({ ...t, retraitPossible: retraits[m] }));
  const pointBas = tresorerie.reduce((bas, t) => (t.cumul < bas.montant ? { montant: t.cumul, mois: t.mois } : bas), {
    montant: tresorerie[0].cumul,
    mois: 0,
  });

  // Seuil de rentabilité de l'an 1 : charges fixes (amortissements, intérêts et impôts compris) / taux de marge sur coûts variables.
  const a1 = annees[0];
  const tauxMarge = a1.chiffreAffaires > 0 ? 1 - a1.chargesVariables / a1.chiffreAffaires : 0;
  const fixesTotales = a1.chargesFixes + a1.amortissements + a1.interets + a1.impots;
  const seuilCA = tauxMarge > 0 ? fixesTotales / tauxMarge : null;
  let moisAtteint: number | null = null;
  if (seuilCA !== null) {
    let caCumule = 0;
    for (let m = 1; m <= 12 && moisAtteint === null; m++) {
      caCumule += entreesExploitation[m];
      if (caCumule >= seuilCA - DEMI_FCFA) moisAtteint = m;
    }
  }

  const fluxEconomiques = [-investissementTotal, ...annees.map((a) => a.excedentBrut)];
  const chargesCumulees = somme(annees.map((a) => a.chargesVariables + a.chargesFixes + a.amortissements + a.interets + a.impots));
  const resultatCumule = somme(annees.map((a) => a.resultat));
  const rentabilite = chargesCumulees > 0 ? resultatCumule / chargesCumulees : null;
  const verdict: Verdict = {
    rentabilite: statutRentabilite(rentabilite, resultatCumule),
    tresorerieToujoursPositive: pointBas.montant >= -DEMI_FCFA,
    menageCouvert: e.menage ? annees.every((a) => a.soldeResiduel >= -DEMI_FCFA) : null,
  };

  return {
    annees,
    tresorerie,
    creux,
    seuilCA,
    moisAtteint,
    fluxEconomiques,
    rentabilite,
    verdict,
    pointBas,
    seuilCommercialisation: seuilCommercialisation(e, scenario, annees),
  };
}

/** Besoin annuel à couvrir par les ventes (DOC-00106 p. 4-5) : charges décaissées, impôts, annuités, prélèvements nets. */
export const besoinCommercialisation = (a: Pick<AnneeResultat, "chargesVariables" | "chargesFixes" | "impots" | "annuites" | "prelevementsNets">) =>
  a.chargesVariables + a.chargesFixes + a.impots + a.annuites + a.prelevementsNets;

function seuilCommercialisation(e: Entree, scenario: Scenario, annees: AnneeResultat[]): SeuilCommercialisation {
  // L'année la plus exigeante : coefficient le plus haut (ou besoin le plus haut s'il n'y a aucune vente).
  const coef = (a: AnneeResultat) => (a.chiffreAffaires > 0 ? besoinCommercialisation(a) / a.chiffreAffaires : Infinity);
  const retenue = annees.reduce((pire, a) => {
    const c = coef(a);
    const p = coef(pire);
    return c > p || (c === p && besoinCommercialisation(a) > besoinCommercialisation(pire)) ? a : pire;
  }, annees[0]);
  const besoin = besoinCommercialisation(retenue);
  const coefficientPrix = retenue.chiffreAffaires > 0 ? besoin / retenue.chiffreAffaires : null;
  const hPrix = Math.pow(1 + e.haussePrix, retenue.an - 1);
  return {
    an: retenue.an,
    besoinAnnuel: besoin,
    chiffreAffaires: retenue.chiffreAffaires,
    coefficientPrix,
    parLigne: e.revenus
      .filter((r) => quantiteVendueAn(r, scenario) > 0)
      .map((r) => ({
        ligneId: r.id,
        libelle: r.libelle,
        quantiteVendue: quantiteVendueAn(r, scenario),
        prixActuel: r.prixUnitaire * hPrix,
        prixSeuil: coefficientPrix === null ? 0 : r.prixUnitaire * hPrix * coefficientPrix,
      })),
  };
}

const arrondirAnnee = (a: AnneeResultat): AnneeResultat => ({
  an: a.an,
  chiffreAffaires: fcfa(a.chiffreAffaires),
  chargesVariables: fcfa(a.chargesVariables),
  chargesFixes: fcfa(a.chargesFixes),
  margeBrute: fcfa(a.margeBrute),
  excedentBrut: fcfa(a.excedentBrut),
  amortissements: fcfa(a.amortissements),
  interets: fcfa(a.interets),
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
  const pointBasTresorerie = { montant: fcfa(c.pointBas.montant), mois: c.pointBas.mois };
  const donnees: DonneesControles = {
    charges: e.charges,
    revenus: e.revenus.map((r) => ({ id: r.id, libelle: r.libelle, quantite: r.quantite[scenario], bornesQuantite: r.bornesQuantite })),
    apport: e.apport,
    credit: e.credit ? { montant: e.credit.montant } : null,
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
  };
  const ratios = calculerRatios(donnees);
  return {
    annees,
    tresorerieMensuelleAn1: tresorerie,
    besoinFondsRoulement: fcfa(-c.creux),
    seuilRentabilite: { chiffreAffaires: c.seuilCA === null ? null : fcfa(c.seuilCA), moisAtteint: c.moisAtteint },
    van: fcfa(van(c.fluxEconomiques, e.tauxActualisation)),
    tri: triBrut === null ? null : taux(triBrut),
    delaiRecuperationAns: delai === null ? null : Math.round(delai * 100) / 100,
    rentabilite: c.rentabilite === null ? null : taux(c.rentabilite),
    statut: statutCombine(c.verdict),
    verdict: c.verdict,
    pointBasTresorerie,
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
  return {
    versionMoteur: VERSION_MOTEURS,
    investissementTotal: fcfa(investissementTotal),
    besoinFinancement: fcfa(Math.max(0, investissementTotal + scenarios.realiste.besoinFondsRoulement - e.apport)),
    scenarios,
  };
}
