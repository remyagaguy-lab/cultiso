/**
 * Outils de calcul (couche 3) : Cultisia remplit les entrées, les moteurs de src/moteurs/ calculent.
 * L'IA ne produit aucun chiffre : elle reçoit ici des résultats déjà calculés, à restituer tels quels.
 * Rien n'est enregistré : enregistrer un plan passe par Cultiplan (l'utilisateur confirme).
 */
import { z } from "zod";
import {
  calculerCredit,
  calculerFinances,
  ErreurMoteur,
  genererBudget,
  HORIZON_PAR_DEFAUT,
  TAUX_IMF_PAR_DEFAUT,
  VERSION_MOTEURS,
  type ResultatFinance,
} from "@/moteurs";
import { ErreurReferentiel } from "@/referentiel";
import { normaliser, type AccesDonnees, type SpeculationRef } from "../donnees";
import type { Source } from "../evenements";
import { definirOutil, type ResultatOutil } from "./registre";

const ERREUR_ACCES = "ERREUR D'ACCÈS AUX DONNÉES. Dis à l'utilisateur que le calcul est momentanément indisponible, n'invente aucun chiffre.";
const RAPPEL =
  "Restitue ces chiffres tels quels (ne les recalcule pas, ne les arrondis pas autrement) et cite le moteur comme source. " +
  "N'ajoute aucun autre chiffre de ton cru (pourcentage, ratio, total, comparaison chiffrée) : s'il en faut un, appelle un outil.";

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
/** Mise en forme d'un montant déjà calculé par un moteur (aucun calcul ici). */
export const enFcfa = (montant: number) => `${nombre.format(montant).replace(/\s/g, " ")} FCFA`;
const nombrePrix = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
/** Mise en forme d'un prix unitaire déjà calculé (centimes gardés : un kg se vend parfois moins de 100 FCFA). */
export const enFcfaPrix = (prix: number) => `${nombrePrix.format(prix).replace(/\s/g, " ")} FCFA`;
export const enPourcent = (tauxDecimal: number | null) =>
  tauxDecimal === null ? "non calculable" : `${(tauxDecimal * 100).toFixed(1).replace(".", ",")} %`;

const sourceMoteur = (nom: string): Source => ({ file_name: `Moteur ${nom} Cultiso (version ${VERSION_MOTEURS})`, origine: "moteur" });

async function protege(calcul: () => Promise<ResultatOutil>): Promise<ResultatOutil> {
  try {
    return await calcul();
  } catch (erreur) {
    if (erreur instanceof ErreurMoteur) {
      return { contenu: `ENTRÉE REFUSÉE PAR LE MOTEUR : ${erreur.message} ${erreur.details.join(" ; ")}. Corrige l'entrée ou demande l'information manquante à l'utilisateur.` };
    }
    if (erreur instanceof ErreurReferentiel) return { contenu: `RÉFÉRENTIEL : ${erreur.message}` };
    console.error("[cultisia] outil de calcul en échec", erreur);
    return { contenu: ERREUR_ACCES };
  }
}

const schemaCreditOutil = z.object({
  montant: z.number().positive().describe("Montant emprunté en FCFA"),
  tauxAnnuel: z.number().min(0).max(1).describe(`Taux annuel en décimal : 0.24 pour 24 %. À défaut, ${TAUX_IMF_PAR_DEFAUT} (microfinance au Togo)`),
  dureeMois: z.number().int().min(1).max(360).describe("Durée totale en mois, différé compris"),
  differeMois: z.number().int().min(0).optional().describe("Mois de différé au début"),
  typeDiffere: z.enum(["partiel", "total"]).optional().describe("partiel : on paie les intérêts pendant le différé ; total : ils s'ajoutent au capital"),
  revenuMensuelNet: z.number().positive().optional().describe("Revenu mensuel net de l'emprunteur, pour le taux d'endettement"),
});

