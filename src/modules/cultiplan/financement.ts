// Financement d'un plan (M6) : relie le moteur de financement (src/moteurs/financement.ts) au plan Cultiplan et au référentiel.
// Les chiffres d'exploitation viennent du moteur financier (plan.resultats, scénario réaliste) ; ceux du financement, du corps de la demande.
// Le barème du crédit de campagne vient de ref.baremes_credit_campagne ; sans barème, le plafond reste inconnu et le moteur le dit.
// Le financement détaillé s'enregistre dans le plan (plans.financement.detaille) ; cette route le calcule à la demande sans l'enregistrer.
import type { ClientBase } from "@/core/exploitation";
import { calculerFinancement, plafondCampagne, type EntreeFinancement, type ResultatFinancement } from "@/moteurs";
import type { MoisFinancement } from "@/moteurs/financement";
import { ErreurPlan } from "./erreurs";
import { verifier } from "./lignes";
import { resoudreBaremesDetail } from "./baremes-plan";
import { calculerAvecFinancement } from "./calcul-plan";
import { schemaDemandeFinancement, type DemandeFinancementValidee } from "./financement-demande";
import { entreeFinance, lirePlan, type Plan } from "./service";

export { schemaCampagneDemandee, schemaDemandeFinancement, type DemandeFinancement } from "./financement-demande";

export interface BaremeLu {
  plafondParUnite: number;
  source: string;
  statut?: string;
  organisme?: string | null;
}

/** Un mois de la trésorerie du plan avec le financement détaillé (M6) à la place du financement simple du plan. */
export interface MoisTresorerieFinancee {
  mois: number;
  /** Solde d'exploitation du mois : investissements, charges, ventes, impôts, ménage, SANS apport ni crédit du plan. */
  exploitation: number;
  /** Flux du financement détaillé (apports, prêts, subventions, campagne, chaîne, moins capital, intérêts et taxe). */
  financement: number;
  /** Retenue de l'acheteur sur la récolte (crédit de chaîne) : argent non encaissé par l'exploitation. */
  retenuesAcheteur: number;
  solde: number;
  cumul: number;
}
export interface TresorerieFinancee {
  mois: MoisTresorerieFinancee[];
  pointBas: { montant: number; mois: number };
  moisTresorerieNegative: number[];
  /** Ce qui rend la lecture partielle (horizons différents, etc.). */
  notes: string[];
}

export interface ResultatFinancementPlan {
  planId: string;
  financement: ResultatFinancement;
  /** Trésorerie du plan (scénario réaliste) additionnée aux flux du financement détaillé ; le financement simple du plan (apport, crédit) en est retiré. */
  tresorerie: TresorerieFinancee;
  /** D'où viennent les chiffres du moteur : plan (emplois, CAF) et référentiel (barèmes). */
  origines: string[];
  /** Ce qui n'a pas pu être évalué (barème introuvable, plan sans résultat...). */
  manques: string[];
}

/** Pur : assemble l'entrée du moteur de financement à partir du plan et des barèmes déjà lus (par identifiant de crédit). */
export function assemblerFinancement(
  plan: Pick<Plan, "id" | "hypotheses" | "resultats">,
  demande: DemandeFinancementValidee,
  baremes: Map<string, BaremeLu | null>,
): { entree: EntreeFinancement; origines: string[]; manques: string[] } {
  const manques: string[] = [];
  const origines: string[] = [];
  if (!plan.resultats) throw new ErreurPlan("Ce plan n'a pas encore de résultat : calcule-le d'abord.", "invalide");
  const reel = plan.resultats.scenarios.realiste;
  const bfr = reel.besoinFondsRoulement;
  const investissement = Math.max(reel.ratios.coutProjet - bfr, 0);
  origines.push("Investissement, besoin en fonds de roulement et CAF : moteur financier, scénario réaliste du plan.");
  const horizonMois = demande.horizonMois ?? reel.horizon?.mois ?? plan.hypotheses.horizonAnnees * 12;
  const nAns = Math.ceil(horizonMois / 12);

  const creditsCampagne = demande.creditsCampagne.map(({ baremeDe, ...c }) => {
    if (c.plafond || !baremeDe) return c;
    const b = baremes.get(c.id) ?? null;
    if (!b) {
      manques.push(`Aucun barème de crédit de campagne dans le référentiel pour ${baremeDe.speculationCode} : le plafond de « ${c.libelle} » n'est pas vérifié.`);
      return c;
    }
    origines.push(`Plafond de « ${c.libelle} » : barème ${b.organisme ?? "général"} du référentiel (${b.source}, statut ${b.statut ?? "inconnu"}).`);
    return { ...c, plafond: plafondCampagne(b, baremeDe.tailleAtelier) };
  });

  const annees = reel.annees.slice(0, nAns);
  return {
    entree: {
      ...demande,
      horizonMois,
      creditsCampagne,
      emploisInitiaux: { investissement, bfr },
      exploitation: {
        tresorerieInitiale: 0,
        cafParAn: annees.map((a) => a.cafNette),
        // Le moteur financier compte l'investissement et le BFR une seule fois, au démarrage.
        investissementsParAn: annees.map((_, i) => (i === 0 ? investissement : 0)),
        variationBfrParAn: annees.map((_, i) => (i === 0 ? bfr : 0)),
      },
    },
    origines,
    manques,
  };
}

