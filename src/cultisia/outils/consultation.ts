/**
 * Outils de la consultation de cadrage (S3) : Cultisia mène l'entretien en six temps, sans rien calculer.
 * - prochaine_question_consultation (lecture) : la prochaine question selon les réponses déjà données ;
 * - point_de_faisabilite (lecture) : un feu et une phrase par dimension, déjà établis par le service Cultiplan ;
 * - noter_reponses_consultation (action) : propose d'enregistrer les réponses ; l'utilisateur confirme dans l'interface.
 * Les questions et les phrases viennent du référentiel (ref.entretien_*). Aucun chiffre financier ici : ils viennent des moteurs.
 */
import { z } from "zod";
import type { PointDimension, ProchaineQuestion } from "@/modules/cultiplan/entretien";
import { manques, pointDeFaisabilite, prochaineQuestion } from "@/modules/cultiplan/entretien";
import { ErreurReferentiel } from "@/referentiel";
import type { Source } from "../evenements";
import { ecartsPourExploitation, lignesEcarts } from "./besoins";
import { definirOutil, type ContexteOutil, type ResultatOutil } from "./registre";

const ERREUR_ACCES = "ERREUR D'ACCÈS AUX DONNÉES. Dis à l'utilisateur que la consultation est momentanément indisponible, n'invente aucune réponse.";
const SANS_EXPLOITATION =
  "AUCUNE EXPLOITATION ACTIVE. La consultation s'enregistre dans le profil d'une exploitation : demande à l'utilisateur de créer son projet ou de choisir son exploitation, puis recommence.";
const INDISPONIBLE = "CONSULTATION NON DISPONIBLE : le référentiel de l'entretien n'est pas encore installé. Dis-le à l'utilisateur et pose toi-même des questions simples, sans rien enregistrer ni calculer.";

const CONSIGNES =
  "Consignes : pose UNE seule question à la fois, avec les mots du porteur, en le tutoyant et en langage simple. " +
  "« Je ne sais pas » est une réponse valable. N'invente jamais une réponse à la place du porteur. " +
  "Ne demande jamais combien il vendra, quel rendement il espère ni quelle quantité d'engrais ou d'intrants il mettra : ces chiffres viennent du référentiel et des moteurs. " +
  "Ne calcule rien (pas de total, pas de conversion mois en année, pas de pourcentage).";

const SOURCE: Source = { file_name: "Référentiel agricole Cultiso (entretien de cadrage)", origine: "referentiel" };

async function protege(travail: () => Promise<ResultatOutil>): Promise<ResultatOutil> {
  try {
    return await travail();
  } catch (erreur) {
    if (erreur instanceof ErreurReferentiel) return { contenu: `RÉFÉRENTIEL : ${erreur.message}` };
    console.error("[cultisia] outil de consultation en échec", erreur);
    return { contenu: ERREUR_ACCES };
  }
}

const schemaSecteurs = z
  .array(z.enum(["vegetal", "animal", "halieutique", "transformation", "services"]))
  .max(5)
  .optional()
  .describe("Secteurs de l'idée du porteur, déduits de ce qu'il a dit (végétal, animal, halieutique…), pour ne poser que les questions utiles. À défaut : ceux de ses ateliers.");

const schemaVue = z.object({
  secteurs: schemaSecteurs,
  reportees: z.array(z.string().min(1).max(80)).max(30).optional().describe("Clés des questions que le porteur veut laisser pour plus tard"),
});

async function lire(args: z.infer<typeof schemaVue>, contexte: ContexteOutil) {
  if (!contexte.exploitationId) return { refus: SANS_EXPLOITATION } as const;
  if (!contexte.donnees.lireConsultation) return { refus: INDISPONIBLE } as const;
  const lu = await contexte.donnees.lireConsultation(contexte.exploitationId, args);
  if (!lu) return { refus: "EXPLOITATION INTROUVABLE ou inaccessible pour cet utilisateur." } as const;
  return lu;
}

