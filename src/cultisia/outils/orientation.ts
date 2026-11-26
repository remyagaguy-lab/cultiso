import { z } from "zod";
import { definirOutil } from "./registre";

/** Ancien `route_to_tool` : propose d'ouvrir un autre module de Cultiso. */
export const ouvrirModule = definirOutil({
  nom: "ouvrir_module",
  description:
    "Propose à l'utilisateur d'ouvrir un autre module de Cultiso quand son besoin y correspond. " +
    "cultiplan : concevoir et financer un projet (budget, plan d'affaires). " +
    "cultima : piloter une exploitation existante (opérations, trésorerie, suivi). " +
    "cultiseil : diagnostic technique de terrain (maladie, sol).",
  famille: "orientation",
  modules: ["cultisia", "cultiseil", "cours-des-prix"],
  schema: z.object({
    module: z.enum(["cultiplan", "cultima", "cultiseil"]).describe("Module à ouvrir"),
    raison: z.string().min(1).max(300).describe("Phrase courte adressée à l'utilisateur pour expliquer pourquoi"),
  }),
  messagePropose: (args) => args.raison,
});
