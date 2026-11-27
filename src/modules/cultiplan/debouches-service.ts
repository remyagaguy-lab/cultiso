// Débouchés d'une exploitation (R3) : lit les circuits du référentiel, laisse le service pur (debouches.ts) calculer, et sait donner le volume
// vendable à M13 (dimensionnement à rebours). Aucun calcul ici.
import { z } from "zod";
import { lireExploitation, type ClientBase } from "@/core/exploitation";
import { lireCircuits } from "@/referentiel/debouches";
import { analyserDebouches, debouchePourDimensionnement, schemaDebouches, type ResultatDebouches } from "./debouches";
import { dimensionnerExploitation } from "./dimensionnement-service";
import type { ResultatDimensionnement } from "./dimensionnement";
import { verifier } from "./lignes";

/** Corps : les débouchés, plus (facultatif) de quoi lancer le dimensionnement à rebours sur le volume vendu. */
export const schemaDemandeDebouches = schemaDebouches.extend({
  dimensionnement: z
    .object({
      /** Source du débouché pour M13 (étude de marché, contrat, enquête) : obligatoire. */
      source: z.string().trim().min(2, "la source du débouché est obligatoire"),
      origine: z.enum(["marche", "contrat", "promesse_achat", "enquete"]).optional(),
      /** Spéculation (code ou nom) et paramètres de M13, comme dans POST /dimensionnement, sans le champ `debouche`. */
      speculation: z.string().trim().min(2).max(60),
      parametres: z.record(z.string(), z.unknown()).default({}),
    })
    .optional(),
});
export type DemandeDebouches = z.input<typeof schemaDemandeDebouches>;

export interface ResultatDebouchesExploitation {
  exploitationId: string;
  debouches: ResultatDebouches;
  /** Prêt à poser dans le corps de POST /dimensionnement. */
  debouchePourDimensionnement: ReturnType<typeof debouchePourDimensionnement> | null;
  dimensionnement: ResultatDimensionnement | null;
}

export async function evaluerDebouches(client: ClientBase, exploitationId: string, corps: unknown): Promise<ResultatDebouchesExploitation> {
  const { dimensionnement, ...entree } = verifier(schemaDemandeDebouches, corps);
  await lireExploitation(client, exploitationId); // droits : l'exploitation doit être lisible par l'utilisateur
  const circuits = await lireCircuits(client);
  const debouches = analyserDebouches(entree, circuits);
  if (!dimensionnement) return { exploitationId, debouches, debouchePourDimensionnement: null, dimensionnement: null };
  const debouche = debouchePourDimensionnement(debouches, { moisVente: entree.moisVente, origine: dimensionnement.origine, source: dimensionnement.source });
  const resultat = await dimensionnerExploitation(client, exploitationId, { ...dimensionnement.parametres, speculation: dimensionnement.speculation, debouche });
  return { exploitationId, debouches, debouchePourDimensionnement: debouche, dimensionnement: resultat };
}
