import { saisirOperation } from "./actions";
import { OUTILS_LECTURE } from "./lecture";
import { ouvrirModule } from "./orientation";
import { RegistreOutils, type DefinitionOutil } from "./registre";

/** Registre par défaut de Cultisia. Les outils de calcul arriveront avec le chantier Cultiplan. */
export function registreParDefaut(): RegistreOutils {
  const outils: DefinitionOutil[] = [ouvrirModule, saisirOperation, ...OUTILS_LECTURE];
  return new RegistreOutils(outils);
}
