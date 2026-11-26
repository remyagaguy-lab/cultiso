/**
 * Registre des outils de Cultisia.
 *
 * Chaque outil déclare un schéma zod, une famille et les modules où il est permis.
 * - lecture     : exécuté côté serveur, renvoie des données et leurs sources
 * - calcul      : exécuté côté serveur par un moteur (couche 3, chantier Cultiplan)
 * - action      : JAMAIS exécuté côté serveur ; devient un événement `action_proposee`
 * - orientation : JAMAIS exécuté côté serveur ; devient un événement `orientation`
 */
import { z } from "zod";
import type { Source } from "../evenements";
import type { OutilModele } from "../llm/client";
import type { Module } from "../modules";
import type { AccesDonnees } from "../donnees";

export type FamilleOutil = "lecture" | "calcul" | "action" | "orientation";

export interface ContexteOutil {
  module: Module;
  utilisateurId: string;
  exploitationId?: string;
  donnees: AccesDonnees;
}

export interface ResultatOutil {
  /** Texte renvoyé au modèle (données brutes, jamais de consigne). */
  contenu: string;
  sources?: Source[];
}

export interface DefinitionOutil<S extends z.ZodType = z.ZodType> {
  nom: string;
  description: string;
  famille: FamilleOutil;
  modules: readonly Module[] | "tous";
  schema: S;
  /** Obligatoire pour `lecture` et `calcul`, absent pour `action` et `orientation`. */
  executer?(args: z.infer<S>, contexte: ContexteOutil): Promise<ResultatOutil>;
  /** Pour une action : met en forme les arguments transmis à l'interface (les calculs se font ici, pas dans l'IA). */
  preparer?(args: z.infer<S>): Record<string, unknown>;
  /** Message montré à l'utilisateur pour une action ou une orientation. */
  messagePropose?(args: z.infer<S>): string;
}

/** Aide au typage : conserve le lien entre le schéma et `executer`. */
export function definirOutil<S extends z.ZodType>(outil: DefinitionOutil<S>): DefinitionOutil<S> {
  return outil;
}

export type ValidationAppel =
  | { ok: true; outil: DefinitionOutil; args: unknown }
  | { ok: false; erreur: string };

export class RegistreOutils {
  private readonly outils = new Map<string, DefinitionOutil>();

  constructor(outils: DefinitionOutil[] = []) {
    for (const outil of outils) this.ajouter(outil);
  }

  ajouter(outil: DefinitionOutil): this {
    if (this.outils.has(outil.nom)) throw new Error(`Outil déjà déclaré : ${outil.nom}`);
    const serveur = outil.famille === "lecture" || outil.famille === "calcul";
    if (serveur && !outil.executer) throw new Error(`L'outil ${outil.nom} (${outil.famille}) doit déclarer executer()`);
    if (!serveur && outil.executer) throw new Error(`L'outil ${outil.nom} (${outil.famille}) ne doit pas s'exécuter côté serveur`);
    this.outils.set(outil.nom, outil);
    return this;
  }

  estPermis(outil: DefinitionOutil, module: Module): boolean {
    return outil.modules === "tous" || outil.modules.includes(module);
  }

  /** Outils permis dans un module. */
  pour(module: Module): DefinitionOutil[] {
    return [...this.outils.values()].filter((o) => this.estPermis(o, module));
  }

  /** Description des outils au format attendu par le modèle (function calling). */
  versFormatModele(module: Module): OutilModele[] {
    return this.pour(module).map((o) => {
      const { $schema: _ignore, ...parameters } = z.toJSONSchema(o.schema) as Record<string, unknown>;
      void _ignore;
      return { type: "function", function: { name: o.nom, description: o.description, parameters } };
    });
  }

  /** Vérifie qu'un appel du modèle est permis et que ses arguments respectent le schéma. */
  valider(nom: string, argumentsJson: string, module: Module): ValidationAppel {
    const outil = this.outils.get(nom);
    if (!outil) return { ok: false, erreur: `Outil inconnu : ${nom}.` };
    if (!this.estPermis(outil, module)) return { ok: false, erreur: `L'outil ${nom} n'est pas disponible dans le module ${module}.` };

    let brut: unknown;
    try {
      brut = argumentsJson.trim() === "" ? {} : JSON.parse(argumentsJson);
    } catch {
      return { ok: false, erreur: `Arguments illisibles pour ${nom} : JSON invalide.` };
    }
    const resultat = outil.schema.safeParse(brut);
    if (!resultat.success) {
      const details = resultat.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" ; ");
      return { ok: false, erreur: `Arguments invalides pour ${nom} : ${details}.` };
    }
    return { ok: true, outil, args: resultat.data };
  }
}
