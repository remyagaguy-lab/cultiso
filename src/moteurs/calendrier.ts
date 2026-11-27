// Moteur calendaire (M1, M2, M17) : la grille mensuelle sur tout l'horizon, qui porte toutes les lignes.
//
// Ce module construit la grille ; finance.ts en tire le compte de résultat annuel, la trésorerie mensuelle pluriannuelle, le point bas
// avec et sans financement, la VAN et le TRI. Code pur : aucune base, aucun réseau, aucune date du jour, aucune valeur de référence.
//
// Conventions :
// - mois 0 = démarrage (apport, crédit tiré au démarrage, investissements datés au mois 0) ; mois 1 à N = grille de l'horizon ;
//   l'an 1 comprend les mois 1 à 12, l'an 2 les mois 13 à 24, etc. ; la dernière année est partielle si N n'est pas un multiple de 12 ;
// - une ligne sans calendrier de cycle reste annuelle : son montant de l'année est réparti sur les mois de `moisDecaissement` /
//   `moisVente` (1 à 12) de chaque année, ou sur 12 mois ; c'est exactement le comportement de la version 1 ;
// - une ligne avec `calendrier` { debutMois, parts } répartit chaque cycle sur les mois du cycle (R1) ; le cycle k démarre au mois
//   debutMois + arrondi(k × 12 / cyclesParAn) ; un cycle qui dépasse l'horizon est coupé (la part hors horizon n'est pas comptée) ;
// - montée en production (M2) : coefficient de rendement et taux d'utilisation par année, indexés par atelier ; l'année au-delà du
//   dernier élément du tableau reprend la dernière valeur (plein régime atteint) ; le coefficient du débutant ne vaut que pour l'an 1 ;
// - hausse des prix et des charges par année et par ligne : `hausseParAn[j]` (passage de l'an j+1 à l'an j+2), sinon `hausseAnnuelle`
//   de la ligne, sinon la hausse uniforme de l'entrée ;
// - un investissement est décaissé au mois `moisAcquisition` (0 par défaut), amorti en linéaire par mois (prorata) à partir du mois
//   suivant, et renouvelé à la fin de sa durée de vie tant que le renouvellement tombe avant la fin de l'horizon ;
// - le crédit est tiré au mois `moisTirageCredit` ; ses échéances suivent ce mois.
import { z } from "zod";
import { somme } from "./commun";
import { echeancierBrut } from "./credit";
import type { EntreeFinanceValidee, Scenario } from "./finance";

/** Horizon maximal de la grille, en mois (10 ans). */
export const HORIZON_MAX_MOIS = 120;
/** Tolérance sur la somme des parts d'un profil de cycle (0,001 = 0,1 %). */
export const TOLERANCE_PARTS = 0.001;

/** Profil mensuel d'un cycle (R1) : part du montant du cycle décaissée ou vendue à chaque mois du cycle. */
export const schemaCalendrierLigne = z
  .object({
    /** Mois de la grille où démarre le premier cycle (1 = premier mois). */
    debutMois: z.number().int().min(1).max(HORIZON_MAX_MOIS).default(1),
    /** Parts par mois de cycle (index 0 = mois du démarrage du cycle) ; la somme vaut 1. */
    parts: z.array(z.number().min(0)).min(1).max(HORIZON_MAX_MOIS),
    /** Itinéraire du référentiel d'où vient le profil (variante, source, statut). */
    origine: z.string().optional(),
  })
  .refine((c) => Math.abs(c.parts.reduce((t, p) => t + p, 0) - 1) <= TOLERANCE_PARTS, { message: "les parts du cycle doivent faire 1 au total", path: ["parts"] });

/** Hausses propres à une ligne (M2). */
export const champsHausseLigne = {
  /** Hausse annuelle de cette ligne ; remplace la hausse uniforme de l'entrée. */
  hausseAnnuelle: z.number().min(-0.5).max(1).optional(),
  /** Hausse année par année : l'élément j est la hausse de l'an j+1 à l'an j+2 ; une année absente retombe sur `hausseAnnuelle`, puis sur l'entrée. */
  hausseParAn: z.array(z.number().min(-0.5).max(1)).max(30).optional(),
};

