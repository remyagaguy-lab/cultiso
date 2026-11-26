// Moteur financier : compte de résultat pluriannuel, trésorerie mensuelle de l'an 1, BFR,
// seuil de rentabilité, VAN, TRI, délai de récupération, trois scénarios.
// Formules par ligne du Cultiso Brouillon (ground truth §II.2), pluriannuel du Stimulateur, crédit d'Agripilot.
// Le moteur ne connaît aucune filière : seulement des lignes de charges et de revenus.
//
// Conventions :
// - une ligne « cycle » compte par cycle de production et se répète `cyclesParAn` fois ; une ligne « an » compte par an ;
// - les investissements sont décaissés au démarrage (mois 0) et amortis en linéaire sur leur durée de vie ;
// - VAN et TRI portent sur les flux économiques (avant financement) : −investissement, puis l'excédent brut de chaque année ;
//   aucune valeur résiduelle n'est comptée (choix prudent) ;
// - pas d'impôt sur le résultat (petites exploitations, régime à préciser).
import { z } from "zod";
import { fcfa, somme, taux, valider, VERSION_MOTEURS } from "./commun";
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
});

export type LigneCharge = z.input<typeof schemaLigneCharge>;
export type LigneRevenu = z.input<typeof schemaLigneRevenu>;
export type EntreeFinance = z.input<typeof schemaFinance>;
type Entree = z.output<typeof schemaFinance>;
type Charge = z.output<typeof schemaLigneCharge>;
type Revenu = z.output<typeof schemaLigneRevenu>;

export interface AnneeResultat {
  an: number;
  chiffreAffaires: number;
  chargesVariables: number;
  chargesFixes: number;
  margeBrute: number;
  /** Excédent brut d'exploitation : chiffre d'affaires moins charges d'exploitation. */
  excedentBrut: number;
  amortissements: number;
  interets: number;
  resultat: number;
  cafNette: number;
  remboursementCapital: number;
  /** Trésorerie dégagée dans l'année après service de la dette. */
  fluxTresorerie: number;
}

