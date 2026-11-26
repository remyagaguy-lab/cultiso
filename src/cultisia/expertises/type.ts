export type IdExpertise = "agronome" | "zootechnicien" | "transformation" | "agroeconomiste" | "marche" | "pilotage";

export interface Expertise {
  id: IdExpertise;
  titre: string;
  /** Consignes propres à l'expertise, ajoutées au prompt de base. */
  consignes: string;
  /** Mots (sans accent, en minuscules) qui déclenchent l'expertise dans une question. */
  motsCles: readonly string[];
}
