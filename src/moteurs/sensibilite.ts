// Sensibilité (M5) : ce qui fait basculer le projet. Calculée sur le scénario réaliste.
// - chaque hypothèse clé (prix, rendement, pertes, intrants, main d'oeuvre) varie de ±10 % et ±20 % (grille en paramètre) ;
//   on mesure le résultat cumulé, le point bas de trésorerie et la VAN ;
// - prix et rendement d'équilibre (résultat nul l'année la plus exigeante) ;
// - test du prix bas : le revenu du ménage reste-t-il couvert ? (DOC-00011 p. 33) ;
// - tableau rendement × charges du seuil de commercialisation (DOC-00106 p. 13).
// Ce module ne connaît pas le moteur financier : il reçoit la fonction qui calcule un scénario (pas de dépendance circulaire).
import { fcfa, somme, taux } from "./commun";
import type { AnneeResultat, EntreeFinanceValidee, StatutRentabilite, Verdict } from "./finance";

export const HYPOTHESES_CLES = ["prix", "rendement", "pertes", "intrants", "mainOeuvre"] as const;
export type HypotheseCle = (typeof HYPOTHESES_CLES)[number];

/** Types de charge (codes de la typologie des lignes, pas des valeurs de référence) visés par « intrants » et « main d'oeuvre ». */
export const TYPES_CHARGE_SENSIBILITE: Record<"intrants" | "mainOeuvre", string> = { intrants: "intrants", mainOeuvre: "main_oeuvre" };

type Entree = EntreeFinanceValidee;

/** Ce que la sensibilité lit d'un calcul de scénario (non arrondi). */
export interface Mesure {
  annees: AnneeResultat[];
  pointBas: number;
  van: number;
  verdict: Verdict;
  statut: StatutRentabilite;
}
export type Mesurer = (e: Entree) => Mesure;

export interface VariationMesuree {
  hypothese: HypotheseCle;
  variation: number;
  resultatCumule: number;
  pointBasTresorerie: number;
  van: number;
  ecartResultat: number;
  ecartPointBas: number;
  ecartVan: number;
}

export interface LigneEquilibre {
  ligneId: string;
  libelle: string;
  prixActuel: number;
  /** Prix qui annule le résultat de l'année retenue, les autres hypothèses restant inchangées. */
  prixEquilibre: number;
  /** Quantité produite (par cycle ou par an, comme la ligne, avant pertes) qui annule ce résultat. */
  quantiteActuelle: number;
  quantiteEquilibre: number;
}

export interface Equilibre {
  /** Année la plus exigeante (coefficient le plus haut). */
  an: number;
  /** Prix (ou rendement) d'équilibre / actuel : 0,7 = le prix peut baisser de 30 % avant de perdre de l'argent. null sans vente. */
  coefficient: number | null;
  parLigne: LigneEquilibre[];
}

export interface TestPrixBas {
  /** Baisse de prix appliquée (−0,2 = −20 %). */
  baisse: number;
  /** D'où vient la baisse : paramètre explicite, écart de prix du scénario pessimiste, ou plus forte baisse de la grille. */
  origine: "parametre" | "scenario_pessimiste" | "grille";
  statut: StatutRentabilite;
  verdict: Verdict;
  resultatCumule: number;
  pointBasTresorerie: number;
  /** Plus petit solde résiduel de l'horizon ; null si le ménage n'est pas renseigné. */
  soldeResiduelMin: number | null;
}

export interface TableauSeuil {
  axeRendement: number[];
  axeCharges: number[];
  /** coefficientsPrix[i][j] : seuil de commercialisation / prix actuel, rendement axeRendement[i], charges axeCharges[j]. */
  coefficientsPrix: (number | null)[][];
  /** Ligne de revenu principale (le plus gros chiffre d'affaires) et son prix seuil pour chaque case. */
  lignePrincipale: { ligneId: string; libelle: string; prixActuel: number; prixSeuil: (number | null)[][] } | null;
}