export const calculerCreditOutil = definirOutil({
  nom: "calculer_credit",
  description:
    "Calcule un crédit avec le moteur de Cultiso : mensualité, coût total, total remboursé, taux d'endettement, premières échéances. " +
    "À utiliser dès qu'on parle d'emprunt, de prêt ou de mensualité. Ne calcule jamais toi-même.",
  famille: "calcul",
  modules: "tous",
  schema: schemaCreditOutil,
  executer: (args) =>
    protege(async () => {
      const r = calculerCredit(args);
      const lignes = [
        `Crédit de ${enFcfa(args.montant)} à ${enPourcent(args.tauxAnnuel)} par an sur ${args.dureeMois} mois` +
          (args.differeMois ? `, dont ${args.differeMois} mois de différé ${args.typeDiffere ?? "partiel"}` : "") + " :",
        `- mensualité : ${enFcfa(r.mensualite)}`,
        `- total remboursé : ${enFcfa(r.totalRembourse)}`,
        `- coût du crédit (intérêts) : ${enFcfa(r.coutTotal)}`,
        `- taux d'endettement : ${r.tauxEndettement === null ? "non calculé (revenu mensuel inconnu)" : enPourcent(r.tauxEndettement)}`,
        "Premières échéances :",
        ...r.echeancier.slice(0, 3).map((e) => `- mois ${e.mois} : échéance ${enFcfa(e.echeance)} (intérêts ${enFcfa(e.interets)}, capital ${enFcfa(e.amortissement)})`),
        RAPPEL,
      ];
      return { contenu: lignes.join("\n"), sources: [sourceMoteur("de crédit")] };
    }),
});

/** Retrouve une spéculation par son code ou son nom (sans accents ni majuscules). */
export function trouverSpeculation(catalogue: SpeculationRef[], terme: string): SpeculationRef | undefined {
  const t = normaliser(terme).replace(/\s+/g, "_");
  const exact = catalogue.find((s) => s.code === t || normaliser(s.nom).replace(/\s+/g, "_") === t);
  if (exact) return exact;
  const mot = normaliser(terme);
  return catalogue.find((s) => normaliser(s.nom).includes(mot) || mot.includes(normaliser(s.nom)));
}

const inconnues = (termes: string[], catalogue: SpeculationRef[]): ResultatOutil => ({
  contenu:
    `SPÉCULATION INCONNUE DU RÉFÉRENTIEL : ${termes.join(", ")}. Aucun chiffre ne peut être calculé pour elle. ` +
    `Spéculations disponibles : ${catalogue.map((s) => `${s.nom} (${s.code}, par ${s.uniteEchelle})`).join(" ; ")}.`,
});

const schemaFinancementOutil = {
  horizonAnnees: z.number().int().min(1).max(5).optional().describe(`Horizon en années (${HORIZON_PAR_DEFAUT} par défaut, 5 au plus)`),
  apport: z.number().min(0).optional().describe("Apport personnel en FCFA"),
  credit: schemaCreditOutil.omit({ revenuMensuelNet: true }).optional().describe("Crédit envisagé, s'il y en a un"),
  coutVieAnnuel: z.number().min(0).optional().describe("Coût de vie annuel du ménage en FCFA (ce que la famille dépense par an), seulement si l'utilisateur l'a donné"),
  revenusExterieursAnnuels: z.number().min(0).optional().describe("Revenus annuels du ménage hors de ce projet, en FCFA, seulement si l'utilisateur les a donnés"),
};

interface Simulation {
  resultats: ResultatFinance;
  estimations: boolean;
  ateliersSansModele: string[];
}

async function simuler(
  donnees: AccesDonnees,
  ateliers: { id: string; speculationCode: string; taille: number }[],
  contexte: Record<string, string>,
  financement: { horizonAnnees?: number; apport?: number; credit?: z.infer<typeof schemaCreditOutil>; coutVieAnnuel?: number; revenusExterieursAnnuels?: number },
): Promise<Simulation> {
  const budget = genererBudget(await donnees.preparerBudget({ ateliers, contexte }));
  const resultats = calculerFinances({
    charges: budget.charges,
    revenus: budget.revenus,
    horizonAnnees: financement.horizonAnnees,
    apport: financement.apport,
    credit: financement.credit,
    menage:
      financement.coutVieAnnuel === undefined
        ? undefined
        : { prelevementsAnnuels: financement.coutVieAnnuel, revenusExterieursAnnuels: financement.revenusExterieursAnnuels ?? 0 },
  });
  const lignes = [...budget.charges, ...budget.revenus];
  return { resultats, estimations: lignes.some((l) => l.origine === "estimation"), ateliersSansModele: budget.ateliersSansModele };
}

function resumeScenarios(r: ResultatFinance): string[] {
  return (["pessimiste", "realiste", "optimiste"] as const).map((nom) => {
    const s = r.scenarios[nom];
    const an1 = s.annees[0];
    return (
      `- ${nom} : chiffre d'affaires an 1 ${enFcfa(an1.chiffreAffaires)}, résultat an 1 ${enFcfa(an1.resultat)}, ` +
      `VAN ${enFcfa(s.van)}, TRI ${enPourcent(s.tri)}, délai de récupération ${s.delaiRecuperationAns === null ? "au-delà de l'horizon" : `${s.delaiRecuperationAns} ans`}, ` +
      `besoin en fonds de roulement ${enFcfa(s.besoinFondsRoulement)}, statut ${s.statut}`
    );
  });
}

