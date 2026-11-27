// Calcul d'un plan avec son financement détaillé (M6) branché sur la grille mensuelle de M1 (moteur 2.1.0). Pur : aucune base.
// Ordre : 1) l'exploitation seule (sans apport ni crédit) donne le coût du projet, le besoin en fonds de roulement et la CAF ;
// 2) le financement détaillé se calcule sur ces emplois ; 3) la grille est recalculée avec ses flux mensuels (frais financiers, taxe, subventions,
// retenues de l'acheteur) à la place de l'apport et du crédit simples ; 4) le plan de financement annuel reprend la CAF finale.
import { calculerFinancement, calculerFinances, financementPourMoteur, type EntreeFinance, type ResultatFinance, type ResultatFinancement } from "@/moteurs";
import type { EntreeFinancement } from "@/moteurs";
import type { FinancementDetaille } from "./financement-demande";

/** Résultat enregistré d'un plan : le moteur financier, plus le financement détaillé quand il existe. */
export type ResultatPlan = ResultatFinance & { financementDetaille?: ResultatFinancement | null };

export interface CalculPlan {
  resultats: ResultatPlan;
  financement: ResultatFinancement | null;
  /** Trésorerie d'exploitation seule (réaliste), pour montrer ce que le financement apporte. */
  exploitationSeule: ResultatFinance["scenarios"]["realiste"] | null;
}

/** Entrée du moteur de financement pour un plan : emplois et CAF d'un calcul d'exploitation seule. */
export function entreeFinancementDepuis(detaille: FinancementDetaille & { horizonMois?: number }, exploitation: ResultatFinance["scenarios"]["realiste"], horizonMois: number): EntreeFinancement {
  const bfr = exploitation.besoinFondsRoulement;
  const investissement = Math.max(exploitation.ratios.coutProjet - bfr, 0);
  const annees = exploitation.annees.slice(0, Math.ceil(horizonMois / 12));
  const { creditsCampagne, ...reste } = detaille;
  return {
    ...reste,
    horizonMois,
    creditsCampagne: creditsCampagne.map(({ baremeDe: _baremeDe, ...c }) => c),
    emploisInitiaux: { investissement, bfr },
    exploitation: {
      tresorerieInitiale: 0,
      cafParAn: annees.map((a) => a.cafNette),
      // Le moteur financier compte l'investissement et le BFR une seule fois, au démarrage.
      investissementsParAn: annees.map((_, i) => (i === 0 ? investissement : 0)),
      variationBfrParAn: annees.map((_, i) => (i === 0 ? bfr : 0)),
    },
  };
}

/**
 * Résumé du financement détaillé pour les contrôles et les ratios du moteur (apport, crédit) : la grille n'en tire aucun flux quand `financement` est donné.
 * Le crédit résumé reprend les conditions du premier prêt avec le total emprunté en prêts ; campagne, chaîne et subventions n'y sont pas comptés.
 */
function resumePourControles(detaille: FinancementDetaille, fin: ResultatFinancement) {
  const prets = detaille.prets;
  const total = prets.reduce((t, p) => t + p.credit.montant, 0);
  return {
    apport: fin.apport.total,
    credit: prets.length > 0 ? { ...prets[0].credit, montant: total } : undefined,
    moisTirageCredit: prets.length > 0 ? prets[0].moisTirage : 0,
  };
}

export function calculerAvecFinancement(entree: EntreeFinance, detaille: FinancementDetaille | null): CalculPlan {
  if (!detaille) return { resultats: calculerFinances(entree), financement: null, exploitationSeule: null };
  const seule = calculerFinances({ ...entree, apport: 0, credit: undefined, financement: undefined }).scenarios.realiste;
  const horizonMois = seule.horizon.mois;
  const premier = calculerFinancement(entreeFinancementDepuis(detaille, seule, horizonMois));
  const branche = (fin: ResultatFinancement) =>
    calculerFinances({ ...entree, horizonMois, ...resumePourControles(detaille, fin), financement: financementPourMoteur(fin.mois) });
  const resultats = branche(premier);
  // Deuxième passage : le plan de financement annuel reprend la CAF finale (intérêts et subventions compris). Les flux mensuels ne changent pas.
  const finale = resultats.scenarios.realiste;
  const fin = calculerFinancement({
    ...entreeFinancementDepuis(detaille, seule, horizonMois),
    exploitation: {
      tresorerieInitiale: 0,
      cafParAn: finale.annees.map((a) => a.cafNette),
      investissementsParAn: finale.annees.map((_, i) => (i === 0 ? Math.max(finale.ratios.coutProjet - finale.besoinFondsRoulement, 0) : 0)),
      variationBfrParAn: finale.annees.map((_, i) => (i === 0 ? finale.besoinFondsRoulement : 0)),
    },
  });
  return { resultats: { ...resultats, financementDetaille: fin }, financement: fin, exploitationSeule: seule };
}