export interface Sensibilite {
  base: { resultatCumule: number; pointBasTresorerie: number; van: number };
  variations: VariationMesuree[];
  /** Hypothèses de la plus influente à la moins influente sur le résultat (écart absolu à la plus forte variation). */
  classement: HypotheseCle[];
  equilibre: Equilibre;
  testPrixBas: TestPrixBas;
  tableauSeuil: TableauSeuil;
}

/** Entrée modifiée : une hypothèse clé multipliée par (1 + variation). */
export function varier(e: Entree, hypothese: HypotheseCle, variation: number): Entree {
  const f = 1 + variation;
  switch (hypothese) {
    case "prix":
      return { ...e, revenus: e.revenus.map((r) => ({ ...r, prixUnitaire: r.prixUnitaire * f })) };
    case "rendement":
      return {
        ...e,
        revenus: e.revenus.map((r) => ({
          ...r,
          quantite: { pessimiste: r.quantite.pessimiste * f, realiste: r.quantite.realiste * f, optimiste: r.quantite.optimiste * f },
        })),
      };
    case "pertes":
      return { ...e, revenus: e.revenus.map((r) => ({ ...r, pertes: Math.min(1, Math.max(0, r.pertes * f)) })) };
    case "intrants":
    case "mainOeuvre": {
      const type = TYPES_CHARGE_SENSIBILITE[hypothese];
      return {
        ...e,
        charges: e.charges.map((c) => (c.classe === "exploitation" && c.typeCharge === type ? { ...c, prixUnitaire: c.prixUnitaire * f } : c)),
        salairesAnnuels: hypothese === "mainOeuvre" ? e.salairesAnnuels * f : e.salairesAnnuels,
      };
    }
  }
}

const resultatCumule = (m: Mesure) => somme(m.annees.map((a) => a.resultat));
const besoinDecaisse = (a: AnneeResultat, facteurCharges: number) =>
  (a.chargesVariables + a.chargesFixes) * facteurCharges + a.impots + a.annuites + a.prelevementsNets;
const prixArrondi = (p: number) => Math.round(p * 100) / 100;

/** CA réaliste de l'an 1 d'une ligne (pour trouver la ligne principale). */
const caLigne = (r: Entree["revenus"][number]) =>
  r.quantite.realiste * r.prixUnitaire * (1 - r.pertes) * (r.base === "an" ? 1 : r.cyclesParAn);

