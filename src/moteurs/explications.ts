// Langage simple (S8) : pour chaque indicateur et chaque contrôle, une phrase sans jargon et une version technique dépliable,
// plus un lexique pour l'export. Les textes sont dans donnees/explications.json (lisible et corrigeable sans toucher au code) ;
// ce fichier les lit, les valide et les distribue. Aucun calcul ici.
import { z } from "zod";
import donnees from "./donnees/explications.json";
import { CODES_CONTROLE, type CodeControle, type Controle } from "./controles";

const schemaFiche = z.object({ cle: z.string().min(1), nom: z.string().min(2), simple: z.string().min(10), technique: z.string().min(10) });
const schemaDonnees = z.object({
  version: z.string(),
  indicateurs: z.array(schemaFiche),
  controles: z.array(schemaFiche),
  lexique: z.array(z.object({ terme: z.string().min(2), definition: z.string().min(10) })),
});

export type Explication = z.infer<typeof schemaFiche>;
export interface EntreeLexique {
  terme: string;
  definition: string;
}

const lues = schemaDonnees.parse(donnees);
const parCle = (fiches: Explication[]) => new Map(fiches.map((f) => [f.cle, f]));
const indicateurs = parCle(lues.indicateurs);
const controles = parCle(lues.controles);

/** Version du fichier de textes. */
export const VERSION_EXPLICATIONS = lues.version;

/** Explication d'un indicateur (clé : capaciteRemboursement, pointBasTresorerie, seuilCommercialisation...). undefined si inconnu. */
export const expliquerIndicateur = (cle: string): Explication | undefined => indicateurs.get(cle);

/** Explication d'un contrôle ou d'une alerte, par son code. */
export const expliquerControle = (code: CodeControle | string): Explication | undefined => controles.get(code);

export const clesIndicateurs = (): string[] => [...indicateurs.keys()];

/** Contrôle accompagné de son explication simple et technique (pour l'affichage dépliable). */
export interface ControleExplique extends Controle {
  nom: string;
  simple: string;
  technique: string;
}

export function expliquerControles(liste: Controle[]): ControleExplique[] {
  return liste.map((c) => {
    const f = controles.get(c.code);
    return { ...c, nom: f?.nom ?? c.code, simple: f?.simple ?? c.message, technique: f?.technique ?? "" };
  });
}

/** Codes de contrôle sans explication (doit rester vide : vérifié par les tests). */
export const controlesSansExplication = (): CodeControle[] => CODES_CONTROLE.filter((c) => !controles.has(c));

/** Lexique par ordre alphabétique, pour l'annexe de l'export. */
export function lexique(): EntreeLexique[] {
  return [...lues.lexique].sort((a, b) => a.terme.localeCompare(b.terme, "fr"));
}

/** Lexique en Markdown, prêt à coller en annexe d'un dossier ou d'une version porteur. */
export function lexiqueEnMarkdown(): string {
  return ["# Lexique", "", ...lexique().map((e) => `- **${e.terme}** : ${e.definition}`), ""].join("\n");
}
