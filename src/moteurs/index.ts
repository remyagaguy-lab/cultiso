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
export { CODES_CONTROLE, type CodeControle, type Controle, type NiveauControle, type Ratios } from "./controles";
export {
  genererBudget,
  type EntreeBudget,
  type ModeleCharge,
  type ModeleRevenu,
  type Origine,
  type RegleAjustement,
  type ResultatBudget,
} from "./budget";