/** Revenu du ménage, trésorerie et seuil de commercialisation du scénario réaliste (M3), tels que calculés par le moteur. */
export function resumeMenage(r: ResultatFinance): string[] {
  const s = r.scenarios.realiste;
  const sc = s.seuilCommercialisation;
  const lignes = [
    `- point bas de trésorerie (an 1, scénario réaliste) : ${enFcfa(s.pointBasTresorerie.montant)} au mois ${s.pointBasTresorerie.mois}` +
      (s.moisTresorerieNegative.length > 0 ? ` ; trésorerie négative aux mois ${s.moisTresorerieNegative.join(", ")}` : " ; trésorerie jamais négative"),
  ];
  if (s.verdict.menageCouvert === null) {
    lignes.push("- revenu du ménage : non évalué (coût de vie du ménage inconnu ; demande-le si la question porte sur le revenu ou le remboursement)");
  } else {
    lignes.push(
      ...s.annees.map(
        (a) =>
          `- an ${a.an} : capacité de remboursement ${enFcfa(a.capaciteRemboursement)}, annuités ${enFcfa(a.annuites)}, solde résiduel ${enFcfa(a.soldeResiduel)}, CAF disponible ${enFcfa(a.cafDisponible)}`,
      ),
      `- ménage couvert chaque année : ${s.verdict.menageCouvert ? "oui" : "non"}`,
    );
  }
  lignes.push(
    ...sc.parLigne.map(
      (l) => `- seuil de commercialisation (an ${sc.an}) de ${l.libelle} : ${enFcfaPrix(l.prixSeuil)} par unité vendue, pour un prix prévu de ${enFcfaPrix(l.prixActuel)}`,
    ),
  );
  return lignes;
}

export const calculerPlan = definirOutil({
  nom: "calculer_plan",
  description:
    "Calcule un plan d'affaires agricole avec les moteurs de Cultiso (budget du référentiel, prix du marché, règles du terrain, " +
    "compte de résultat, VAN, TRI, trésorerie, trois scénarios, revenu du ménage et capacité de remboursement, seuil de commercialisation). Sans `ateliers`, calcule les ateliers de l'exploitation active. " +
    "Rien n'est enregistré : propose ensuite d'ouvrir Cultiplan pour enregistrer et ajuster le plan.",
  famille: "calcul",
  modules: ["cultisia", "cultiplan"],
  schema: z.object({
    ateliers: z
      .array(
        z.object({
          speculation: z.string().min(2).max(60).describe("Nom ou code de la spéculation, par exemple 'tomate' ou 'poulet de chair'"),
          taille: z.number().positive().describe("Taille dans l'unité d'échelle de la spéculation (ha, têtes, étangs, fournées)"),
        }),
      )
      .min(1)
      .max(5)
      .optional(),
    contexte: z.record(z.string(), z.string()).optional().describe("Réponses aux questions de terrain déjà connues (clé : valeur)"),
    ...schemaFinancementOutil,
  }),
  executer: (args, { donnees, exploitationId }) =>
    protege(async () => {
      let ateliers: { id: string; speculationCode: string; taille: number }[];
      let contexte = args.contexte ?? {};
      const catalogue = await donnees.listerSpeculations();
      if (args.ateliers) {
        const introuvables = args.ateliers.filter((a) => !trouverSpeculation(catalogue, a.speculation)).map((a) => a.speculation);
        if (introuvables.length > 0) return inconnues(introuvables, catalogue);
        ateliers = args.ateliers.map((a, i) => ({ id: `atelier_${i + 1}`, speculationCode: trouverSpeculation(catalogue, a.speculation)!.code, taille: a.taille }));
      } else {
        if (!exploitationId) return { contenu: "AUCUN ATELIER. Demande à l'utilisateur quelle spéculation et quelle taille, ou de choisir son exploitation." };
        const e = await donnees.lireAteliersEtContexte(exploitationId);
        if (!e) return { contenu: "EXPLOITATION INTROUVABLE ou inaccessible pour cet utilisateur." };
        if (e.ateliers.length === 0) return { contenu: "L'EXPLOITATION N'A AUCUN ATELIER. Demande à l'utilisateur quelle spéculation et quelle taille." };
        ateliers = e.ateliers;
        contexte = { ...e.contexte, ...contexte };
      }

      const sim = await simuler(donnees, ateliers, contexte, args);
      const r = sim.resultats;
      const noms = ateliers.map((a) => {
        const s = catalogue.find((c) => c.code === a.speculationCode);
        return `${s?.nom ?? a.speculationCode} : ${a.taille} ${s?.uniteEchelle ?? ""}`.trim();
      });
      const lignes = [
        `Plan calculé pour ${noms.join(" ; ")} (horizon ${r.scenarios.realiste.annees.length} ans) :`,
        `- investissement total : ${enFcfa(r.investissementTotal)}`,
        `- besoin de financement (investissement + fonds de roulement − apport) : ${enFcfa(r.besoinFinancement)}`,
        ...resumeScenarios(r),
        ...resumeMenage(r),
        sim.estimations
          ? "ATTENTION : une partie des données sont des estimations non encore validées par un expert ; dis-le à l'utilisateur."
          : "Données du référentiel validées.",
        sim.ateliersSansModele.length > 0 ? `Ateliers sans données de référence (non chiffrés) : ${sim.ateliersSansModele.join(", ")}.` : "",
        RAPPEL,
      ].filter(Boolean);
      return {
        contenu: lignes.join("\n"),
        sources: [sourceMoteur("financier"), { file_name: "Référentiel agricole Cultiso", origine: "referentiel" }],
      };
    }),
});

