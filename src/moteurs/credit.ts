// Moteur de crédit : mensualité à annuités constantes, différé, échéancier, coût total, taux d'endettement.
// Repris d'Agripilot mobile (M5), recodé et étendu au différé.
import { z } from "zod";
import { fcfa, somme, taux, valider, VERSION_MOTEURS } from "./commun";

/** Taux par défaut d'une institution de microfinance au Togo (fourchette observée de 10 à 36 %). */
export const TAUX_IMF_PAR_DEFAUT = 0.24;

export const schemaCredit = z
  .object({
    montant: z.number().positive("le montant doit être positif"),
    tauxAnnuel: z.number().min(0, "le taux ne peut pas être négatif").max(1, "taux annuel au-delà de 100 %"),
    dureeMois: z.number().int().min(1, "au moins 1 mois").max(360, "au plus 360 mois"),
    differeMois: z.number().int().min(0).default(0),
    /** partiel : on paie les intérêts pendant le différé ; total : ils s'ajoutent au capital. */
    typeDiffere: z.enum(["partiel", "total"]).default("partiel"),
    /** Revenu mensuel net de l'emprunteur, pour le taux d'endettement. */
    revenuMensuelNet: z.number().positive().optional(),
  })
  .refine((c) => c.differeMois < c.dureeMois, {
    message: "le différé doit être plus court que la durée du crédit",
    path: ["differeMois"],
  });

export type EntreeCredit = z.input<typeof schemaCredit>;

export interface EcheanceCredit {
  mois: number;
  capitalRestantDebut: number;
  interets: number;
  amortissement: number;
  echeance: number;
}

export interface ResultatCredit {
  versionMoteur: string;
  /** Échéance constante après le différé. */
  mensualite: number;
  totalRembourse: number;
  /** Intérêts payés au total (total remboursé moins montant emprunté). */
  coutTotal: number;
  /** Mensualité rapportée au revenu mensuel net ; null sans revenu. */
  tauxEndettement: number | null;
  echeancier: EcheanceCredit[];
}

/** Échéancier en décimal, sans arrondi (utilisé aussi par le moteur financier). */
export function echeancierBrut(entree: EntreeCredit): { mensualite: number; echeancier: EcheanceCredit[] } {
  const c = valider(schemaCredit, entree, "crédit");
  const i = c.tauxAnnuel / 12;
  const echeancier: EcheanceCredit[] = [];
  let capital = c.montant;

  for (let mois = 1; mois <= c.differeMois; mois++) {
    const interets = capital * i;
    if (c.typeDiffere === "partiel") {
      echeancier.push({ mois, capitalRestantDebut: capital, interets, amortissement: 0, echeance: interets });
    } else {
      // Différé total : rien n'est payé, les intérêts s'ajoutent au capital (amortissement négatif).
      echeancier.push({ mois, capitalRestantDebut: capital, interets, amortissement: -interets, echeance: 0 });
      capital += interets;
    }
  }

  const n = c.dureeMois - c.differeMois;
  const mensualite = i === 0 ? capital / n : (capital * i) / (1 - Math.pow(1 + i, -n));
  for (let k = 1; k <= n; k++) {
    const interets = capital * i;
    // La dernière échéance solde exactement le capital restant.
    const amortissement = k === n ? capital : mensualite - interets;
    echeancier.push({
      mois: c.differeMois + k,
      capitalRestantDebut: capital,
      interets,
      amortissement,
      echeance: amortissement + interets,
    });
    capital -= amortissement;
  }
  return { mensualite, echeancier };
}

export function calculerCredit(entree: EntreeCredit): ResultatCredit {
  const c = valider(schemaCredit, entree, "crédit");
  const { mensualite, echeancier } = echeancierBrut(c);
  const totalRembourse = somme(echeancier.map((e) => e.echeance));
  return {
    versionMoteur: VERSION_MOTEURS,
    mensualite: fcfa(mensualite),
    totalRembourse: fcfa(totalRembourse),
    coutTotal: fcfa(totalRembourse - c.montant),
    tauxEndettement: c.revenuMensuelNet ? taux(mensualite / c.revenuMensuelNet) : null,
    echeancier: echeancier.map((e) => ({
      mois: e.mois,
      capitalRestantDebut: fcfa(e.capitalRestantDebut),
      interets: fcfa(e.interets),
      amortissement: fcfa(e.amortissement),
      echeance: fcfa(e.echeance),
    })),
  };
}
