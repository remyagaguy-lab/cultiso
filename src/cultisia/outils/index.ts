import { saisirOperation } from "./actions";
import { OUTILS_CALCUL } from "./calcul";
import { OUTILS_CONSULTATION } from "./consultation";
import { OUTILS_LECTURE } from "./lecture";
import { ouvrirModule } from "./orientation";
import { RegistreOutils, type DefinitionOutil } from "./registre";

/** Registre par défaut de Cultisia : orientation, action, lecture (couche 2), calcul (couche 3) et consultation de cadrage. */
export function registreParDefaut(): RegistreOutils {
  const outils: DefinitionOutil[] = [ouvrirModule, saisirOperation, ...OUTILS_LECTURE, ...OUTILS_CALCUL, ...OUTILS_CONSULTATION];
  return new RegistreOutils(outils);
}