export function analyserSensibilite(e: Entree, mesurer: Mesurer): Sensibilite {
  const p = e.sensibilite;
  const base = mesurer(e);
  const rBase = resultatCumule(base);

  const variations: VariationMesuree[] = [];
  for (const hypothese of HYPOTHESES_CLES) {
    for (const variation of p.variations) {
      const m = mesurer(varier(e, hypothese, variation));
      const r = resultatCumule(m);
      variations.push({
        hypothese,
        variation,
        resultatCumule: fcfa(r),
        pointBasTresorerie: fcfa(m.pointBas),
        van: fcfa(m.van),
        ecartResultat: fcfa(r - rBase),
        ecartPointBas: fcfa(m.pointBas - base.pointBas),
        ecartVan: fcfa(m.van - base.van),
      });
    }
  }
  const effetMax = (h: HypotheseCle) => Math.max(0, ...variations.filter((v) => v.hypothese === h).map((v) => Math.abs(v.ecartResultat)));
  const classement = [...HYPOTHESES_CLES].sort((a, b) => effetMax(b) - effetMax(a));

  // Équilibre : le résultat est linéaire dans le prix et dans le rendement (pertes et charges inchangées),
  // donc coefficient = (CA − résultat) / CA, sur l'année où il est le plus haut.
  const coef = (a: AnneeResultat) => (a.chiffreAffaires > 0 ? (a.chiffreAffaires - a.resultat) / a.chiffreAffaires : Infinity);
  const anEq = base.annees.reduce((pire, a) => (coef(a) > coef(pire) ? a : pire), base.annees[0]);
  const kEq = anEq.chiffreAffaires > 0 ? coef(anEq) : null;
  const hPrixEq = Math.pow(1 + e.haussePrix, anEq.an - 1);
  const equilibre: Equilibre = {
    an: anEq.an,
    coefficient: kEq === null ? null : taux(kEq),
    parLigne:
      kEq === null
        ? []
        : e.revenus
            .filter((r) => caLigne(r) > 0)
            .map((r) => ({
              ligneId: r.id,
              libelle: r.libelle,
              prixActuel: prixArrondi(r.prixUnitaire * hPrixEq),
              prixEquilibre: prixArrondi(r.prixUnitaire * hPrixEq * kEq),
              quantiteActuelle: prixArrondi(r.quantite.realiste),
              quantiteEquilibre: prixArrondi(r.quantite.realiste * kEq),
            })),
  };

  // Test du prix bas.
  const pessimiste = e.ecartsScenarios.pessimiste.prix;
  const [baisse, origine]: [number, TestPrixBas["origine"]] =
    p.baissePrixBas !== undefined
      ? [p.baissePrixBas, "parametre"]
      : pessimiste < 0
        ? [pessimiste, "scenario_pessimiste"]
        : [Math.min(...p.variations), "grille"];
  const bas = mesurer(varier(e, "prix", baisse));
  const testPrixBas: TestPrixBas = {
    baisse,
    origine,
    statut: bas.statut,
    verdict: bas.verdict,
    resultatCumule: fcfa(resultatCumule(bas)),
    pointBasTresorerie: fcfa(bas.pointBas),
    soldeResiduelMin: e.menage ? fcfa(Math.min(...bas.annees.map((a) => a.soldeResiduel))) : null,
  };

  // Tableau rendement × charges du seuil de commercialisation : coefficient = besoin décaissé / CA, l'année la plus exigeante.
  const coefficientCase = (vr: number, vc: number): number | null => {
    let pire: number | null = null;
    for (const a of base.annees) {
      const ca = a.chiffreAffaires * (1 + vr);
      if (ca <= 0) return null;
      const c = besoinDecaisse(a, 1 + vc) / ca;
      if (pire === null || c > pire) pire = c;
    }
    return pire;
  };
  const brut = p.axeRendement.map((vr) => p.axeCharges.map((vc) => coefficientCase(vr, vc)));
  // Le prix seuil de la ligne principale suit l'année retenue dans chaque case : on le prend au prix de l'an où la case est atteinte.
  const principale = [...e.revenus].filter((r) => caLigne(r) > 0).sort((a, b) => caLigne(b) - caLigne(a))[0];
  const anCase = (vr: number, vc: number) =>
    base.annees.reduce((pire, a) => (besoinDecaisse(a, 1 + vc) / (a.chiffreAffaires * (1 + vr)) > besoinDecaisse(pire, 1 + vc) / (pire.chiffreAffaires * (1 + vr)) ? a : pire), base.annees[0]).an;
  const tableauSeuil: TableauSeuil = {
    axeRendement: p.axeRendement,
    axeCharges: p.axeCharges,
    coefficientsPrix: brut.map((ligne) => ligne.map((c) => (c === null ? null : taux(c)))),
    lignePrincipale: principale
      ? {
          ligneId: principale.id,
          libelle: principale.libelle,
          prixActuel: prixArrondi(principale.prixUnitaire),
          prixSeuil: p.axeRendement.map((vr, i) =>
            p.axeCharges.map((vc, j) => {
              const c = brut[i][j];
              return c === null ? null : prixArrondi(principale.prixUnitaire * Math.pow(1 + e.haussePrix, anCase(vr, vc) - 1) * c);
            }),
          ),
        }
      : null,
  };

  return {
    base: { resultatCumule: fcfa(rBase), pointBasTresorerie: fcfa(base.pointBas), van: fcfa(base.van) },
    variations,
    classement,
    equilibre,
    testPrixBas,
    tableauSeuil,
  };
}