export interface MoisTresorerie {
  mois: number;
  entrees: number;
  sorties: number;
  solde: number;
  cumul: number;
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
  statut: "rentable" | "limite" | "deficitaire";
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

function calculerScenario(e: Entree, scenario: Scenario, credit: ReturnType<typeof echeancierBrut> | null): ResultatScenario {
  const investissements = e.charges.filter((c) => c.classe === "investissement");
  const exploitation = e.charges.filter((c) => c.classe === "exploitation");
  const investissementTotal = somme(investissements.map(montantCharge));
  const caAn1 = (r: Revenu) => parAn(r.quantite[scenario] * r.prixUnitaire * (1 - r.pertes), r);

  const annees: AnneeResultat[] = [];
  for (let an = 1; an <= e.horizonAnnees; an++) {
    const hPrix = Math.pow(1 + e.haussePrix, an - 1);
    const hCharges = Math.pow(1 + e.hausseCharges, an - 1);
    const chiffreAffaires = somme(e.revenus.map(caAn1)) * hPrix;
    const coutAn = (nature: "fixe" | "variable") =>
      somme(exploitation.filter((c) => c.nature === nature).map((c) => parAn(montantCharge(c), c))) * hCharges;
    const chargesVariables = coutAn("variable");
    const chargesFixes = coutAn("fixe");
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
    const excedentBrut = chiffreAffaires - chargesVariables - chargesFixes;
    const resultat = excedentBrut - amortissements - interets;
    const cafNette = resultat + amortissements;
    annees.push({
      an,
      chiffreAffaires,
      chargesVariables,
      chargesFixes,
      margeBrute: chiffreAffaires - chargesVariables,
      excedentBrut,
      amortissements,
      interets,
      resultat,
      cafNette,
      remboursementCapital,
      fluxTresorerie: cafNette - remboursementCapital,
    });
  }

  // Trésorerie mensuelle de l'an 1.
  const entreesExploitation = new Array<number>(13).fill(0);
  const sortiesExploitation = new Array<number>(13).fill(0);
  for (const r of e.revenus) repartir(caAn1(r), r.moisVente).forEach((v, m) => (entreesExploitation[m] += v));
  for (const c of exploitation)
    repartir(parAn(montantCharge(c), c), c.moisDecaissement).forEach((v, m) => (sortiesExploitation[m] += v));
  const echeances = new Array<number>(13).fill(0);
  for (const x of credit?.echeancier ?? []) if (x.mois <= 12) echeances[x.mois] += x.echeance;

  const tresorerie: MoisTresorerie[] = [];
  let cumul = 0;
  let cumulExploitation = 0;
  let creux = 0;
  for (let m = 0; m <= 12; m++) {
    const entrees = m === 0 ? e.apport + (e.credit?.montant ?? 0) : entreesExploitation[m];
    const sorties = m === 0 ? investissementTotal : sortiesExploitation[m] + echeances[m];
    cumul += entrees - sorties;
    tresorerie.push({ mois: m, entrees, sorties, solde: entrees - sorties, cumul });
    if (m > 0) {
      cumulExploitation += entreesExploitation[m] - sortiesExploitation[m];
      creux = Math.min(creux, cumulExploitation);
    }
  }

  // Seuil de rentabilité de l'an 1 : charges fixes (amortissements et intérêts compris) / taux de marge sur coûts variables.
  const a1 = annees[0];
  const tauxMarge = a1.chiffreAffaires > 0 ? 1 - a1.chargesVariables / a1.chiffreAffaires : 0;
  const fixesTotales = a1.chargesFixes + a1.amortissements + a1.interets;
  const seuilCA = tauxMarge > 0 ? fixesTotales / tauxMarge : null;
  let moisAtteint: number | null = null;
  if (seuilCA !== null) {
    let caCumule = 0;
    for (let m = 1; m <= 12 && moisAtteint === null; m++) {
      caCumule += entreesExploitation[m];
      if (caCumule >= seuilCA - 0.5) moisAtteint = m;
    }
  }

  const fluxEconomiques = [-investissementTotal, ...annees.map((a) => a.excedentBrut)];
  const chargesCumulees = somme(annees.map((a) => a.chargesVariables + a.chargesFixes + a.amortissements + a.interets));
  const rentabilite = chargesCumulees > 0 ? somme(annees.map((a) => a.resultat)) / chargesCumulees : null;
  let statut: ResultatScenario["statut"];
  if (rentabilite === null) statut = somme(annees.map((a) => a.resultat)) > 0 ? "rentable" : "deficitaire";
  else if (rentabilite > SEUIL_STATUT) statut = "rentable";
  else if (rentabilite >= -SEUIL_STATUT) statut = "limite";
  else statut = "deficitaire";
  const triBrut = tri(fluxEconomiques);
  const delai = delaiRecuperation(fluxEconomiques);

  return {
    annees: annees.map((a) => ({
      an: a.an,
      chiffreAffaires: fcfa(a.chiffreAffaires),
      chargesVariables: fcfa(a.chargesVariables),
      chargesFixes: fcfa(a.chargesFixes),
      margeBrute: fcfa(a.margeBrute),
      excedentBrut: fcfa(a.excedentBrut),
      amortissements: fcfa(a.amortissements),
      interets: fcfa(a.interets),
      resultat: fcfa(a.resultat),
      cafNette: fcfa(a.cafNette),
      remboursementCapital: fcfa(a.remboursementCapital),
      fluxTresorerie: fcfa(a.fluxTresorerie),
    })),
    tresorerieMensuelleAn1: tresorerie.map((t) => ({
      mois: t.mois,
      entrees: fcfa(t.entrees),
      sorties: fcfa(t.sorties),
      solde: fcfa(t.solde),
      cumul: fcfa(t.cumul),
    })),
    besoinFondsRoulement: fcfa(-creux),
    seuilRentabilite: { chiffreAffaires: seuilCA === null ? null : fcfa(seuilCA), moisAtteint },
    van: fcfa(van(fluxEconomiques, e.tauxActualisation)),
    tri: triBrut === null ? null : taux(triBrut),
    delaiRecuperationAns: delai === null ? null : Math.round(delai * 100) / 100,
    rentabilite: rentabilite === null ? null : taux(rentabilite),
    statut,
  };
}

export function calculerFinances(entree: EntreeFinance): ResultatFinance {
  const e = valider(schemaFinance, entree, "financier");
  const credit = e.credit ? echeancierBrut(e.credit) : null;
  const scenarios = Object.fromEntries(SCENARIOS.map((s) => [s, calculerScenario(e, s, credit)])) as Record<
    Scenario,
    ResultatScenario
  >;
  const investissementTotal = somme(e.charges.filter((c) => c.classe === "investissement").map(montantCharge));
  return {
    versionMoteur: VERSION_MOTEURS,
    investissementTotal: fcfa(investissementTotal),
    besoinFinancement: fcfa(Math.max(0, investissementTotal + scenarios.realiste.besoinFondsRoulement - e.apport)),
    scenarios,
  };
}
