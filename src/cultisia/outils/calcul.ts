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
  expliquerControle,
  expliquerIndicateur,
  genererBudget,
  HORIZON_PAR_DEFAUT,
  TAUX_IMF_PAR_DEFAUT,
  VERSION_MOTEURS,
  type Controle,
  type HypotheseCle,
  type RegleFinanceur,
  type ResultatFinance,
} from "@/moteurs";
import { ErreurReferentiel, versRegleMoteur, type RegleFinanceurRef } from "@/referentiel";
import { normaliser, type AccesDonnees, type SpeculationRef } from "../donnees";
import type { Source } from "../evenements";
import { definirOutil, type ContexteOutil, type ResultatOutil } from "./registre";

const ERREUR_ACCES = "ERREUR D'ACCÈS AUX DONNÉES. Dis à l'utilisateur que le calcul est momentanément indisponible, n'invente aucun chiffre.";
const RAPPEL =
  "Restitue ces chiffres tels quels (ne les recalcule pas, ne les arrondis pas autrement) et cite le moteur comme source. " +
  "N'ajoute aucun autre chiffre de ton cru (pourcentage, ratio, total, comparaison chiffrée) : s'il en faut un, appelle un outil.";

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
/** VAN : null quand l'horizon est trop court (moins de deux années complètes). */
export const enVan = (van: number | null) => (van === null ? "non calculée (horizon de moins de deux ans)" : enFcfa(van));
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
  horizonAnnees: z.number().int().min(1).max(10).optional().describe(`Horizon en années (${HORIZON_PAR_DEFAUT} par défaut, 10 au plus)`),
  renouvellementEquipements: z
    .boolean()
    .optional()
    .describe("Vrai par défaut : les équipements sont rachetés à la fin de leur durée de vie si l'horizon le permet. Mets faux pour l'interdire (aucun rachat)."),
  apport: z.number().min(0).optional().describe("Apport personnel en FCFA"),
  credit: schemaCreditOutil.omit({ revenuMensuelNet: true }).optional().describe("Crédit envisagé, s'il y en a un"),
  coutVieAnnuel: z.number().min(0).optional().describe("Coût de vie annuel du ménage en FCFA (ce que la famille dépense par an), seulement si l'utilisateur l'a donné"),
  revenusExterieursAnnuels: z.number().min(0).optional().describe("Revenus annuels du ménage hors de ce projet, en FCFA, seulement si l'utilisateur les a donnés"),
  financeur: z
    .object({
      organisme: z.string().min(2).max(80).describe("Nom du financeur visé, par exemple 'ANPGF'"),
      produit: z.string().min(1).max(80).optional().describe("Code du produit de financement, si l'organisme en a plusieurs"),
    })
    .optional()
    .describe("Financeur visé : ses règles (apport minimum, durée, différé) sont lues dans le référentiel et contrôlées par le moteur"),
};

interface Simulation {
  /** Hypothèses par défaut appliquées au calcul, à dire à l'utilisateur (horizon, renouvellement des équipements). */
  hypotheses: string[];
  resultats: ResultatFinance;
  estimations: boolean;
  ateliersSansModele: string[];
}