/** Montée en production d'un atelier (M2, R4). Les coefficients viennent du référentiel (profil pluriannuel) ou de l'appelant. */
export const schemaMontee = z.object({
  /** Atelier visé (champ `atelierId` des lignes). */
  atelierId: z.string().min(1),
  /** Coefficient de rendement par année (index 0 = an 1) : multiplie les quantités vendues. 0 = rien, 1 = plein régime. */
  coefficientsRendement: z.array(z.number().min(0)).min(1).max(30).optional(),
  /** Taux d'utilisation de la capacité par année : multiplie les quantités vendues ET les charges variables de l'atelier (le volume porte les deux). */
  tauxUtilisation: z.array(z.number().min(0).max(1)).min(1).max(30).optional(),
  /** Rendement de l'an 1 d'un porteur débutant, en part du rendement de référence (0,8 = 20 % de moins). Aucune valeur par défaut. */
  debutant: z.object({ coefficientAn1: z.number().min(0).max(1), source: z.string().optional() }).optional(),
  /** D'où viennent ces coefficients (profil du référentiel, saisie). */
  origine: z.string().optional(),
});
export type Montee = z.output<typeof schemaMontee>;

export const schemaHorizon = {
  /** Horizon en années (1 à 10). */
  horizonAnnees: z.number().int().min(1).max(HORIZON_MAX_MOIS / 12).optional(),
  /** Horizon en mois (1 à 120) : il l'emporte sur les années et les cycles. */
  horizonMois: z.number().int().min(1).max(HORIZON_MAX_MOIS).optional(),
  /** Horizon en nombre de cycles du plan (le plus long cycle des lignes) : il l'emporte sur les années. */
  horizonCycles: z.number().positive().max(HORIZON_MAX_MOIS).optional(),
};

export type OrigineHorizon = "mois" | "cycles" | "annees" | "defaut";
export interface Horizon {
  /** Nombre de mois de la grille (mois 1 à N). */
  mois: number;
  /** Nombre d'années touchées (la dernière peut être partielle). */
  annees: number;
  /** Années complètes (12 mois) : seules elles portent la VAN et le TRI. */
  anneesCompletes: number;
  origine: OrigineHorizon;
  /** Durée du plus long cycle du plan, en mois (cycle des lignes ou longueur de leur profil). */
  cycleMois: number;
  /** Mois du tirage + durée du crédit ; 0 sans crédit. */
  creditMois: number;
  /** Mois à partir desquels tous les ateliers sont à plein régime (montée en production, entrée en production des pérennes). */
  pleinRegimeMois: number;
  /** VAN, TRI et délai de récupération ne se calculent que sur au moins deux années complètes. */
  indicateursAnnuels: boolean;
}

type Entree = EntreeFinanceValidee;
type Ligne = Entree["charges"][number];
type LigneRev = Entree["revenus"][number];

const anDuMois = (m: number) => (m <= 0 ? 1 : Math.ceil(m / 12));
const montantCharge = (c: Ligne) => c.quantite * c.prixUnitaire * c.frequence;
const parAn = (montant: number, l: { base: "cycle" | "an"; cyclesParAn: number }) => (l.base === "an" ? montant : montant * l.cyclesParAn);
const coefficientDe = (tableau: readonly number[], an: number) => tableau[Math.min(an, tableau.length) - 1];

/** Indice de hausse d'une ligne à l'année `an` (1 à l'an 1) : produit des hausses des passages d'année. */
export function indiceHausse(l: { hausseAnnuelle?: number; hausseParAn?: number[] }, hausseUniforme: number, an: number): number {
  let indice = 1;
  for (let j = 2; j <= an; j++) indice *= 1 + (l.hausseParAn?.[j - 2] ?? l.hausseAnnuelle ?? hausseUniforme);
  return indice;
}

