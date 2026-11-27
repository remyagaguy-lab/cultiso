import { saisirOperation } from "./actions";
import { simulerAtelierAnimalOutil } from "./atelier-animal";
import { confronterExistantOutil } from "./besoins";
import { OUTILS_CALCUL } from "./calcul";
import { OUTILS_CONSULTATION } from "./consultation";
import { dimensionnerARebourOutil } from "./dimensionnement";
import { OUTILS_LECTURE } from "./lecture";
import { ouvrirModule } from "./orientation";
import { RegistreOutils, type DefinitionOutil } from "./registre";

/** Registre par défaut de Cultisia : orientation, action, lecture (couche 2), calcul (couche 3) et consultation de cadrage. */
export function registreParDefaut(): RegistreOutils {
  const outils: DefinitionOutil[] = [ouvrirModule, saisirOperation, ...OUTILS_LECTURE, ...OUTILS_CALCUL, ...OUTILS_CONSULTATION, confronterExistantOutil, dimensionnerARebourOutil, simulerAtelierAnimalOutil];
  return new RegistreOutils(outils);
}
