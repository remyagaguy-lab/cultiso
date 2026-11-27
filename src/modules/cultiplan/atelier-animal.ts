// Atelier animal à bandes d'un porteur (M14) : prend les courbes par âge du référentiel (ref.courbes_age, avec source, date et statut)
// et les prix et effectifs donnés par l'appelant, et laisse le moteur (src/moteurs/bandes.ts) calculer. Service PUR.
// Rien n'est inventé : une courbe absente du référentiel, une durée de bande ou un nombre de jours par mois sans source rendent
// la simulation « non évaluée », avec la liste de ce qui manque. Le moteur ne prolonge jamais une courbe.
import { z } from "zod";
import { ErreurMoteur, schemaBandes, simulerBandes, type ResultatBandes } from "@/moteurs";
import type { VarianteElevage } from "@/referentiel/elevage";

const parametre = (regle: z.ZodNumber) => z.object({ valeur: regle, source: z.string().trim().min(2, "la source du paramètre est obligatoire") });

export const schemaAtelierAnimal = z.object({
  /** Variante de courbes à utiliser (une source, une conduite) ; absente : la seule variante complète, sinon le choix est demandé. */
  variante: z.string().min(1).optional(),
  bandes: schemaBandes.shape.bandes,
  prix: schemaBandes.shape.prix,
  chargesParSujetMois: schemaBandes.shape.chargesParSujetMois,
  chargesFixesMensuelles: schemaBandes.shape.chargesFixesMensuelles,
  investissement: schemaBandes.shape.investissement,
  apport: schemaBandes.shape.apport,
  /** Durée de la bande en mois (âge de réforme), si le référentiel ne la donne pas pour la variante ; l'emporte sinon. */
  dureeBandeMois: parametre(z.number().int().min(1).max(60)).optional(),
  /** Jours comptés par mois, si le référentiel ne les donne pas pour la variante. */
  joursParMois: parametre(z.number().positive().max(31)).optional(),
});
export type ParametresAtelierAnimal = z.input<typeof schemaAtelierAnimal>;

export interface ResultatAtelierAnimal {
  statut: "calculee" | "non_evaluee";
  variante: string | null;
  /** D'où viennent les courbes et les durées : documents, et statut le moins avancé. */
  origine: { sources: string[]; statut: string; dureeBandeMois: string | null; joursParMois: string | null; prix: string } | null;
  /** Ce qu'il faut fournir ou faire valider pour évaluer, une phrase par manque. */
  manques: string[];
  /** Variantes connues du référentiel pour la spéculation. */
  variantesConnues: string[];
  donneesNonValidees: boolean;
  resultat: ResultatBandes | null;
}

const complete = (v: VarianteElevage) => v.courbes.mortalite.length > 0 && v.courbes.consommation.length > 0 && v.courbes.production.length > 0;

export function simulerAtelierAnimal(entree: { speculation: string; variantes: VarianteElevage[]; parametres: ParametresAtelierAnimal }): ResultatAtelierAnimal {
  const p = schemaAtelierAnimal.safeParse(entree.parametres);
  if (!p.success) throw new ErreurMoteur("Entrée invalide pour l'atelier animal.", p.error.issues.map((i) => `${i.path.join(".") || "entrée"} : ${i.message}`));
  const e = p.data;
  const connues = entree.variantes.map((v) => v.variante);
  const vide = (manques: string[], variante: string | null = null): ResultatAtelierAnimal => ({ statut: "non_evaluee", variante, origine: null, manques, variantesConnues: connues, donneesNonValidees: false, resultat: null });

  if (entree.variantes.length === 0) {
    return vide([`Le référentiel n'a aucune courbe par âge ni durée de bande pour « ${entree.speculation} » : l'atelier n'est pas évalué. Les courbes (mortalité, aliment, production) sont à chercher auprès d'un technicien ou d'un expert, avec leur source.`]);
  }
  let v: VarianteElevage | undefined;
  if (e.variante !== undefined) {
    v = entree.variantes.find((x) => x.variante === e.variante);
    if (!v) throw new ErreurMoteur(`Variante inconnue : ${e.variante}. Variantes du référentiel : ${connues.join(", ")}.`);
  } else {
    const completes = entree.variantes.filter(complete);
    if (completes.length > 1) throw new ErreurMoteur(`Plusieurs variantes de courbes pour « ${entree.speculation} » : choisis-en une (${completes.map((x) => x.variante).join(", ")}).`);
    v = completes[0];
  }
  if (!v || !complete(v)) {
    const nom = v?.variante ?? null;
    const manquantes = (["mortalite", "consommation", "production"] as const).filter((g) => !v || v.courbes[g].length === 0).map((g) => ({ mortalite: "mortalité", consommation: "consommation d'aliment", production: "production" })[g]);
    return vide(
      [`Le référentiel n'a pas toutes les courbes par âge de « ${entree.speculation} »${nom ? ` (variante ${nom})` : ""} : il manque ${manquantes.join(", ")}. L'atelier n'est pas évalué ; aucune courbe n'est inventée. À chercher auprès d'un technicien ou d'un expert, avec leur source.`],
      nom,
    );
  }

  const manques: string[] = [];
  const duree = e.dureeBandeMois ?? (v.parametres.age_reforme_mois ?? v.parametres.duree_cycle_mois);
  const jours = e.joursParMois ?? v.parametres.jours_par_mois;
  if (!duree) manques.push("La durée de la bande en mois (âge de réforme), avec sa source : le référentiel ne la donne pas pour cette variante.");
  if (!jours) manques.push("Le nombre de jours comptés par mois, avec sa source : le référentiel ne le donne pas pour cette variante.");
  if (!duree || !jours) return vide(manques, v.variante);

  const resultat = simulerBandes({
    courbes: { mortalite: v.courbes.mortalite, consommation: v.courbes.consommation, production: v.courbes.production },
    joursParMois: jours.valeur,
    dureeBandeMois: duree.valeur,
    bandes: e.bandes,
    prix: e.prix,
    chargesParSujetMois: e.chargesParSujetMois,
    chargesFixesMensuelles: e.chargesFixesMensuelles,
    investissement: e.investissement,
    apport: e.apport,
  });
  const decrit = (x: { valeur: number; source: string }) => `${x.valeur} (${x.source})`;
  if (!(e.dureeBandeMois ?? v.parametres.age_reforme_mois)) manques.push("La durée de la bande vient de la durée du cycle du référentiel : à confirmer par un technicien.");
  if (resultat.seuilTechnique.seuilMoyen === null && e.prix.produit === 0) manques.push("Le prix du produit n'est pas donné : le seuil technique n'est pas évalué.");
  return {
    statut: "calculee",
    variante: v.variante,
    origine: {
      sources: v.sources,
      statut: v.statut,
      dureeBandeMois: decrit(duree),
      joursParMois: decrit(jours),
      prix: "Prix, effectifs et charges fournis par l'appelant : ils ne viennent pas du référentiel.",
    },
    manques,
    variantesConnues: connues,
    donneesNonValidees: v.statut !== "validee",
    resultat,
  };
}