/** Coefficient de production d'une ligne de revenu à l'année `an` : montée de l'atelier, taux d'utilisation, débutant, entrée en production d'un pérenne. */
export function coefficientProduction(e: Pick<Entree, "montee">, r: Pick<LigneRev, "atelierId" | "perenne">, an: number): number {
  const m = r.atelierId ? e.montee.find((a) => a.atelierId === r.atelierId) : undefined;
  let coef = 1;
  if (m?.coefficientsRendement) coef *= coefficientDe(m.coefficientsRendement, an);
  if (m?.tauxUtilisation) coef *= coefficientDe(m.tauxUtilisation, an);
  if (m?.debutant && an === 1) coef *= m.debutant.coefficientAn1;
  const entree = r.perenne?.anneeEntreeProduction;
  if (entree !== undefined && an < entree) coef = 0;
  return coef;
}

/** Part du volume d'un atelier utilisée l'année `an` : seule la capacité pèse sur les charges variables (le rendement n'en change pas le coût). */
const coefficientVolume = (e: Pick<Entree, "montee">, atelierId: string | undefined, an: number) => {
  const m = atelierId ? e.montee.find((a) => a.atelierId === atelierId) : undefined;
  return m?.tauxUtilisation ? coefficientDe(m.tauxUtilisation, an) : 1;
};

const dureeCycleMois = (l: { base: "cycle" | "an"; cyclesParAn: number; calendrier?: { debutMois: number; parts: number[] } }) =>
  l.calendrier ? l.calendrier.parts.length : l.base === "cycle" ? 12 / l.cyclesParAn : 12;

/** Résout l'horizon (M17) : mois > cycles > années > défaut (le plus long entre un cycle, la durée du crédit et le plein régime, arrondi à l'année). */
export function resoudreHorizon(e: Entree): Horizon {
  const lignes = [...e.charges, ...e.revenus];
  const cycleLong = lignes.length === 0 ? 12 : Math.max(...lignes.map(dureeCycleMois));
  const creditMois = e.credit ? e.moisTirageCredit + e.credit.dureeMois : 0;
  const anneesPlein = Math.max(
    0,
    ...e.montee.map((a) => Math.max(a.coefficientsRendement?.length ?? 0, a.tauxUtilisation?.length ?? 0)),
    ...e.revenus.map((r) => r.perenne?.anneeEntreeProduction ?? 0),
  );
  const pleinRegimeMois = anneesPlein * 12;
  let mois: number;
  let origine: OrigineHorizon;
  if (e.horizonMois !== undefined) {
    mois = e.horizonMois;
    origine = "mois";
  } else if (e.horizonCycles !== undefined) {
    mois = Math.min(HORIZON_MAX_MOIS, Math.max(1, Math.ceil(e.horizonCycles * cycleLong)));
    origine = "cycles";
  } else if (e.horizonAnnees !== undefined) {
    mois = e.horizonAnnees * 12;
    origine = "annees";
  } else {
    const plusLong = Math.max(cycleLong, creditMois, pleinRegimeMois, 12);
    mois = Math.min(HORIZON_MAX_MOIS, Math.ceil(plusLong / 12) * 12);
    origine = "defaut";
  }
  const anneesCompletes = Math.floor(mois / 12);
  return {
    mois,
    annees: Math.ceil(mois / 12),
    anneesCompletes,
    origine,
    cycleMois: Math.round(cycleLong * 100) / 100,
    creditMois,
    pleinRegimeMois,
    indicateursAnnuels: anneesCompletes >= 2,
  };
}

export interface LigneGrille {
  id: string;
  libelle: string;
  sens: "charge" | "revenu";
  classe: "exploitation" | "investissement";
  nature: "fixe" | "variable" | null;
  atelierId: string | null;
  /** Montant de chaque mois (index 0 = démarrage, 1 à N). Un investissement porte aussi ses renouvellements. */
  mensuel: number[];
}

export interface InvestissementDate {
  ligneId: string;
  libelle: string;
  /** Mois du décaissement (0 = démarrage). */
  mois: number;
  an: number;
  montant: number;
  /** Faux pour l'achat initial, vrai pour un renouvellement à la fin de la durée de vie. */
  renouvellement: boolean;
}