async function simuler(
  donnees: AccesDonnees,
  ateliers: { id: string; speculationCode: string; taille: number }[],
  contexte: Record<string, string>,
  financement: {
    horizonAnnees?: number;
    renouvellementEquipements?: boolean;
    apport?: number;
    credit?: z.infer<typeof schemaCreditOutil>;
    coutVieAnnuel?: number;
    revenusExterieursAnnuels?: number;
    regleFinanceur?: RegleFinanceur;
  },
): Promise<Simulation> {
  const budget = genererBudget(await donnees.preparerBudget({ ateliers, contexte }));
  const renouvellement = financement.renouvellementEquipements !== false;
  const resultats = calculerFinances({
    // `renouvellement` n'est écrit que pour l'interdire : sinon la valeur par défaut du moteur s'applique (voir CONTRAT.md).
    charges: renouvellement ? budget.charges : budget.charges.map((c) => (c.classe === "investissement" ? { ...c, renouvellement: false } : c)),
    revenus: budget.revenus,
    horizonAnnees: financement.horizonAnnees ?? HORIZON_PAR_DEFAUT,
    apport: financement.apport,
    credit: financement.credit,
    regleFinanceur: financement.regleFinanceur,
    menage:
      financement.coutVieAnnuel === undefined
        ? undefined
        : { prelevementsAnnuels: financement.coutVieAnnuel, revenusExterieursAnnuels: financement.revenusExterieursAnnuels ?? 0 },
  });
  const lignes = [...budget.charges, ...budget.revenus];
  const horizon = financement.horizonAnnees ?? HORIZON_PAR_DEFAUT;
  const hypotheses = [
    `Hypothèses par défaut : horizon de ${horizon} ans (${financement.horizonAnnees === undefined ? `valeur par défaut de l'outil, ${HORIZON_PAR_DEFAUT} ans ; ` : ""}modifiable de 1 à 10 ans) ; ` +
      (renouvellement
        ? "équipements rachetés à la fin de leur durée de vie si l'horizon le permet (renouvellementEquipements = faux pour l'interdire)."
        : "équipements non renouvelés (choix demandé)."),
  ];
  return { hypotheses, resultats, estimations: lignes.some((l) => l.origine === "estimation"), ateliersSansModele: budget.ateliersSansModele };
}

