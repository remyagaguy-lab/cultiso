// Atelier animal à bandes (M14) : lit les courbes du référentiel avec les droits de l'utilisateur, puis laisse le service pur calculer.
import { z } from "zod";
import type { ClientBase } from "@/core/exploitation";
import { lireSpeculations } from "@/referentiel";
import { lireVariantesElevage } from "@/referentiel/elevage";
import { simulerTroupeau, schemaTroupeau, type ResultatTroupeau } from "@/moteurs";
import { ErreurPlan } from "./erreurs";
import { simulerAtelierAnimal, schemaAtelierAnimal, type ResultatAtelierAnimal } from "./atelier-animal";
import { verifier } from "./lignes";

/** Corps de la demande : la spéculation (code ou nom) et les paramètres de l'atelier. */
export const schemaDemandeAtelierAnimal = schemaAtelierAnimal.extend({ speculation: z.string().trim().min(2).max(60) });

const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, "_");

export async function simulerAtelierPourSpeculation(client: ClientBase, corps: unknown): Promise<ResultatAtelierAnimal> {
  const { speculation: terme, ...parametres } = verifier(schemaDemandeAtelierAnimal, corps);
  const catalogue = await lireSpeculations(client);
  const trouvee = catalogue.find((s) => s.code === normaliser(terme) || normaliser(s.nom) === normaliser(terme));
  if (!trouvee) throw new ErreurPlan(`Spéculation inconnue du référentiel : ${terme}. Disponibles : ${catalogue.map((s) => s.nom).join(", ")}.`, "invalide");
  return simulerAtelierAnimal({ speculation: trouvee.nom, variantes: await lireVariantesElevage(client, trouvee.code), parametres });
}

/** Cheptel en flux (ruminants) : le moteur tient les comptes des mouvements donnés, sans référentiel. */
export function suivreCheptel(corps: unknown): ResultatTroupeau {
  return simulerTroupeau(verifier(schemaTroupeau, corps));
}