/** Grille mensuelle brute (non arrondie), index 0 à N. */
export interface Grille {
  horizon: Horizon;
  lignes: LigneGrille[];
  chiffreAffaires: number[];
  chargesVariables: number[];
  chargesFixes: number[];
  /** Charges d'exploitation décaissées (variables + fixes, salaires compris). */
  chargesExploitation: number[];
  salaires: number[];
  investissements: number[];
  amortissements: number[];
  interets: number[];
  capitalRembourse: number[];
  echeances: number[];
  tirageCredit: number[];
  apport: number[];
  impots: number[];
  /** Prélèvements du ménage moins ses revenus extérieurs. */
  menage: number[];
  investissementsDates: InvestissementDate[];
  avertissements: string[];
}

/** Répartit un montant annuel sur les mois d'une liste (1 à 12), pour chaque année de la grille. */
function placerAnnuel(cible: number[], horizonMois: number, montantParAn: (an: number) => number, moisListe: number[] | undefined) {
  const cibles = moisListe && moisListe.length > 0 ? moisListe : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (let an = 1; an <= Math.ceil(horizonMois / 12); an++) {
    const montant = montantParAn(an);
    if (montant === 0) continue;
    for (const m of cibles) {
      const mois = (an - 1) * 12 + m;
      if (mois <= horizonMois) cible[mois] += montant / cibles.length;
    }
  }
}

/** Place les cycles d'une ligne sur la grille selon son profil de cycle (R1). */
function placerCycles(cible: number[], horizonMois: number, montantCycle: (an: number) => number, cyclesParAn: number, cal: { debutMois: number; parts: number[] }) {
  for (let k = 0; ; k++) {
    const debut = cal.debutMois + Math.round((k * 12) / cyclesParAn);
    if (debut > horizonMois) break;
    cal.parts.forEach((part, j) => {
      const mois = debut + j;
      if (mois <= horizonMois && part > 0) cible[mois] += montantCycle(anDuMois(mois)) * part;
    });
  }
}