function resumeScenarios(r: ResultatFinance): string[] {
  return (["pessimiste", "realiste", "optimiste"] as const).map((nom) => {
    const s = r.scenarios[nom];
    const an1 = s.annees[0];
    return (
      `- ${nom} : chiffre d'affaires an 1 ${enFcfa(an1.chiffreAffaires)}, résultat an 1 ${enFcfa(an1.resultat)}, ` +
      `VAN ${enVan(s.van)}, TRI ${enPourcent(s.tri)}, délai de récupération ${s.delaiRecuperationAns === null ? "au-delà de l'horizon" : `${s.delaiRecuperationAns} ans`}, ` +
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

/** Contrôles du scénario réaliste qui demandent attention (M4), avec la phrase du moteur. */
export function resumeControles(r: ResultatFinance): string[] {
  const aSignaler = r.scenarios.realiste.controles.filter((c) => c.niveau !== "ok");
  if (aSignaler.length === 0) return ["- contrôles du moteur (scénario réaliste) : rien à signaler"];
  return [
    "Contrôles du moteur (scénario réaliste), à expliquer simplement sans les recalculer :",
    ...aSignaler.map((c) => `- [${c.niveau}] ${c.code} : ${c.message}`),
  ];
}

type Financeur = { organisme: string; produit?: string };

/** Règle du financeur visé, lue dans le référentiel (R11). Sans financeur demandé : aucune règle, rien n'est contrôlé. */
async function reglesDuFinanceur(donnees: AccesDonnees, financeur?: Financeur): Promise<{ regle?: RegleFinanceurRef } | ResultatOutil> {
  if (!financeur) return {};
  const trouvees = await donnees.lireReglesFinanceurs(financeur);
  if (trouvees.length === 0) {
    const connus = (await donnees.lireReglesFinanceurs()).map((r) => `${r.organisme} (${r.produit})`);
    return {
      contenu:
        `FINANCEUR INCONNU DU RÉFÉRENTIEL : ${financeur.organisme}${financeur.produit ? ` / ${financeur.produit}` : ""}. Aucune règle ne peut être contrôlée pour lui. ` +
        `Financeurs connus : ${connus.length > 0 ? connus.join(" ; ") : "aucun"}. Dis-le à l'utilisateur, n'invente aucune règle.`,
    };
  }
  if (trouvees.length > 1) return { contenu: `PLUSIEURS PRODUITS POUR ${financeur.organisme} : ${trouvees.map((r) => r.produit).join(", ")}. Demande lequel vise l'utilisateur.` };
  return { regle: trouvees[0] };
}
const estRefus = (x: { regle?: RegleFinanceurRef } | ResultatOutil): x is ResultatOutil => "contenu" in x;

/** Ateliers et contexte d'un calcul : ceux de la demande, sinon ceux de l'exploitation active. */
export async function resoudreAteliers(
  args: { ateliers?: { speculation: string; taille: number }[]; contexte?: Record<string, string> },
  { donnees, exploitationId }: Pick<ContexteOutil, "donnees" | "exploitationId">,
  catalogue: SpeculationRef[],
): Promise<{ ateliers: { id: string; speculationCode: string; taille: number }[]; contexte: Record<string, string> } | ResultatOutil> {
  const contexte = args.contexte ?? {};
  if (args.ateliers) {
    const introuvables = args.ateliers.filter((a) => !trouverSpeculation(catalogue, a.speculation)).map((a) => a.speculation);
    if (introuvables.length > 0) return inconnues(introuvables, catalogue);
    return { ateliers: args.ateliers.map((a, i) => ({ id: `atelier_${i + 1}`, speculationCode: trouverSpeculation(catalogue, a.speculation)!.code, taille: a.taille })), contexte };
  }
  if (!exploitationId) return { contenu: "AUCUN ATELIER. Demande à l'utilisateur quelle spéculation et quelle taille, ou de choisir son exploitation." };
  const e = await donnees.lireAteliersEtContexte(exploitationId);
  if (!e) return { contenu: "EXPLOITATION INTROUVABLE ou inaccessible pour cet utilisateur." };
  if (e.ateliers.length === 0) return { contenu: "L'EXPLOITATION N'A AUCUN ATELIER. Demande à l'utilisateur quelle spéculation et quelle taille." };
  return { ateliers: e.ateliers, contexte: { ...e.contexte, ...contexte } };
}
export const estRefusAteliers = (x: object): x is ResultatOutil => "contenu" in x;

/** Valeurs du profil du porteur (R9) pour le calcul : coût de vie, revenus extérieurs, apport. Ce que la demande précise l'emporte. */
async function completerDepuisProfil<A extends { apport?: number; coutVieAnnuel?: number; revenusExterieursAnnuels?: number }>(
  args: A,
  { donnees, exploitationId }: Pick<ContexteOutil, "donnees" | "exploitationId">,
): Promise<{ args: A; origines: string[] }> {
  if (!exploitationId || !donnees.lireProfilPorteur) return { args, origines: [] };
  const p = await donnees.lireProfilPorteur(exploitationId);
  if (!p) return { args, origines: [] };
  const complete: A = {
    ...args,
    apport: args.apport ?? p.financement.apport,
    coutVieAnnuel: args.coutVieAnnuel ?? p.hypotheses.prelevementsAnnuels,
    revenusExterieursAnnuels: args.revenusExterieursAnnuels ?? p.hypotheses.revenusExterieursAnnuels,
  };
  const reprises = p.origines.filter((o) =>
    (args.apport === undefined && o.startsWith("Apport")) ||
    (args.coutVieAnnuel === undefined && o.startsWith("Prélèvements")) ||
    (args.revenusExterieursAnnuels === undefined && o.startsWith("Revenus extérieurs")),
  );
  return { args: complete, origines: reprises.map((o) => "Repris du profil du porteur : " + o) };
}

const schemaPlanOutil = z.object({
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
});

const LIBELLE_HYPOTHESE: Record<HypotheseCle, string> = {
  prix: "prix de vente",
  rendement: "rendement (quantités produites)",
  pertes: "pertes",
  intrants: "coût des intrants",
  mainOeuvre: "coût de la main d'oeuvre",
};
const enVariation = (v: number) => `${v > 0 ? "+" : "−"}${Math.round(Math.abs(v) * 1000) / 10} %`.replace(".", ",");
const AVERTISSEMENT_ESTIMATIONS = "ATTENTION : une partie des données sont des estimations non encore validées par un expert ; dis-le à l'utilisateur.";

/** Un contrôle : niveau, code, phrase du moteur, et explication simple tirée des textes du langage simple (S8). */
const ligneControle = (c: Controle): string => {
  const e = expliquerControle(c.code);
  return `- [${c.niveau}] ${c.code}${e ? ` (${e.nom})` : ""} : ${c.message}${e ? ` En clair : ${e.simple}` : ""}`;
};
const ligneIndicateur = (cle: string, valeur: string): string => {
  const e = expliquerIndicateur(cle);
  return `- ${e?.nom ?? cle} : ${valeur}${e ? ` (${e.simple})` : ""}`;
};
const rapportFinanceur = (regle?: RegleFinanceurRef): string =>
  regle
    ? `Règles de ${regle.organisme} (${regle.libelle}) lues dans le référentiel, statut ${regle.statut}${regle.statut === "validee" ? "" : " : à confirmer auprès du financeur"} ; source : ${regle.source ?? "non indiquée"}.`
    : "Aucun financeur visé : l'apport, la durée et le différé ne sont contrôlés contre aucune règle.";

export const diagnostiquerPlan = definirOutil({
  nom: "diagnostiquer_plan",
  description:
    "Donne le bilan de santé d'un plan agricole, déjà calculé par les moteurs de Cultiso : verdict, ratios, contrôles nommés (avec niveau et phrase) et alertes de prudence. " +
    "Les entrées sont les mêmes que calculer_plan ; indique `financeur` pour contrôler apport, durée et différé. Tu expliques ces résultats, tu ne recalcules rien.",
  famille: "calcul",
  modules: ["cultisia", "cultiplan"],
  schema: schemaPlanOutil,
  executer: (args, contexte) =>
    protege(async () => {
      const catalogue = await contexte.donnees.listerSpeculations();
      const lu = await resoudreAteliers(args, contexte, catalogue);
      if (estRefusAteliers(lu)) return lu;
      const fin = await reglesDuFinanceur(contexte.donnees, args.financeur);
      if (estRefus(fin)) return fin;

      const pf = await completerDepuisProfil(args, contexte);
      const sim = await simuler(contexte.donnees, lu.ateliers, lu.contexte, { ...pf.args, regleFinanceur: fin.regle ? versRegleMoteur(fin.regle) : undefined });
      const s = sim.resultats.scenarios.realiste;
      const v = s.verdict;
      const r = s.ratios;
      const parNiveau = (niveau: Controle["niveau"]) => s.controles.filter((c) => c.niveau === niveau);
      const alertes = s.controles.filter((c) => c.code.startsWith("ALERTE_"));
      const lignes = [
        `Bilan de santé du plan (scénario réaliste, horizon ${s.annees.length} ans), calculé par le moteur :`,
        ...sim.hypotheses,
        `- verdict : ${s.statut} ; rentabilité ${v.rentabilite} ; trésorerie toujours positive : ${v.tresorerieToujoursPositive ? "oui" : "non"} ; ` +
          `ménage couvert : ${v.menageCouvert === null ? "non évalué (coût de vie inconnu)" : v.menageCouvert ? "oui" : "non"}`,
        `- verdict en scénario pessimiste : ${sim.resultats.scenarios.pessimiste.statut} ; optimiste : ${sim.resultats.scenarios.optimiste.statut}`,
        "Ratios :",
        ligneIndicateur("coutProjet", enFcfa(r.coutProjet)),
        ligneIndicateur("partApport", enPourcent(r.partApport)),
        ligneIndicateur("endettement", r.endettement === null ? "non calculable" : `${r.endettement.toString().replace(".", ",")} franc emprunté pour 1 franc d'apport`),
        ligneIndicateur("dettesSurCaf", r.dettesSurCaf === null ? "non calculable" : `${r.dettesSurCaf.toString().replace(".", ",")} an(s) de capacité d'autofinancement`),
        ligneIndicateur("chargesFinancieresSurCA", enPourcent(r.chargesFinancieresSurCA)),
        rapportFinanceur(fin.regle),
        ...(["bloquant", "alerte", "info"] as const).flatMap((n) => (parNiveau(n).length > 0 ? [`Contrôles de niveau ${n} :`, ...parNiveau(n).map(ligneControle)] : [])),
        `Contrôles en règle : ${parNiveau("ok").map((c) => c.code).join(", ") || "aucun"}.`,
        alertes.length > 0 ? `Alertes de prudence déclenchées : ${alertes.map((a) => a.code).join(", ")}.` : "Aucune alerte de prudence déclenchée.",
        ...resumeMenage(sim.resultats),
        sim.estimations ? AVERTISSEMENT_ESTIMATIONS : "Données du référentiel validées.",
        sim.ateliersSansModele.length > 0 ? `Ateliers sans données de référence (non chiffrés) : ${sim.ateliersSansModele.join(", ")}.` : "",
        "Explique d'abord le verdict en une phrase, puis ce qui bloque (niveau bloquant), puis ce qu'il faut corriger. Utilise les phrases « En clair » avec les mots de l'utilisateur.",
        ...pf.origines,
        RAPPEL,
      ].filter(Boolean);
      return { contenu: lignes.join("\n"), sources: [sourceMoteur("financier"), { file_name: "Référentiel agricole Cultiso", origine: "referentiel" }] };
    }),
});

export const analyserSensibiliteOutil = definirOutil({
  nom: "analyser_sensibilite",
  description:
    "Dit ce qui fait basculer un plan agricole, avec la sensibilité calculée par le moteur de Cultiso : prix et rendement d'équilibre, effet de ±10 % et ±20 % de chaque hypothèse clé, " +
    "test du prix bas (le projet tient-il encore ?). Mêmes entrées que calculer_plan. Tu expliques, tu ne recalcules rien.",
  famille: "calcul",
  modules: ["cultisia", "cultiplan"],
  schema: schemaPlanOutil,
  executer: (args, contexte) =>
    protege(async () => {
      const catalogue = await contexte.donnees.listerSpeculations();
      const lu = await resoudreAteliers(args, contexte, catalogue);
      if (estRefusAteliers(lu)) return lu;
      const fin = await reglesDuFinanceur(contexte.donnees, args.financeur);
      if (estRefus(fin)) return fin;

      const pf = await completerDepuisProfil(args, contexte);
      const sim = await simuler(contexte.donnees, lu.ateliers, lu.contexte, { ...pf.args, regleFinanceur: fin.regle ? versRegleMoteur(fin.regle) : undefined });
      const sens = sim.resultats.sensibilite;
      const eq = sens.equilibre;
      const bas = sens.testPrixBas;
      const alerte = sim.resultats.scenarios.realiste.controles.find((c) => c.code === "ALERTE_EXPOSITION_PRIX");
      const origine = { parametre: "baisse demandée", scenario_pessimiste: "écart de prix du scénario pessimiste", grille: "plus forte baisse de la grille" }[bas.origine];
      const lignes = [
        "Ce qui fait basculer le plan (scénario réaliste), calculé par le moteur :",
        `- point de départ : résultat cumulé ${enFcfa(sens.base.resultatCumule)}, point bas de trésorerie ${enFcfa(sens.base.pointBasTresorerie)}, VAN ${enFcfa(sens.base.van)}`,
        eq.coefficient === null
          ? "- prix et rendement d'équilibre : non calculables (aucune vente)"
          : `- l'an ${eq.an} est le plus exigeant : le projet perd de l'argent si le prix ou la production tombe à ${enPourcent(eq.coefficient)} de ce qui est prévu`,
        ...eq.parLigne.map(
          (l) => `- ${l.libelle} : prix d'équilibre ${enFcfaPrix(l.prixEquilibre)} pour un prix prévu de ${enFcfaPrix(l.prixActuel)} ; quantité d'équilibre ${l.quantiteEquilibre} pour ${l.quantiteActuelle} prévues`,
        ),
        `Hypothèses de la plus influente à la moins influente sur le résultat : ${sens.classement.map((h) => LIBELLE_HYPOTHESE[h]).join(" > ")}.`,
        ...sens.classement.flatMap((h) => [
          `Si le ${LIBELLE_HYPOTHESE[h]} varie :`,
          ...sens.variations
            .filter((x) => x.hypothese === h)
            .map(
              (x) =>
                `  - ${enVariation(x.variation)} : résultat cumulé ${enFcfa(x.resultatCumule)} (écart ${enFcfa(x.ecartResultat)}), point bas ${enFcfa(x.pointBasTresorerie)}, VAN ${enFcfa(x.van)}`,
            ),
        ]),
        `Test du prix bas (baisse de ${enVariation(bas.baisse)}, ${origine}) : statut ${bas.statut}, résultat cumulé ${enFcfa(bas.resultatCumule)}, point bas de trésorerie ${enFcfa(bas.pointBasTresorerie)}, ` +
          `${bas.soldeResiduelMin === null ? "ménage non évalué" : `plus petit solde après famille et crédit ${enFcfa(bas.soldeResiduelMin)}`}.`,
        alerte ? `ALERTE DE PRUDENCE ${alerte.code} : ${alerte.message}` : "Le projet tient au prix bas testé : pas d'alerte sur l'exposition au prix.",
        expliquerIndicateur("testPrixBas")?.simple ? `En clair : ${expliquerIndicateur("testPrixBas")?.simple}` : "",
        rapportFinanceur(fin.regle),
        sim.estimations ? AVERTISSEMENT_ESTIMATIONS : "Données du référentiel validées.",
        sim.ateliersSansModele.length > 0 ? `Ateliers sans données de référence (non chiffrés) : ${sim.ateliersSansModele.join(", ")}.` : "",
        ...pf.origines,
        RAPPEL,
      ].filter(Boolean);
      return { contenu: lignes.join("\n"), sources: [sourceMoteur("de sensibilité"), { file_name: "Référentiel agricole Cultiso", origine: "referentiel" }] };
    }),
});

export const calculerPlan = definirOutil({
  nom: "calculer_plan",
  description:
    "Calcule un plan d'affaires agricole avec les moteurs de Cultiso (budget du référentiel, prix du marché, règles du terrain, " +
    "compte de résultat, VAN, TRI, trésorerie, trois scénarios, revenu du ménage et capacité de remboursement, seuil de commercialisation). Sans `ateliers`, calcule les ateliers de l'exploitation active. " +
    "Rien n'est enregistré : propose ensuite d'ouvrir Cultiplan pour enregistrer et ajuster le plan.",
  famille: "calcul",
  modules: ["cultisia", "cultiplan"],
  schema: schemaPlanOutil,
  executer: (args, contexte) =>
    protege(async () => {
      const catalogue = await contexte.donnees.listerSpeculations();
      const lu = await resoudreAteliers(args, contexte, catalogue);
      if (estRefusAteliers(lu)) return lu;
      const { ateliers } = lu;
      const fin = await reglesDuFinanceur(contexte.donnees, args.financeur);
      if (estRefus(fin)) return fin;

      const pf = await completerDepuisProfil(args, contexte);
      const sim = await simuler(contexte.donnees, ateliers, lu.contexte, { ...pf.args, regleFinanceur: fin.regle ? versRegleMoteur(fin.regle) : undefined });
      const r = sim.resultats;
      const noms = ateliers.map((a) => {
        const s = catalogue.find((c) => c.code === a.speculationCode);
        return `${s?.nom ?? a.speculationCode} : ${a.taille} ${s?.uniteEchelle ?? ""}`.trim();
      });
      const lignes = [
        `Plan calculé pour ${noms.join(" ; ")} (horizon ${r.scenarios.realiste.annees.length} ans) :`,
        ...sim.hypotheses,
        `- investissement total : ${enFcfa(r.investissementTotal)}`,
        `- besoin de financement (investissement + fonds de roulement − apport) : ${enFcfa(r.besoinFinancement)}`,
        ...resumeScenarios(r),
        ...resumeMenage(r),
        ...resumeControles(r),
        sim.estimations
          ? "ATTENTION : une partie des données sont des estimations non encore validées par un expert ; dis-le à l'utilisateur."
          : "Données du référentiel validées.",
        sim.ateliersSansModele.length > 0 ? `Ateliers sans données de référence (non chiffrés) : ${sim.ateliersSansModele.join(", ")}.` : "",
        ...pf.origines,
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
        const sim = await simuler(donnees, [{ id: s.code, speculationCode: s.code, taille }], args.contexte ?? {}, { horizonAnnees: args.horizonAnnees ?? HORIZON_PAR_DEFAUT });
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
            `VAN ${enVan(re.van)}, TRI ${enPourcent(re.tri)}, statut réaliste ${re.statut}, statut pessimiste ${pe.statut}`,
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

export const OUTILS_CALCUL = [calculerCreditOutil, calculerPlan, comparerFilieres, diagnostiquerPlan, analyserSensibiliteOutil];
