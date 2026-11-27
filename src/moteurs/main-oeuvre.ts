// Main d'oeuvre (R2) : capacité de travail de chaque membre, besoins en heures par mois, pointe de travail, norme de surface par actif,
// valorisation de la main d'oeuvre familiale au prix du marché dans le COÛT DE REVIENT (jamais dans la trésorerie : la famille n'est pas payée).
//
// Moteur autonome et pur. Les besoins en heures viennent du calendrier de travail (R1/M1) ou de la saisie ; les capacités, du profil du
// porteur (R9). Aucune valeur de référence n'est codée : la norme de surface par actif et le prix de l'heure arrivent en paramètres avec
// leur source ; absents, la dimension est « non évaluée » et le dit, au lieu d'être devinée.
// Mois 1 à 12 relatifs au démarrage ; une liste de 12 valeurs va du mois 1 au mois 12.
import { z } from "zod";
import { fcfa, somme, taux, valider, VERSION_MOTEURS } from "./commun";

const douzeMois = z.array(z.number().min(0)).length(12, "il faut 12 valeurs, une par mois");
const parametre = <T extends z.ZodType>(valeur: T) => z.object({ valeur, source: z.string().trim().min(2, "la source du paramètre est obligatoire"), statut: z.string().optional() });

export const schemaMembre = z.object({
  id: z.string().min(1),
  libelle: z.string().min(1),
  type: z.enum(["famille", "salarie", "saisonnier"]),
  /** Heures de travail que ce membre consacre à l'exploitation : un nombre par mois (le même 12 fois), ou 12 valeurs. */
  heuresParMois: z.union([z.number().min(0), douzeMois]),
  /** Part d'un actif à plein temps (1 = un actif, 0,5 = mi-temps ou un enfant). Sert seulement à la norme de surface par actif ; sans valeur, cette norme n'est pas évaluée. */
  equivalentActif: z.number().min(0).max(1).optional(),
});

export const schemaMainOeuvre = z.object({
  membres: z.array(schemaMembre).min(1, "au moins un membre"),
  /** Heures de travail nécessaires chaque mois (12 valeurs), toutes tâches confondues. */
  besoinsHeuresParMois: douzeMois,
  /** Détail facultatif par tâche, pour dire quelle tâche fait la pointe : la somme doit égaler les besoins. */
  taches: z.array(z.object({ libelle: z.string().min(1), heuresParMois: douzeMois })).default([]),
  surfaceHa: z.number().positive().optional(),
  /** Norme de surface qu'un actif peut conduire (hectares par actif), du référentiel. */
  normeSurface: parametre(z.number().positive()).optional(),
  /** Durée d'un jour de travail en heures : convertit les heures manquantes en jours de travail. */
  heuresParJour: parametre(z.number().positive().max(24)).optional(),
  /** Prix de l'heure de travail au marché (FCFA), pour valoriser le travail de la famille. */
  prixHeure: parametre(z.number().min(0)).optional(),
  /** Pour le coût de revient : charges décaissées de l'année et quantité vendue. */
  coutsDecaissesAn: z.number().min(0).optional(),
  quantiteVendueAn: z.number().positive().optional(),
});
export type EntreeMainOeuvre = z.input<typeof schemaMainOeuvre>;

export interface MoisMainOeuvre {
  mois: number;
  besoinHeures: number;
  capaciteFamilleHeures: number;
  capaciteSalarieeHeures: number;
  capaciteTotaleHeures: number;
  /** Heures de la famille réellement utilisées : le plus petit du besoin et de la capacité familiale (les salariés prennent le reste). */
  heuresFamilleUtilisees: number;
  heuresSalarieesUtilisees: number;
  /** Heures qu'aucun membre ne peut faire ce mois-ci : le besoin non couvert. */
  heuresManquantes: number;
  joursManquants: number | null;
  /** Taux d'occupation de la capacité totale (besoin / capacité) ; null si la capacité est nulle. */
  occupation: number | null;
}