/**
 * Service : calcule, à la demande et sans rien enregistrer, le financement détaillé d'un plan (« et si ? »). Le calcul est celui du plan enregistré
 * (`calculerAvecFinancement`) : le financement détaillé est branché sur la grille de M1. Pour l'enregistrer, passer `financement: { detaille }` à la modification du plan.
 */
export async function financerPlan(client: ClientBase, planId: string, corps: unknown): Promise<ResultatFinancementPlan> {
  const demande = verifier(schemaDemandeFinancement, corps);
  const plan = await lirePlan(client, planId);
  if (!plan.resultats) throw new ErreurPlan("Ce plan n'a pas encore de résultat : calcule-le d'abord.", "invalide");
  const { horizonMois: _horizon, ...detail } = demande;
  const { detaille, origines, manques } = await resoudreBaremesDetail(client, detail);
  const calcul = calculerAvecFinancement(entreeFinance(plan), detaille);
  const fin = calcul.financement as ResultatFinancement;
  const exploitation = calcul.exploitationSeule!.tresorerieMensuelle;
  const branchee = calcul.resultats.scenarios.realiste.tresorerieMensuelle;
  const mois: MoisTresorerieFinancee[] = branchee.map((t, m) => ({
    mois: m,
    exploitation: exploitation[m].solde,
    financement: fin.mois[m]?.flux ?? 0,
    retenuesAcheteur: fin.mois[m]?.retenuesAcheteur ?? 0,
    solde: t.solde,
    cumul: t.cumul,
  }));
  const bas = mois.reduce((b, x) => (x.cumul < b.cumul ? x : b), mois[0]);
  const tresorerie: TresorerieFinancee = {
    mois,
    pointBas: { montant: bas.cumul, mois: bas.mois },
    moisTresorerieNegative: mois.filter((x) => x.cumul < 0).map((x) => x.mois),
    notes: calcul.resultats.scenarios.realiste.avertissements,
  };
  origines.unshift("Investissement, besoin en fonds de roulement et CAF : moteur financier, scénario réaliste du plan sans son financement simple.");
  origines.push("Trésorerie : grille mensuelle du moteur financier (2.1.0) avec le financement détaillé à la place de l'apport et du crédit simples ; la retenue de l'acheteur est déjà dans le flux, elle n'est pas retranchée une seconde fois.");
  return { planId, financement: fin, tresorerie, origines, manques };
}

/**
 * Pur : trésorerie d'exploitation du plan (sans financement) + flux du financement détaillé (M6) − retenues de l'acheteur, mois par mois.
 * Les deux grilles suivent les mêmes conventions (mois 0 = démarrage). Sur la partie commune seulement : un écart d'horizon est signalé, jamais comblé.
 */
export function additionnerFinancement(exploitation: { mois: number; solde: number }[], financement: Pick<MoisFinancement, "mois" | "flux" | "retenuesAcheteur">[]): TresorerieFinancee {
  const notes: string[] = [];
  const n = Math.min(exploitation.length, financement.length);
  if (exploitation.length !== financement.length) {
    notes.push(`Le plan couvre ${exploitation.length - 1} mois et le financement ${financement.length - 1} : seuls les ${n - 1} premiers mois sont additionnés.`);
  }
  let cumul = 0;
  const mois: MoisTresorerieFinancee[] = [];
  for (let m = 0; m < n; m++) {
    const solde = exploitation[m].solde + financement[m].flux - financement[m].retenuesAcheteur;
    cumul += solde;
    mois.push({ mois: m, exploitation: exploitation[m].solde, financement: financement[m].flux, retenuesAcheteur: financement[m].retenuesAcheteur, solde, cumul });
  }
  const bas = mois.reduce((b, x) => (x.cumul < b.cumul ? x : b), mois[0]);
  return {
    mois,
    pointBas: { montant: bas.cumul, mois: bas.mois },
    moisTresorerieNegative: mois.filter((x) => x.cumul < 0).map((x) => x.mois),
    notes,
  };
}