export const comparerFilieres = definirOutil({
  nom: "comparer_filieres",
  description:
    "Compare 2 à 5 spéculations avec les moteurs de Cultiso, chacune à sa taille (1 unité d'échelle par défaut) : " +
    "investissement, chiffre d'affaires, résultat, VAN, TRI et statut en scénario réaliste et pessimiste.",
  famille: "calcul",
  modules: ["cultisia", "cultiplan"],
  schema: z.object({
    speculations: z
      .array(
        z.object({
          speculation: z.string().min(2).max(60).describe("Nom ou code de la spéculation"),
          taille: z.number().positive().optional().describe("Taille dans l'unité d'échelle (1 par défaut)"),
        }),
      )
      .min(2)
      .max(5),
    contexte: z.record(z.string(), z.string()).optional().describe("Réponses aux questions de terrain déjà connues"),
    horizonAnnees: schemaFinancementOutil.horizonAnnees,
  }),
  executer: (args, { donnees }) =>
    protege(async () => {
      const catalogue = await donnees.listerSpeculations();
      const introuvables = args.speculations.filter((s) => !trouverSpeculation(catalogue, s.speculation)).map((s) => s.speculation);
      if (introuvables.length > 0) return inconnues(introuvables, catalogue);

      const lignes: string[] = [];
      let estimations = false;
      for (const demande of args.speculations) {
        const s = trouverSpeculation(catalogue, demande.speculation)!;
        const taille = demande.taille ?? 1;
        const sim = await simuler(donnees, [{ id: s.code, speculationCode: s.code, taille }], args.contexte ?? {}, { horizonAnnees: args.horizonAnnees });
        estimations ||= sim.estimations;
        if (sim.ateliersSansModele.length > 0) {
          lignes.push(`- ${s.nom} (${taille} ${s.uniteEchelle}) : aucune donnée de référence, non chiffré`);
          continue;
        }
        const re = sim.resultats.scenarios.realiste;
        const pe = sim.resultats.scenarios.pessimiste;
        lignes.push(
          `- ${s.nom} (${taille} ${s.uniteEchelle}) : investissement ${enFcfa(sim.resultats.investissementTotal)}, ` +
            `chiffre d'affaires an 1 ${enFcfa(re.annees[0].chiffreAffaires)}, résultat an 1 ${enFcfa(re.annees[0].resultat)}, ` +
            `VAN ${enFcfa(re.van)}, TRI ${enPourcent(re.tri)}, statut réaliste ${re.statut}, statut pessimiste ${pe.statut}`,
        );
      }
      return {
        contenu: [
          "Comparaison calculée (scénario réaliste sauf mention) :",
          ...lignes,
          estimations ? "ATTENTION : données en partie estimées, non encore validées par un expert ; dis-le à l'utilisateur." : "",
          "Les tailles diffèrent d'une spéculation à l'autre : compare aussi l'investissement, pas seulement le résultat.",
          RAPPEL,
        ]
          .filter(Boolean)
          .join("\n"),
        sources: [sourceMoteur("financier"), { file_name: "Référentiel agricole Cultiso", origine: "referentiel" }],
      };
    }),
});

export const OUTILS_CALCUL = [calculerCreditOutil, calculerPlan, comparerFilieres];
