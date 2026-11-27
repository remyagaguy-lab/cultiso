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
  type AnneeResultat,
  type MoisTresorerie,
  type PointBas,
  type ResultatFinance,
  type ResultatScenario,
  type Scenario,
} from "./finance";
export {
  coefficientProduction,
  construireGrille,
  HORIZON_MAX_MOIS,
  indiceHausse,
  resoudreHorizon,
  schemaCalendrierLigne,
  schemaMontee,
  type Grille,
  type Horizon,
  type InvestissementDate,
  type LigneGrille,
  type Montee,
  type OrigineHorizon,
} from "./calendrier";
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
export { schemaBandes, simulerBandes, type CoutAnimalPretAProduire, type EntreeBandes, type MoisBandes, type Renouvellement, type ResultatBandes, type SeuilTechnique } from "./bandes";
export { schemaTroupeau, simulerTroupeau, TYPES_ENTREE, TYPES_SORTIE, type BilanCategorie, type EntreeTroupeau, type ResultatTroupeau } from "./troupeau";
export { calculerFinancement, financementPourMoteur, plafondCampagne, schemaFinancementComplet, type EntreeFinancement, type ResultatFinancement, type MoisFinancement, type AnneeFinancement, type ControleFinancement } from "./financement";
export { calculerMainOeuvre, schemaMainOeuvre, type EntreeMainOeuvre, type ResultatMainOeuvre, type MoisMainOeuvre, type ControleMainOeuvre } from "./main-oeuvre";
export { lignesDepuisBandes, lignesDepuisTroupeau, type LignesRaccordees, type OptionsRaccord } from "./raccord";
