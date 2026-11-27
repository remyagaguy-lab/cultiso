// Forme du financement détaillé d'un plan (M6) : la demande de la route /financement, et ce que le plan enregistre dans `plans.financement.detaille`.
// Fichier séparé du service pour que service.ts (qui enregistre) et financement.ts (qui calcule) puissent le lire sans import circulaire.
import { z } from "zod";
import { schemaCreditCampagne, schemaFinancementComplet } from "@/moteurs/financement";

/** Crédit de campagne tel que demandé : soit un plafond donné, soit une spéculation et une taille pour lire le barème de `ref`. */
export const schemaCampagneDemandee = schemaCreditCampagne.extend({
  baremeDe: z.object({ speculationCode: z.string().min(1), tailleAtelier: z.number().positive(), organisme: z.string().min(1).optional() }).optional(),
});

/** Corps de la demande : tout le financement sauf les emplois du démarrage et l'exploitation, qui viennent du plan. */
export const schemaDemandeFinancement = schemaFinancementComplet
  .omit({ emploisInitiaux: true, exploitation: true, creditsCampagne: true, horizonMois: true })
  .extend({ horizonMois: schemaFinancementComplet.shape.horizonMois.optional(), creditsCampagne: z.array(schemaCampagneDemandee).default([]) });
export type DemandeFinancement = z.input<typeof schemaDemandeFinancement>;
export type DemandeFinancementValidee = z.output<typeof schemaDemandeFinancement>;

/** Financement détaillé enregistré dans le plan : la demande, sans horizon (le plan fixe le sien). */
export const schemaFinancementDetaille = schemaDemandeFinancement.omit({ horizonMois: true });
export type FinancementDetaille = z.output<typeof schemaFinancementDetaille>;
