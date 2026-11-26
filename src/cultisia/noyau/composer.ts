/**
 * Compose le prompt système : noyau commun + une ou deux expertises + contexte (module, écran, exploitation).
 */
import { normaliser } from "../donnees";
import { EXPERTISES, type IdExpertise } from "../expertises";
import type { Module } from "../modules";
import { PROMPT_NOYAU } from "./prompt";

export const EXPERTISE_PAR_MODULE: Record<Module, IdExpertise> = {
  cultisia: "agronome",
  cultiplan: "agroeconomiste",
  cultima: "pilotage",
  cultiseil: "agronome",
  "cours-des-prix": "marche",
};

const NOM_MODULE: Record<Module, string> = {
  cultisia: "Cultisia (assistante générale)",
  cultiplan: "Cultiplan (concevoir et financer un projet)",
  cultima: "Cultima (piloter son exploitation)",
  cultiseil: "Experts Cultiso (diagnostic de terrain)",
  "cours-des-prix": "Cours des prix",
};

export interface ParametresPrompt {
  module: Module;
  /** Dernière question de l'utilisateur : sert à choisir une expertise complémentaire. */
  question: string;
  ecran?: string;
  exploitation?: { id: string; nom?: string };
  /**
   * Contrat de sortie propre au module, transitoire. Aujourd'hui : le prompt Cultiplan v1.2
   * (format JSON lu par le canevas Cultiplan), conservé jusqu'au chantier Cultiplan.
   */
  contratModule?: string;
}

/** Choisit l'expertise du module, plus au plus une expertise suggérée par la question. */
export function choisirExpertises(module: Module, question: string): IdExpertise[] {
  const principale = EXPERTISE_PAR_MODULE[module];
  const texte = normaliser(question);
  let meilleure: { id: IdExpertise; score: number } | null = null;

  for (const expertise of Object.values(EXPERTISES)) {
    if (expertise.id === principale) continue;
    const score = expertise.motsCles.filter((mot) => texte.includes(mot)).length;
    if (score > 0 && (!meilleure || score > meilleure.score)) meilleure = { id: expertise.id, score };
  }
  return meilleure ? [principale, meilleure.id] : [principale];
}

export function composerPrompt(parametres: ParametresPrompt): { prompt: string; expertises: IdExpertise[] } {
  const expertises = choisirExpertises(parametres.module, parametres.question);

  const contexte = [
    "CONTEXTE",
    `- Module : ${NOM_MODULE[parametres.module]}`,
    parametres.ecran ? `- Écran : ${parametres.ecran}` : null,
    parametres.exploitation
      ? `- Exploitation active : ${parametres.exploitation.nom ?? "sans nom"} (lis-la avec lire_exploitation si besoin)`
      : "- Aucune exploitation active",
    `- Date du jour : ${new Date().toISOString().slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const blocs = [PROMPT_NOYAU, ...expertises.map((id) => EXPERTISES[id].consignes), contexte];
  if (parametres.contratModule) blocs.push(`CONTRAT DE SORTIE DU MODULE\n${parametres.contratModule}`);

  return { prompt: blocs.join("\n\n"), expertises };
}
