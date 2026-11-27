// Alertes de prudence (S5) : ce qu'un banquier ou un conseiller prudent signalerait avant de signer.
// Calculées ici, par le moteur, à partir de résultats déjà calculés : l'IA n'en décide aucune.
// Une alerte n'existe que si elle se déclenche (pas de ligne « ok ») ; elle a le même format que les contrôles :
// un code, un niveau, les valeurs qui la fondent et une phrase simple. Aucun seuil n'est écrit ici :
// les seuils viennent des règles du financeur (R11) ou du signe des résultats.
// Sources : ANALYSE-BASE-RESSOURCES.md §4.1 (S5) ; DOC-00011 p. 33 et 42 (risque prix) ; Canevas ANPGF §10.1.
import { enFcfa, type Controle } from "./controles";
import type { ResultatScenario, StatutRentabilite } from "./finance";
import type { Sensibilite } from "./sensibilite";

const ORDRE_STATUT: Record<StatutRentabilite, number> = { rentable: 0, limite: 1, deficitaire: 2 };
const pourcent = (t: number) => `${(Math.round(Math.abs(t) * 1000) / 10).toString().replace(".", ",")} %`;
const listeMois = (m: number[]) => (m.length === 1 ? `au mois ${m[0]}` : `aux mois ${m.join(", ")}`);
const listeAns = (a: number[]) => (a.length === 1 ? `l'an ${a[0]}` : `les ans ${a.join(", ")}`);

/**
 * Alertes de prudence d'un scénario. `sensibilite` (celle du scénario réaliste) permet l'alerte sur l'exposition au prix ;
 * sans elle, cette alerte n'est pas évaluée.
 */
export function alertesPrudence(s: ResultatScenario, sensibilite?: Sensibilite): Controle[] {
  const alertes: Controle[] = [];

  // 1. Apport sous le seuil du financeur : on relit le contrôle déjà calculé, sans refaire le calcul.
  const apport = s.controles.find((c) => c.code === "APPORT_INSUFFISANT" && c.niveau === "alerte");
  if (apport) {
    const v = apport.valeurs;
    alertes.push({
      code: "ALERTE_APPORT_SOUS_SEUIL",
      niveau: "alerte",
      valeurs: v,
      message:
        `Prudence : avec cet apport, ton dossier risque d'être refusé par ${v.financeur}. ` +
        `Il manque ${enFcfa(Number(v.manque))} pour atteindre ${pourcent(Number(v.apportMinimum))} du coût du projet : apporte plus, ou choisis un projet plus petit.`,
    });
  }

  // 2. Revenu du ménage non couvert : le projet ne fait pas vivre la famille et ne rembourse pas le crédit.
  if (s.verdict.menageCouvert === false) {
    const anneesNonCouvertes = s.annees.filter((a) => a.soldeResiduel < 0).map((a) => a.an);
    const soldeMin = Math.min(...s.annees.map((a) => a.soldeResiduel));
    const capaciteMin = Math.min(...s.annees.map((a) => a.capaciteRemboursement));
    alertes.push({
      code: "ALERTE_MENAGE_NON_COUVERT",
      niveau: "bloquant",
      valeurs: { annees: anneesNonCouvertes, soldeResiduelMin: soldeMin, capaciteMin },
      message:
        `Prudence : ${listeAns(anneesNonCouvertes)}, ce que le projet rapporte ne suffit pas pour faire vivre ta famille et payer le crédit (il manque jusqu'à ${enFcfa(-soldeMin)} par an). ` +
        `Ne t'engage pas ainsi : agrandis l'activité, réduis le crédit ou cherche un autre revenu.`,
    });
  }

  // 3. Mois déficitaires non financés : un mois où l'on dépense plus qu'on ne reçoit ET où la caisse est déjà vide.
  const cumulDuMois = (m: number) => s.tresorerieMensuelleAn1.find((t) => t.mois === m)?.cumul ?? 0;
  const nonFinances = s.moisDeficitaires.filter((m) => cumulDuMois(m) < 0);
  if (nonFinances.length > 0) {
    const cumulMin = Math.min(...nonFinances.map(cumulDuMois));
    alertes.push({
      code: "ALERTE_MOIS_DEFICITAIRES_NON_FINANCES",
      niveau: "alerte",
      valeurs: { mois: nonFinances, cumulLePlusBas: cumulMin },
      message:
        `Prudence : ${listeMois(nonFinances)}, tu dépenses plus que tu ne reçois alors que ta caisse est déjà à sec (jusqu'à ${enFcfa(cumulMin)}). ` +
        `Ces mois-là ne sont financés par rien : prévois de l'argent d'avance, un crédit de campagne ou un décalage des dépenses.`,
    });
  }

  // 4. Point bas de trésorerie non couvert.
  if (s.pointBasTresorerie.montant < 0) {
    alertes.push({
      code: "ALERTE_POINT_BAS_NON_COUVERT",
      niveau: "alerte",
      valeurs: { pointBas: s.pointBasTresorerie.montant, mois: s.pointBasTresorerie.mois, manque: -s.pointBasTresorerie.montant },
      message:
        `Prudence : au mois ${s.pointBasTresorerie.mois}, la caisse est au plus bas et il lui manque ${enFcfa(-s.pointBasTresorerie.montant)}. ` +
        `Cet argent doit être trouvé avant de commencer (apport, crédit de campagne), sinon tu ne tiendras pas jusqu'aux ventes.`,
    });
  }

  // 5. Exposition au prix : le projet tient au prix prévu mais pas à un prix plus bas.
  //    Plus on dépense (intrants, main d'oeuvre) pour produire davantage, plus la baisse d'un prix coûte cher (DOC-00011 p. 33 et 42).
  if (sensibilite) {
    const bas = sensibilite.testPrixBas;
    const pire = ORDRE_STATUT[bas.statut] > ORDRE_STATUT[s.statut];
    const menagePerdu = s.verdict.menageCouvert === true && bas.soldeResiduelMin !== null && bas.soldeResiduelMin < 0;
    if (pire || menagePerdu) {
      alertes.push({
        code: "ALERTE_EXPOSITION_PRIX",
        niveau: "alerte",
        valeurs: {
          baisse: bas.baisse,
          origineBaisse: bas.origine,
          statutAuPrixPrevu: s.statut,
          statutAuPrixBas: bas.statut,
          resultatCumuleAuPrixBas: bas.resultatCumule,
          soldeResiduelMinAuPrixBas: bas.soldeResiduelMin,
          coefficientPrixEquilibre: sensibilite.equilibre.coefficient,
        },
        message:
          `Prudence : si le prix de vente baisse de ${pourcent(bas.baisse)}, le projet passe de « ${s.statut} » à « ${bas.statut} »` +
          (menagePerdu ? " et ne couvre plus les besoins de ta famille" : "") +
          `. Plus tu dépenses en intrants et en main d'oeuvre pour produire davantage, plus un prix bas te coûte cher : assure-toi d'un acheteur ou d'un prix minimum avant d'intensifier.`,
      });
    }
  }

  return alertes;
}
