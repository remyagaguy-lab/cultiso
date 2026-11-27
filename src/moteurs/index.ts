// Moteurs de calcul de Cultiso : code pur, sans base, réseau ni IA. Aucun calcul financier hors de ce dossier.
export { ErreurMoteur, VERSION_MOTEURS } from "./commun";
export { calculerCredit, TAUX_IMF_PAR_DEFAUT, type EntreeCredit, type ResultatCredit } from "./credit";
export {
  calculerFinances,
  HORIZON_PAR_DEFAUT,
  SCENARIOS,
  TAUX_ACTUALISATION_PAR_DEFAUT,
  type EntreeFinance,
  type LigneCharge,
  type LigneRevenu,
  type ResultatFinance,
  type Scenario,
} from "./finance";
export { CODES_CONTROLE, type CodeControle, type Controle, type NiveauControle, type Ratios, type RegleFinanceur } from "./controles";
export { alertesPrudence } from "./prudence";
export {
  clesIndicateurs,
  controlesSansExplication,
  expliquerControle,
  expliquerControles,
  expliquerIndicateur,
  lexique,
  lexiqueEnMarkdown,
  VERSION_EXPLICATIONS,
  type ControleExplique,
  type EntreeLexique,
  type Explication,
} from "./explications";
export { analyserSensibilite, HYPOTHESES_CLES, type HypotheseCle, type Intensite, type SeuilIntensification, type Sensibilite } from "./sensibilite";
export {
  genererBudget,
  type EntreeBudget,
  type ModeleCharge,
  type ModeleRevenu,
  type Origine,
  type RegleAjustement,
  type ResultatBudget,
} from "./budget";
