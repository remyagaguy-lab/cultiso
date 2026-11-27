/**
 * Outil « simuler_atelier_animal » (M14) : Cultisia obtient du moteur de bandes le coût de l'animal prêt à produire, le seuil technique
 * (seuil de ponte), la trésorerie mois par mois et l'autofinancement du renouvellement d'un atelier avicole. Les courbes par âge viennent du
 * référentiel (brouillon tant qu'un expert ne les a pas validées) ; l'IA ne calcule rien et ne comble aucune courbe manquante.
 */
import { z } from "zod";
import { schemaAtelierAnimal, simulerAtelierAnimal, type ResultatAtelierAnimal } from "@/modules/cultiplan/atelier-animal";
import { ErreurMoteur } from "@/moteurs";
import { ErreurReferentiel } from "@/referentiel";
import type { Source } from "../evenements";
import { trouverSpeculation } from "./calcul";
import { definirOutil, type ResultatOutil } from "./registre";

const ERREUR_ACCES = "ERREUR D'ACCÈS AUX DONNÉES. Dis à l'utilisateur que la simulation est momentanément indisponible, n'invente aucun chiffre.";
const SOURCES: Source[] = [{ file_name: "Référentiel agricole Cultiso (courbes par âge des ateliers animaux)", origine: "referentiel" }];
const CONSIGNES =
  "Restitue ces phrases et ces chiffres tels quels, en langage simple et en tutoyant. N'ajoute aucune courbe, aucun taux ni aucun prix de ton cru. " +
  "Un élément « non évalué » ou manquant veut dire que la donnée n'a pas de source : dis laquelle, ne la devine pas. Les prix et les effectifs sont ceux que l'utilisateur a donnés.";

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const n = (v: number) => nombre.format(v).replace(/\s/g, " ");

export function formaterAtelierAnimal(r: ResultatAtelierAnimal): string {
  if (r.statut === "non_evaluee" || !r.resultat || !r.origine) {
    return [
      `ATELIER ANIMAL NON ÉVALUÉ${r.variante ? ` (variante ${r.variante})` : ""} :`,
      ...r.manques.map((m) => `- ${m}`),
      r.variantesConnues.length > 0 ? `Variantes connues du référentiel : ${r.variantesConnues.join(", ")}.` : "",
      CONSIGNES,
    ]
      .filter(Boolean)
      .join("\n");
  }
  const x = r.resultat;
  const c = x.coutAnimalPretAProduire;
  return [
    `ATELIER ANIMAL À BANDES (variante ${r.variante}, ${x.horizonMois} mois) :`,
    `- origine des courbes : ${r.origine.sources.join(" ; ")} (statut le moins avancé : ${r.origine.statut}) ; durée de la bande : ${r.origine.dureeBandeMois} ; jours par mois : ${r.origine.joursParMois}`,
    `- ${r.origine.prix}`,
    ...x.lecture.map((l) => `- ${l}`),
    c ? `- coût de l'animal prêt à produire : ${n(c.parSujetPretAProduire)} FCFA par sujet vivant (${n(c.parSujetMisEnPlace)} FCFA par sujet mis en place)` : "- coût de l'animal prêt à produire : non évalué",
    x.seuilTechnique.seuilMoyen !== null ? `- seuil technique : ${n(x.seuilTechnique.seuilMoyen * 100)} % pour une production prévue de ${n(x.seuilTechnique.prevuMoyen * 100)} %` : "- seuil technique : non évalué",
    `- point bas de la trésorerie : ${n(x.pointBasTresorerie.montant)} FCFA au mois ${x.pointBasTresorerie.mois} ; argent à trouver : ${n(x.besoinFinancement)} FCFA ; apport ${x.apportSuffisant ? "suffisant" : "insuffisant"}`,
    `- renouvellement : ${x.renouvellement.autofinance ? "financé par l'atelier" : "non financé par l'atelier"} (fin ${n(x.renouvellement.autofinancement)} FCFA contre ${n(x.renouvellement.besoinRedemarrage)} FCFA pour redémarrer ; retrait possible ${n(x.renouvellement.retraitPossible)} FCFA)`,
    r.manques.length > 0 ? "À savoir ou à fournir :" : "",
    ...r.manques.map((m) => `- ${m}`),
    r.donneesNonValidees ? "ATTENTION : les courbes viennent de données de référence non encore validées par un expert ; dis-le à l'utilisateur." : "",
    CONSIGNES,
  ]
    .filter(Boolean)
    .join("\n");
}

export const simulerAtelierAnimalOutil = definirOutil({
  nom: "simuler_atelier_animal",
  description:
    "Simule un atelier animal à bandes (poules pondeuses, poulets) mois par mois avec les courbes par âge du référentiel : effectifs, aliment, production, coût d'une poule prête à pondre, seuil de ponte (production minimale qui couvre les charges), " +
    "besoin de financement, bandes décalées et autofinancement du renouvellement. Demande d'abord à l'utilisateur l'effectif, le prix du poussin, de l'aliment, de l'œuf et de la poule de réforme. " +
    "Si le référentiel n'a pas les courbes, le résultat dit « non évalué » : ne les devine pas. Tu expliques, tu ne calcules rien.",
  famille: "calcul",
  modules: ["cultisia", "cultiplan"],
  schema: schemaAtelierAnimal.extend({ speculation: z.string().min(2).max(60).describe("Nom ou code de la spéculation, par exemple 'poule pondeuse'") }),
  executer: async (args, contexte): Promise<ResultatOutil> => {
    const { donnees } = contexte;
    if (!donnees.lireVariantesElevage) return { contenu: "COURBES D'ÉLEVAGE NON DISPONIBLES : le référentiel des ateliers animaux n'est pas encore installé, la simulation est impossible. Dis-le à l'utilisateur." };
    try {
      const catalogue = await donnees.listerSpeculations();
      const trouvee = trouverSpeculation(catalogue, args.speculation);
      if (!trouvee) {
        return { contenu: `SPÉCULATION INCONNUE DU RÉFÉRENTIEL : ${args.speculation}. Spéculations disponibles : ${catalogue.map((s) => `${s.nom} (${s.code})`).join(" ; ")}. N'invente aucun chiffre.` };
      }
      const { speculation: _speculation, ...parametres } = args;
      void _speculation;
      const resultat = simulerAtelierAnimal({ speculation: trouvee.nom, variantes: await donnees.lireVariantesElevage(trouvee.code), parametres });
      return { contenu: formaterAtelierAnimal(resultat), sources: SOURCES };
    } catch (erreur) {
      if (erreur instanceof ErreurMoteur) return { contenu: `ENTRÉE REFUSÉE PAR LE MOTEUR : ${erreur.message}${erreur.details.length > 0 ? ` (${erreur.details.join(" ; ")})` : ""}. Demande l'information manquante à l'utilisateur.` };
      if (erreur instanceof ErreurReferentiel) return { contenu: `RÉFÉRENTIEL : ${erreur.message}` };
      console.error("[cultisia] simuler_atelier_animal en échec", erreur);
      return { contenu: ERREUR_ACCES };
    }
  },
});