export type CodeControleMainOeuvre = "PIC_DE_TRAVAIL" | "SURFACE_AU_DESSUS_NORME" | "NORME_NON_EVALUEE" | "PRIX_HEURE_NON_RENSEIGNE" | "TACHES_INCOHERENTES";

export interface ControleMainOeuvre {
  code: CodeControleMainOeuvre;
  niveau: "info" | "alerte" | "bloquant";
  valeurs: Record<string, number | string | number[] | null>;
  message: string;
}

export interface ResultatMainOeuvre {
  versionMoteur: string;
  mois: MoisMainOeuvre[];
  totaux: { besoinHeures: number; capaciteFamilleHeures: number; heuresFamilleUtilisees: number; heuresSalarieesUtilisees: number; heuresManquantes: number };
  /** Mois dont le besoin dépasse la capacité totale, du plus chargé au moins chargé. */
  pointes: { mois: number; heuresManquantes: number; joursManquants: number | null; tachePrincipale: string | null }[];
  moisLePlusCharge: { mois: number; besoinHeures: number };
  norme: {
    statut: "evalue" | "non_evalue";
    actifs: number | null;
    surfaceMaxHa: number | null;
    surfaceHa: number | null;
    /** Surface / surface maximale : au-dessus de 1, la famille ne peut pas conduire cette surface seule. */
    ratio: number | null;
    source: string | null;
  };
  /** Valorisation du travail familial au prix du marché. Elle va dans le coût de revient, jamais dans la trésorerie. */
  valorisationFamille: {
    statut: "evalue" | "non_evalue";
    heures: number;
    prixHeure: number | null;
    montantAn: number | null;
    source: string | null;
    /** Toujours 0 : la main d'oeuvre familiale n'est pas un décaissement. */
    impactTresorerie: 0;
  };
  coutRevient: {
    statut: "evalue" | "non_evalue";
    coutsDecaisses: number | null;
    mainOeuvreFamiliale: number | null;
    total: number | null;
    parUniteVendue: number | null;
    /** Coût de revient sans la valorisation familiale, pour voir ce que le travail de la famille pèse. */
    parUniteVendueSansFamille: number | null;
  };
  controles: ControleMainOeuvre[];
  lecture: string[];
}

