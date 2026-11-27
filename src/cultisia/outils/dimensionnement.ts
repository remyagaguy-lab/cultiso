/**
 * Outil « dimensionner_a_rebours » (M13) : à partir du débouché (volume vendable par mois), Cultisia obtient du service Cultiplan trois
 * tailles de projet (avec ce que le porteur a, pour couvrir son coût de vie, ce que le marché absorbe), plafonnées par son existant.
 * L'IA ne calcule rien : elle restitue les tailles, leurs chiffres et leurs origines, et dit ce qui reste non évalué.
 */
import { z } from "zod";
import { dimensionnerARebours, schemaParametresDimensionnement, type Chiffre, type ResultatDimensionnement, type TailleProposee } from "@/modules/cultiplan/dimensionnement";
import { ErreurMoteur } from "@/moteurs";
import { ErreurReferentiel } from "@/referentiel";
import type { Source } from "../evenements";
import { trouverSpeculation } from "./calcul";
import { definirOutil, type ResultatOutil } from "./registre";

const ERREUR_ACCES = "ERREUR D'ACCÈS AUX DONNÉES. Dis à l'utilisateur que le dimensionnement est momentanément indisponible, n'invente aucun chiffre.";
const SOURCES: Source[] = [
  { file_name: "Référentiel agricole Cultiso (modèles de charges et de revenus)", origine: "referentiel" },
  { file_name: "Profil du porteur (R9)", origine: "exploitation" },
];
const CONSIGNES =
  "Restitue ces tailles et ces phrases telles quelles, en langage simple et en tutoyant. N'ajoute aucun chiffre ni aucune norme de ton cru : " +
  "un paramètre « manquant » veut dire que la donnée n'a pas de source, demande-la à l'utilisateur ou dis qu'elle est à chercher auprès d'un technicien, ne la devine pas. " +
  "Le porteur choisit la taille : ne choisis pas à sa place.";

const NOM_PLAFOND = { terre: "Terre", travail: "Travail", argent: "Argent", eau: "Eau" } as const;
const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const n = (v: number) => nombre.format(v).replace(/\s/g, " ");
const chiffre = (c: Chiffre) => (c.valeur === null ? `non évalué (${c.origine})` : `${n(c.valeur)} ${c.unite} [origine : ${c.origine}]`);

function lignesTaille(t: TailleProposee): string[] {
  const entete = `- ${t.titre} : ${t.taille === null ? (t.statut === "impossible" ? "IMPOSSIBLE" : "NON ÉVALUÉE") : `${n(t.taille)} ${t.uniteEchelle}`}. ${t.phrase}`;
  if (!t.detail) return [entete];
  const d = t.detail;
  return [
    entete,
    `    volume vendu par an : ${chiffre(d.volumeVendableAn)}`,
    `    production nécessaire : ${chiffre(d.productionNecessaireAn)}`,
    `    surface à prévoir : ${chiffre(d.surfaceAPrevoirHa)}`,
    `    intrants : ${chiffre(d.intrantsAn)} ; travail : ${chiffre(d.joursTravailAn)} ; investissement : ${chiffre(d.investissement)}`,
    `    marge d'exploitation : ${chiffre(d.margeExploitationAn)}`,
    d.depasseLeDebouche ? "    ATTENTION : cette taille produit plus que ce que le débouché absorbe." : "",
    d.plafondsDepasses.length > 0 ? `    ATTENTION : cette taille dépasse ce que tu as en : ${d.plafondsDepasses.map((x) => NOM_PLAFOND[x]).join(", ")}.` : "",
    ...d.ecarts.map((e) => `    existant, ${e.dimension} : ${e.feu === "non_evalue" ? "non évalué" : e.feu}. ${e.phrase}`),
    `    projet à cette taille : statut ${d.finances.statut}${d.finances.menageCouvert === null ? ", ménage non évalué" : d.finances.menageCouvert ? ", ménage couvert" : ", ménage NON couvert"}${d.finances.soldeResiduelMinimum === null ? "" : `, solde résiduel minimum ${n(d.finances.soldeResiduelMinimum)} FCFA`}`,
    ...d.finances.controles.map((c) => `    contrôle [${c.niveau}] ${c.code} : ${c.message}`),
  ].filter(Boolean);
}

