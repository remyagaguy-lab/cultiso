// Dimensionnement à rebours d'une exploitation (M13) : lit le référentiel, le profil du porteur et le contexte terrain avec les droits
// de l'utilisateur, puis laisse le service pur (dimensionnement.ts) calculer. Aucun calcul ici.
import { z } from "zod";
import { lireExploitation, type ClientBase } from "@/core/exploitation";
import { lireSpeculations } from "@/referentiel";
import { ErreurPlan } from "./erreurs";
import { verifier } from "./lignes";
import { dimensionnerARebours, schemaParametresDimensionnement, type ResultatDimensionnement } from "./dimensionnement";
import { lireProfil } from "./profil";
import { preparerEntreeBudget } from "./service";

/** Corps de la demande : la spéculation (code ou nom) et les paramètres du dimensionnement. */
export const schemaDemandeDimensionnement = schemaParametresDimensionnement.extend({ speculation: z.string().trim().min(2).max(60) });
export type DemandeDimensionnement = z.input<typeof schemaDemandeDimensionnement>;

const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "_");

export async function dimensionnerExploitation(client: ClientBase, exploitationId: string, corps: unknown): Promise<ResultatDimensionnement> {
  const { speculation: terme, ...parametres } = verifier(schemaDemandeDimensionnement, corps);
  const exploitation = await lireExploitation(client, exploitationId);
  const catalogue = await lireSpeculations(client);
  const trouvee = catalogue.find((s) => s.code === normaliser(terme) || normaliser(s.nom) === normaliser(terme));
  if (!trouvee) {
    throw new ErreurPlan(`Spéculation inconnue du référentiel : ${terme}. Disponibles : ${catalogue.map((s) => s.nom).join(", ")}.`, "invalide");
  }
  const { ateliers: _ateliers, ...budget } = await preparerEntreeBudget(client, {
    ateliers: [{ id: "m13", speculationCode: trouvee.code, taille: 1 }],
    contexte: exploitation.contexte,
  });
  void _ateliers;
  const profil = await lireProfil(client, exploitationId, { tolerant: true });
  return dimensionnerARebours({
    profil,
    speculation: { code: trouvee.code, nom: trouvee.nom, uniteEchelle: trouvee.uniteEchelle },
    budget,
    cyclesParAnReferentiel: trouvee.cyclesParAn,
    parametres,
  });
}