export function construireGrille(e: Entree, scenario: Scenario): Grille {
  const horizon = resoudreHorizon(e);
  const N = horizon.mois;
  const vide = () => new Array<number>(N + 1).fill(0);
  const avertissements: string[] = [];
  const lignes: LigneGrille[] = [];
  const g: Grille = {
    horizon,
    lignes,
    chiffreAffaires: vide(),
    chargesVariables: vide(),
    chargesFixes: vide(),
    chargesExploitation: vide(),
    salaires: vide(),
    investissements: vide(),
    amortissements: vide(),
    interets: vide(),
    capitalRembourse: vide(),
    echeances: vide(),
    tirageCredit: vide(),
    apport: vide(),
    impots: vide(),
    menage: vide(),
    investissementsDates: [],
    avertissements,
  };

  // Revenus.
  for (const r of e.revenus) {
    const mensuel = vide();
    const parCycle = r.quantite[scenario] * (1 - r.pertes) * r.prixUnitaire;
    const montant = (an: number) => parCycle * indiceHausse(r, e.haussePrix, an) * coefficientProduction(e, r, an);
    if (r.calendrier && r.base === "cycle") placerCycles(mensuel, N, montant, r.cyclesParAn, r.calendrier);
    else placerAnnuel(mensuel, N, (an) => parAn(montant(an), r), r.moisVente);
    mensuel.forEach((v, m) => (g.chiffreAffaires[m] += v));
    lignes.push({ id: r.id, libelle: r.libelle, sens: "revenu", classe: "exploitation", nature: null, atelierId: r.atelierId ?? null, mensuel });
  }

  // Charges d'exploitation et investissements.
  for (const c of e.charges) {
    if (c.classe === "exploitation") {
      const mensuel = vide();
      const parCycle = montantCharge(c);
      const volume = (an: number) => (c.nature === "variable" ? coefficientVolume(e, c.atelierId, an) : 1);
      const montant = (an: number) => parCycle * indiceHausse(c, e.hausseCharges, an) * volume(an);
      if (c.calendrier && c.base === "cycle") placerCycles(mensuel, N, montant, c.cyclesParAn, c.calendrier);
      else placerAnnuel(mensuel, N, (an) => parAn(montant(an), c), c.moisDecaissement);
      mensuel.forEach((v, m) => {
        g.chargesExploitation[m] += v;
        (c.nature === "variable" ? g.chargesVariables : g.chargesFixes)[m] += v;
      });
      lignes.push({ id: c.id, libelle: c.libelle, sens: "charge", classe: "exploitation", nature: c.nature, atelierId: c.atelierId ?? null, mensuel });
      continue;
    }
    // Investissement : achat daté, amortissement mensuel au prorata, renouvellement à la fin de la durée de vie.
    const mensuel = vide();
    const dureeMois = (c.dureeVieAns as number) * 12;
    const mois0 = c.moisAcquisition ?? 0;
    if (mois0 > N) {
      avertissements.push(`${c.libelle} : l'achat est prévu au mois ${mois0}, après la fin de l'horizon (${N} mois) ; il n'est pas compté.`);
      lignes.push({ id: c.id, libelle: c.libelle, sens: "charge", classe: "investissement", nature: c.nature, atelierId: c.atelierId ?? null, mensuel });
      continue;
    }
    const evenements: { mois: number; montant: number; renouvellement: boolean }[] = [{ mois: mois0, montant: montantCharge(c), renouvellement: false }];
    if (c.renouvellement) {
      const pas = Math.max(1, Math.round(dureeMois));
      for (let m = mois0 + pas; m < N; m += pas) evenements.push({ mois: m, montant: montantCharge(c) * indiceHausse(c, e.hausseCharges, anDuMois(m)), renouvellement: true });
    }
    for (const ev of evenements) {
      g.investissements[ev.mois] += ev.montant;
      mensuel[ev.mois] += ev.montant;
      g.investissementsDates.push({ ligneId: c.id, libelle: c.libelle, mois: ev.mois, an: anDuMois(ev.mois), montant: ev.montant, renouvellement: ev.renouvellement });
      // Amortissement linéaire : des mois ev.mois + 1 à ev.mois + durée (le dernier mois peut être partiel).
      for (let m = ev.mois + 1; m <= N; m++) {
        const reste = dureeMois - (m - ev.mois - 1);
        if (reste <= 0) break;
        g.amortissements[m] += (ev.montant / dureeMois) * Math.min(1, reste);
      }
    }
    lignes.push({ id: c.id, libelle: c.libelle, sens: "charge", classe: "investissement", nature: c.nature, atelierId: c.atelierId ?? null, mensuel });
  }

  // Salaires (hors lignes), impôts, ménage.
  placerAnnuel(g.salaires, N, (an) => e.salairesAnnuels * Math.pow(1 + e.hausseCharges, an - 1), e.moisSalaires);
  g.salaires.forEach((v, m) => {
    g.chargesExploitation[m] += v;
    g.chargesFixes[m] += v;
  });
  placerAnnuel(g.impots, N, () => e.impotsAnnuels, undefined);
  if (e.menage) {
    placerAnnuel(g.menage, N, () => e.menage!.prelevementsAnnuels, e.menage.moisPrelevements);
    const exterieurs = vide();
    placerAnnuel(exterieurs, N, () => e.menage!.revenusExterieursAnnuels, undefined);
    exterieurs.forEach((v, m) => (g.menage[m] -= v));
  }

  // Financement : apport au démarrage, crédit tiré au mois voulu.
  g.apport[0] = e.apport;
  if (e.credit) {
    const credit = echeancierBrut(e.credit);
    if (e.moisTirageCredit > N) avertissements.push(`Le crédit est tiré au mois ${e.moisTirageCredit}, après la fin de l'horizon (${N} mois) : il n'est pas compté.`);
    else {
      g.tirageCredit[e.moisTirageCredit] += e.credit.montant;
      for (const x of credit.echeancier) {
        const mois = e.moisTirageCredit + x.mois;
        if (mois > N) continue;
        g.interets[mois] += x.interets;
        g.capitalRembourse[mois] += x.amortissement;
        g.echeances[mois] += x.echeance;
      }
    }
  }
  return g;
}

/** Somme d'une grandeur sur les mois d'une année de la grille (le mois 0 n'appartient à aucune année de résultat). */
export const sommeAnnee = (serie: readonly number[], an: number, horizonMois: number) =>
  somme(serie.slice((an - 1) * 12 + 1, Math.min(an * 12, horizonMois) + 1));
