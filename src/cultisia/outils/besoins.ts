/**
 * Outil « confronter_existant » (R10, M13) : Cultisia compare ce que le porteur a (profil et existant) à ce que le référentiel
 * dit que la production demande. Les écarts, leurs feux et leurs phrases viennent du service Cultiplan (besoins.ts) ;
 * l'IA ne calcule rien et ne comble aucun trou : une donnée absente du référentiel ou du profil donne « non évalué ».
 */
import { z } from "zod";
import { confronterExistant, type EcartBesoin } from "@/modules/cultiplan/besoins";
import { genererBudget, ErreurMoteur } from "@/moteurs";
import { ErreurReferentiel } from "@/referentiel";
import type { Source } from "../evenements";
import { estRefusAteliers, resoudreAteliers } from "./calcul";
import { definirOutil, type ContexteOutil, type ResultatOutil } from "./registre";

const ERREUR_ACCES = "ERREUR D'ACCÈS AUX DONNÉES. Dis à l'utilisateur que la comparaison est momentanément indisponible, n'invente aucun chiffre.";
const SOURCES: Source[] = [{ file_name: "Référentiel agricole Cultiso (besoins types)", origine: "referentiel" }, { file_name: "Profil du porteur (R9)", origine: "exploitation" }];

const NOM_FEU: Record<EcartBesoin["feu"], string> = { vert: "VERT", orange: "ORANGE", rouge: "ROUGE", non_evalue: "NON ÉVALUÉ" };
const NOM_DIMENSION: Record<EcartBesoin["dimension"], string> = { terre: "Terre", eau: "Eau", travail: "Travail", argent: "Argent", materiel: "Matériel", rendement: "Rendement" };

export const lignesEcarts = (ecarts: EcartBesoin[]): string[] =>
  ecarts.map((e) => `- ${NOM_DIMENSION[e.dimension]} : ${NOM_FEU[e.feu]}. ${e.phrase}${e.besoin ? ` [besoin : ${e.besoin}]` : ""}${e.disponible ? ` [tu as : ${e.disponible}]` : ""}`);

const CONSIGNES =
  "Restitue ces phrases telles quelles, en langage simple. N'ajoute aucun chiffre ni aucune norme de ton cru. Un écart « non évalué » veut dire que la donnée manque : dis laquelle, ne devine pas. " +
  "Ces écarts ne sont pas un verdict financier : pour les chiffres du plan, appelle calculer_plan ou diagnostiquer_plan.";

/** Écarts pour les ateliers de l'exploitation active (ou ceux de la demande). Renvoie un texte de refus si la comparaison est impossible. */
export async function ecartsPourExploitation(
  args: { ateliers?: { speculation: string; taille: number }[]; contexte?: Record<string, string> },
  contexte: ContexteOutil,
): Promise<{ ecarts: EcartBesoin[]; estimations: boolean } | ResultatOutil> {
  const { donnees, exploitationId } = contexte;
  if (!exploitationId) return { contenu: "AUCUNE EXPLOITATION ACTIVE. Le profil du porteur est lié à une exploitation : demande à l'utilisateur de créer son projet ou de choisir son exploitation." };
  if (!donnees.lireProfil) return { contenu: "PROFIL NON DISPONIBLE : le profil du porteur n'est pas encore installé, la comparaison est impossible. Dis-le à l'utilisateur." };
  const catalogue = await donnees.listerSpeculations();
  const lu = await resoudreAteliers(args, contexte, catalogue);
  if (estRefusAteliers(lu)) return lu;
  const profil = await donnees.lireProfil(exploitationId);
  if (!profil) return { contenu: "EXPLOITATION INTROUVABLE ou inaccessible pour cet utilisateur." };
  const budget = genererBudget(await donnees.preparerBudget({ ateliers: lu.ateliers, contexte: lu.contexte }));
  const ecarts = confronterExistant({
    profil,
    ateliers: lu.ateliers.map((a) => ({ speculationCode: a.speculationCode, taille: a.taille })),
    speculations: catalogue.map((s) => ({ code: s.code, nom: s.nom, uniteEchelle: s.uniteEchelle })),
    charges: budget.charges,
    revenus: budget.revenus,
  });
  return { ecarts, estimations: [...budget.charges, ...budget.revenus].some((l) => l.origine === "estimation") };
}

export const confronterExistantOutil = definirOutil({
  nom: "confronter_existant",
  description:
    "Compare ce que le porteur a déjà (terre, eau, temps, argent, matériel, d'après son profil) à ce que le référentiel dit que sa production demande : un écart nommé par dimension, avec un feu et une phrase simple. " +
    "Dit « non évalué » quand le référentiel ou le porteur n'a pas donné la donnée. À utiliser après la consultation, pour répondre à « est-ce que j'ai de quoi me lancer ? ». Sans `ateliers`, utilise ceux de l'exploitation active. Tu expliques, tu ne calcules rien.",
  famille: "calcul",
  modules: ["cultisia", "cultiplan"],
  schema: z.object({
    ateliers: z
      .array(
        z.object({
          speculation: z.string().min(2).max(60).describe("Nom ou code de la spéculation, par exemple 'tomate' ou 'poulet de chair'"),
          taille: z.number().positive().describe("Taille dans l'unité d'échelle de la spéculation"),
        }),
      )
      .min(1)
      .max(5)
      .optional(),
    contexte: z.record(z.string(), z.string()).optional().describe("Réponses aux questions de terrain déjà connues (clé : valeur)"),
  }),
  executer: async (args, contexte): Promise<ResultatOutil> => {
    try {
      const r = await ecartsPourExploitation(args, contexte);
      if ("contenu" in r) return r;
      return {
        contenu: [
          "EXISTANT CONTRE BESOINS DU RÉFÉRENTIEL :",
          ...lignesEcarts(r.ecarts),
          r.estimations ? "ATTENTION : une partie des besoins viennent de données de référence non encore validées par un expert ; dis-le à l'utilisateur." : "",
          CONSIGNES,
        ]
          .filter(Boolean)
          .join("\n"),
        sources: SOURCES,
      };
    } catch (erreur) {
      if (erreur instanceof ErreurMoteur) return { contenu: `ENTRÉE REFUSÉE PAR LE MOTEUR : ${erreur.message}. Demande l'information manquante à l'utilisateur.` };
      if (erreur instanceof ErreurReferentiel) return { contenu: `RÉFÉRENTIEL : ${erreur.message}` };
      console.error("[cultisia] confronter_existant en échec", erreur);
      return { contenu: ERREUR_ACCES };
    }
  },
});