export function formaterDimensionnement(r: ResultatDimensionnement): string {
  return [
    `DIMENSIONNEMENT À REBOURS (${r.speculation}, scénario ${r.scenario}) :`,
    `- débouché : ${chiffre(r.debouche)}`,
    `- rendement vendable : ${chiffre(r.rendementVendable)}`,
    "Ce que ton existant permet :",
    ...r.plafonds.map((p) => `- ${NOM_PLAFOND[p.dimension]} : ${p.statut === "non_evalue" ? "NON ÉVALUÉ" : p.statut === "non_limitant" ? "ne limite pas" : `jusqu'à ${n(p.tailleMax as number)} ${r.uniteEchelle}`}. ${p.phrase}`),
    "Trois tailles possibles :",
    ...r.tailles.flatMap(lignesTaille),
    r.manques.length > 0 ? "Paramètres manquants (à fournir avec leur source, sinon la dimension reste non évaluée) :" : "",
    ...r.manques.map((m) => `- ${m}`),
    r.donneesNonValidees ? "ATTENTION : une partie des chiffres vient de données de référence non encore validées par un expert ; dis-le à l'utilisateur." : "",
    CONSIGNES,
  ]
    .filter(Boolean)
    .join("\n");
}

export const dimensionnerARebourOutil = definirOutil({
  nom: "dimensionner_a_rebours",
  description:
    "Dimensionne un projet à rebours : à partir du volume que le marché ou un contrat absorbe par mois, calcule la production nécessaire, la surface ou le cheptel, les intrants et le travail, et propose trois tailles " +
    "(ce que le porteur peut faire avec ce qu'il a, ce qui couvre son coût de vie, ce que le marché absorbe), plafonnées par son profil. Demande d'abord au porteur à qui il vend et combien, avec la source. " +
    "Les paramètres sans source (pertes après récolte, déclassement, coefficient de rendement, surface utile, durée d'un jour de travail, besoin en eau) ne se devinent pas : laisse-les vides, ils sont signalés comme manquants. Tu expliques, tu ne calcules rien.",
  famille: "calcul",
  modules: ["cultisia", "cultiplan"],
  schema: schemaParametresDimensionnement.extend({ speculation: z.string().min(2).max(60).describe("Nom ou code de la spéculation, par exemple 'tomate'") }),
  executer: async (args, contexte): Promise<ResultatOutil> => {
    const { donnees, exploitationId } = contexte;
    if (!exploitationId) return { contenu: "AUCUNE EXPLOITATION ACTIVE. Le profil du porteur est lié à une exploitation : demande à l'utilisateur de créer son projet ou de choisir son exploitation." };
    if (!donnees.lireProfil) return { contenu: "PROFIL NON DISPONIBLE : le profil du porteur n'est pas encore installé, le dimensionnement est impossible. Dis-le à l'utilisateur." };
    try {
      const catalogue = await donnees.listerSpeculations();
      const trouvee = trouverSpeculation(catalogue, args.speculation);
      if (!trouvee) {
        return { contenu: `SPÉCULATION INCONNUE DU RÉFÉRENTIEL : ${args.speculation}. Spéculations disponibles : ${catalogue.map((s) => `${s.nom} (${s.code}, par ${s.uniteEchelle})`).join(" ; ")}. N'invente aucun chiffre.` };
      }
      const profil = await donnees.lireProfil(exploitationId);
      const lu = await donnees.lireAteliersEtContexte(exploitationId);
      if (!profil || !lu) return { contenu: "EXPLOITATION INTROUVABLE ou inaccessible pour cet utilisateur." };
      const { speculation: _speculation, ...parametres } = args;
      void _speculation;
      const { ateliers, ...budget } = await donnees.preparerBudget({ ateliers: [{ id: "m13", speculationCode: trouvee.code, taille: 1 }], contexte: lu.contexte });
      const resultat = dimensionnerARebours({
        profil,
        speculation: { code: trouvee.code, nom: trouvee.nom, uniteEchelle: trouvee.uniteEchelle },
        budget,
        cyclesParAnReferentiel: ateliers[0]?.cyclesParAn,
        parametres,
      });
      return { contenu: formaterDimensionnement(resultat), sources: SOURCES };
    } catch (erreur) {
      if (erreur instanceof ErreurMoteur) return { contenu: `ENTRÉE REFUSÉE PAR LE MOTEUR : ${erreur.message}${erreur.details.length > 0 ? ` (${erreur.details.join(" ; ")})` : ""}. Demande l'information manquante à l'utilisateur.` };
      if (erreur instanceof ErreurReferentiel) return { contenu: `RÉFÉRENTIEL : ${erreur.message}` };
      console.error("[cultisia] dimensionner_a_rebours en échec", erreur);
      return { contenu: ERREUR_ACCES };
    }
  },
});