export function calculerMainOeuvre(entree: EntreeMainOeuvre): ResultatMainOeuvre {
  const e = valider(schemaMainOeuvre, entree, "main d'oeuvre");
  const controles: ControleMainOeuvre[] = [];
  const lecture: string[] = [];
  const heures = (m: z.output<typeof schemaMembre>, i: number) => (typeof m.heuresParMois === "number" ? m.heuresParMois : m.heuresParMois[i]);
  const heuresParJour = e.heuresParJour?.valeur;

  if (e.taches.length > 0) {
    const ecarts = e.besoinsHeuresParMois.map((b, i) => Math.abs(b - somme(e.taches.map((t) => t.heuresParMois[i]))));
    if (ecarts.some((x) => x > 0.5)) {
      controles.push({
        code: "TACHES_INCOHERENTES",
        niveau: "alerte",
        valeurs: { mois: ecarts.map((x, i) => (x > 0.5 ? i + 1 : 0)).filter(Boolean) },
        message: "Les heures par tâche ne s'additionnent pas au besoin total de certains mois : vérifie le calendrier de travail.",
      });
    }
  }

  const mois: MoisMainOeuvre[] = e.besoinsHeuresParMois.map((besoin, i) => {
    const famille = somme(e.membres.filter((m) => m.type === "famille").map((m) => heures(m, i)));
    const salariee = somme(e.membres.filter((m) => m.type !== "famille").map((m) => heures(m, i)));
    const total = famille + salariee;
    const utiliseFamille = Math.min(besoin, famille);
    const utiliseSalarie = Math.min(Math.max(besoin - famille, 0), salariee);
    const manque = Math.max(besoin - total, 0);
    return {
      mois: i + 1,
      besoinHeures: besoin,
      capaciteFamilleHeures: famille,
      capaciteSalarieeHeures: salariee,
      capaciteTotaleHeures: total,
      heuresFamilleUtilisees: utiliseFamille,
      heuresSalarieesUtilisees: utiliseSalarie,
      heuresManquantes: manque,
      joursManquants: heuresParJour ? manque / heuresParJour : null,
      occupation: total > 0 ? taux(besoin / total) : null,
    };
  });

  const pointes = mois
    .filter((m) => m.heuresManquantes > 0)
    .sort((a, b) => b.heuresManquantes - a.heuresManquantes)
    .map((m) => {
      const tache = e.taches.length > 0 ? [...e.taches].sort((a, b) => b.heuresParMois[m.mois - 1] - a.heuresParMois[m.mois - 1])[0] : undefined;
      return {
        mois: m.mois,
        heuresManquantes: fcfa(m.heuresManquantes),
        joursManquants: m.joursManquants === null ? null : Math.round(m.joursManquants * 10) / 10,
        tachePrincipale: tache && tache.heuresParMois[m.mois - 1] > 0 ? tache.libelle : null,
      };
    });
  if (pointes.length > 0) {
    controles.push({
      code: "PIC_DE_TRAVAIL",
      niveau: "alerte",
      valeurs: { mois: pointes.map((p) => p.mois), heuresManquantes: pointes.map((p) => p.heuresManquantes) },
      message: `Pointe de travail : aux mois ${pointes.map((p) => p.mois).join(", ")}, il faut plus d'heures que tu n'en as (il manque ${pointes[0].heuresManquantes} heures le pire mois${pointes[0].tachePrincipale ? `, surtout pour « ${pointes[0].tachePrincipale} »` : ""}). Prévois de la main d'oeuvre en renfort ou étale les semis.`,
    });
  }
  const pire = mois.reduce((a, b) => (b.besoinHeures > a.besoinHeures ? b : a), mois[0]);

  // Norme de surface par actif
  const familiaux = e.membres.filter((m) => m.type === "famille");
  const equivalentsConnus = familiaux.length > 0 && familiaux.every((m) => m.equivalentActif !== undefined);
  let norme: ResultatMainOeuvre["norme"] = { statut: "non_evalue", actifs: null, surfaceMaxHa: null, surfaceHa: e.surfaceHa ?? null, ratio: null, source: null };
  if (e.normeSurface && e.surfaceHa !== undefined && equivalentsConnus) {
    const actifs = somme(familiaux.map((m) => m.equivalentActif ?? 0));
    const max = actifs * e.normeSurface.valeur;
    norme = { statut: "evalue", actifs, surfaceMaxHa: Math.round(max * 100) / 100, surfaceHa: e.surfaceHa, ratio: max > 0 ? taux(e.surfaceHa / max) : null, source: e.normeSurface.source };
    if (e.surfaceHa > max) {
      controles.push({
        code: "SURFACE_AU_DESSUS_NORME",
        niveau: "alerte",
        valeurs: { surfaceHa: e.surfaceHa, surfaceMaxHa: norme.surfaceMaxHa, actifs },
        message: `Avec ${actifs} actif(s) dans ta famille, la norme (${e.normeSurface.valeur} ha par actif, source : ${e.normeSurface.source}) permet environ ${norme.surfaceMaxHa} ha ; tu prévois ${e.surfaceHa} ha. Il faudra de la main d'oeuvre en plus ou une surface plus petite.`,
      });
    }
  } else {
    const raisons = [!e.normeSurface && "la norme de surface par actif", e.surfaceHa === undefined && "la surface", !equivalentsConnus && "la part d'actif de chaque membre de la famille"].filter(Boolean);
    controles.push({
      code: "NORME_NON_EVALUEE",
      niveau: "info",
      valeurs: { manque: raisons.join(", ") },
      message: `La surface par actif n'est pas évaluée : il manque ${raisons.join(", ")}.`,
    });
  }

  // Valorisation de la main d'oeuvre familiale : dans le coût de revient, pas dans la trésorerie
  const heuresFamille = somme(mois.map((m) => m.heuresFamilleUtilisees));
  const prix = e.prixHeure?.valeur ?? null;
  const montantFamille = prix === null ? null : heuresFamille * prix;
  if (prix === null) {
    controles.push({
      code: "PRIX_HEURE_NON_RENSEIGNE",
      niveau: "info",
      valeurs: {},
      message: "Le prix de l'heure de travail au marché n'est pas renseigné : le travail de ta famille n'est pas valorisé dans le coût de revient.",
    });
  }
  const evalCout = montantFamille !== null && e.coutsDecaissesAn !== undefined;
  const total = evalCout ? e.coutsDecaissesAn! + montantFamille! : null;
  const unite = (x: number | null) => (x !== null && e.quantiteVendueAn ? Math.round((x / e.quantiteVendueAn) * 100) / 100 : null);

  const totaux = {
    besoinHeures: fcfa(somme(mois.map((m) => m.besoinHeures))),
    capaciteFamilleHeures: fcfa(somme(mois.map((m) => m.capaciteFamilleHeures))),
    heuresFamilleUtilisees: fcfa(heuresFamille),
    heuresSalarieesUtilisees: fcfa(somme(mois.map((m) => m.heuresSalarieesUtilisees))),
    heuresManquantes: fcfa(somme(mois.map((m) => m.heuresManquantes))),
  };
  lecture.push(`Sur l'année, il faut ${totaux.besoinHeures} heures de travail ; ta famille en fournit ${totaux.heuresFamilleUtilisees}, le reste vient de salariés ou de saisonniers.`);
  lecture.push(pointes.length > 0 ? `Le mois le plus chargé est le mois ${pire.mois} (${fcfa(pire.besoinHeures)} heures) et ${pointes.length} mois dépassent ce que tu peux faire.` : `Le mois le plus chargé est le mois ${pire.mois} (${fcfa(pire.besoinHeures)} heures) : aucune pointe ne dépasse la capacité.`);
  if (montantFamille !== null) lecture.push(`Le travail de ta famille vaut ${fcfa(montantFamille)} FCFA au prix du marché : c'est un coût de revient, pas de l'argent qui sort de ta caisse.`);

  return {
    versionMoteur: VERSION_MOTEURS,
    mois: mois.map((m) => ({
      ...m,
      besoinHeures: fcfa(m.besoinHeures),
      capaciteFamilleHeures: fcfa(m.capaciteFamilleHeures),
      capaciteSalarieeHeures: fcfa(m.capaciteSalarieeHeures),
      capaciteTotaleHeures: fcfa(m.capaciteTotaleHeures),
      heuresFamilleUtilisees: fcfa(m.heuresFamilleUtilisees),
      heuresSalarieesUtilisees: fcfa(m.heuresSalarieesUtilisees),
      heuresManquantes: fcfa(m.heuresManquantes),
      joursManquants: m.joursManquants === null ? null : Math.round(m.joursManquants * 10) / 10,
    })),
    totaux,
    pointes,
    moisLePlusCharge: { mois: pire.mois, besoinHeures: fcfa(pire.besoinHeures) },
    norme,
    valorisationFamille: {
      statut: prix === null ? "non_evalue" : "evalue",
      heures: fcfa(heuresFamille),
      prixHeure: prix,
      montantAn: montantFamille === null ? null : fcfa(montantFamille),
      source: e.prixHeure?.source ?? null,
      impactTresorerie: 0,
    },
    coutRevient: {
      statut: evalCout ? "evalue" : "non_evalue",
      coutsDecaisses: e.coutsDecaissesAn ?? null,
      mainOeuvreFamiliale: montantFamille === null ? null : fcfa(montantFamille),
      total: total === null ? null : fcfa(total),
      parUniteVendue: unite(total),
      parUniteVendueSansFamille: unite(e.coutsDecaissesAn ?? null),
    },
    controles,
    lecture,
  };
}