const typeDeReponse = (q: NonNullable<ProchaineQuestion["question"]>): string => {
  const choix = q.reponses.map((r) => `${r.valeur} = « ${r.libelle} »`).join(" ; ");
  switch (q.type) {
    case "choix":
      return `un seul choix parmi : ${choix}`;
    case "choix_multiple":
      return `un ou plusieurs choix parmi : ${choix}`;
    case "nombre":
      return `un nombre${q.unite ? ` (${q.unite})` : ""}`;
    case "montant":
      return `un montant${q.unite ? ` (${q.unite})` : " en FCFA"}`;
    case "oui_non":
      return "oui ou non";
    case "texte":
      return "quelques mots (200 caractères au plus)";
    case "liste":
      return q.remplit.cible === "credits"
        ? "une liste de crédits (creancier, capitalRestantFcfa, mensualiteFcfa, moisRestants) ; une liste vide si le porteur n'en a aucun"
        : "une liste de choses possédées (categorie parmi materiel, batiment, animaux, plants ; libelle, quantite, etat parmi neuf, bon, moyen, mauvais ; annee ; valeurEstimeeFcfa donnée par le porteur) ; une liste vide s'il n'a rien";
  }
};

export const prochaineQuestionConsultation = definirOutil({
  nom: "prochaine_question_consultation",
  description:
    "Mène la consultation de cadrage d'un porteur de projet (idée et personne, existant, ménage, marché, contraintes et risques, retour) : donne la prochaine question à poser, selon ce qu'il a déjà répondu, " +
    "avec le type de réponse attendu et l'avancement. À utiliser au début d'un projet ou quand le porteur ne sait pas par où commencer. Tu poses la question, tu ne calcules rien.",
  famille: "lecture",
  modules: ["cultisia", "cultiplan"],
  schema: schemaVue,
  executer: (args, contexte) =>
    protege(async () => {
      const lu = await lire(args, contexte);
      if ("refus" in lu) return { contenu: lu.refus };
      const { entretien, etat } = lu;
      const p = prochaineQuestion(entretien, etat);
      const total = entretien.temps.length;
      const avancement = p.avancement.map((a) => `- ${a.titre} : ${a.traitees} sur ${a.total}`).join("\n");
      if (p.fini || !p.question || !p.temps) {
        const reste = manques(entretien, etat);
        return {
          contenu: [
            `CONSULTATION : il n'y a plus de question à poser pour l'instant (temps ${total} sur ${total}, ${p.temps?.titre ?? "le point avec toi"}).`,
            reste.length > 0 ? `Encore à compléter ou à éclaircir : ${reste.map((m) => m.question.court).join(" ; ")}.` : "Tout a été répondu.",
            "Appelle point_de_faisabilite pour faire le point avec le porteur : ce qui est solide, ce qui inquiète, ce qu'il reste à éclaircir.",
            `Avancement :\n${avancement}`,
            CONSIGNES,
          ].join("\n"),
          sources: [SOURCE],
        };
      }
      const rang = entretien.temps.findIndex((t) => t.cle === p.temps?.cle) + 1;
      const q = p.question;
      return {
        contenu: [
          `CONSULTATION DE CADRAGE, temps ${rang} sur ${total} : ${p.temps.titre}.`,
          p.introTemps ? `Introduction du temps, à dire avec tes mots : ${p.introTemps}` : "",
          `Question à poser (clé ${q.cle}) : ${q.libelle}`,
          q.aide ? `Aide à donner si besoin : ${q.aide}` : "",
          `Réponse attendue : ${typeDeReponse(q)}.`,
          `Le porteur peut répondre « je ne sais pas » : c'est valable, il sera noté comme à éclaircir. Dans ce cas, la réponse s'enregistre avec neSaitPas.`,
          `Avancement :\n${avancement}`,
          "Quand tu as recueilli les réponses d'un temps, propose de les enregistrer avec noter_reponses_consultation (le porteur confirme).",
          entretien.aValider ? "Les questions de cet entretien sont des brouillons en cours de relecture par un expert." : "",
          CONSIGNES,
        ]
          .filter(Boolean)
          .join("\n"),
        sources: [SOURCE],
      };
    }),
});

/** Existant contre besoins du référentiel (R10, M13), seulement quand le projet a des ateliers ; jamais bloquant pour le point de faisabilité. */
async function sectionBesoins(contexte: ContexteOutil): Promise<string[]> {
  try {
    const r = await ecartsPourExploitation({}, contexte);
    if ("contenu" in r) return [];
    return ["Existant contre besoins du référentiel (non évalué = donnée manquante, rien n'est deviné) :", ...lignesEcarts(r.ecarts)];
  } catch (erreur) {
    console.error("[cultisia] existant contre besoins indisponible", erreur);
    return [];
  }
}

const NOM_FEU: Record<PointDimension["feu"], string> = { vert: "VERT", orange: "ORANGE", rouge: "ROUGE", gris: "GRIS (on n'en sait pas assez)" };

export const pointDeFaisabiliteOutil = definirOutil({
  nom: "point_de_faisabilite",
  description:
    "Fait le point de faisabilité d'un projet avec le porteur, à partir de ce qu'il a répondu à la consultation : un feu (vert, orange, rouge ou gris) et une phrase pour chacune des sept dimensions " +
    "(terre, eau, travail, argent, marché, savoir-faire, règles), plus ce qui manque encore. C'est le temps du retour au porteur. Aucun calcul financier : pour les chiffres, appelle calculer_plan ou diagnostiquer_plan.",
  famille: "lecture",
  modules: ["cultisia", "cultiplan"],
  schema: schemaVue,
  executer: (args, contexte) =>
    protege(async () => {
      const lu = await lire(args, contexte);
      if ("refus" in lu) return { contenu: lu.refus };
      const { entretien, etat } = lu;
      const point = pointDeFaisabilite(entretien, etat);
      const besoins = await sectionBesoins(contexte);
      const lignes = point.dimensions.flatMap((d) => [
        `- ${d.libelle} : ${NOM_FEU[d.feu]}. ${d.phrase}`,
        ...d.points.filter((x) => x.phrase !== d.phrase).map((x) => `    · [${x.feu}] ${x.phrase}`),
      ]);
      return {
        contenu: [
          `POINT DE FAISABILITÉ (feu d'ensemble : ${NOM_FEU[point.feuGlobal]} ; questions essentielles traitées : ${point.essentielles.traitees} sur ${point.essentielles.total}) :`,
          ...lignes,
          ...besoins,
          point.aValider ? "ATTENTION : ces règles de lecture (feux et seuils de prudence) sont des brouillons non encore relus par un expert ; dis-le au porteur." : "",
          "Fais le retour au porteur en quatre parties courtes : 1) ce que tu as compris de son projet, 2) ce qui est solide (vert), 3) ce qui inquiète (rouge et orange, avec la phrase telle quelle), 4) ce qu'il reste à éclaircir (gris et « je ne sais pas »).",
          "Un feu n'est pas un verdict financier : propose ensuite de calculer le plan pour les chiffres. Ne cite aucun chiffre qui ne soit pas dans ce point.",
          CONSIGNES,
        ]
          .filter(Boolean)
          .join("\n"),
        sources: [SOURCE],
      };
    }),
});

export const noterReponsesConsultation = definirOutil({
  nom: "noter_reponses_consultation",
  description:
    "Propose d'enregistrer dans le profil du porteur les réponses qu'il vient de donner à la consultation (une ou plusieurs). N'enregistre rien : le porteur vérifie puis confirme. " +
    "Donne la clé de la question et sa valeur telle que dite par le porteur, ou neSaitPas quand il ne sait pas. N'invente aucune valeur et ne calcule rien.",
  famille: "action",
  modules: ["cultisia", "cultiplan"],
  schema: z.object({
    reponses: z
      .array(
        z
          .object({
            question: z.string().min(1).max(80).describe("Clé de la question, telle que donnée par prochaine_question_consultation"),
            valeur: z.unknown().optional().describe("Réponse du porteur, au format attendu par la question"),
            neSaitPas: z.literal(true).optional().describe("À mettre quand le porteur répond « je ne sais pas »"),
          })
          .refine((r) => (r.neSaitPas === true) !== (r.valeur !== undefined), { message: "donner valeur, ou bien neSaitPas" }),
      )
      .min(1)
      .max(30),
  }),
  preparer: (args) => ({ reponses: args.reponses }),
  messagePropose: (args) =>
    `J'ai préparé ${args.reponses.length} réponse${args.reponses.length > 1 ? "s" : ""} à noter dans ton profil. Vérifie-les puis confirme pour les enregistrer.`,
});

export const OUTILS_CONSULTATION = [prochaineQuestionConsultation, pointDeFaisabiliteOutil, noterReponsesConsultation];
