import type { Expertise } from "./type";

export const agronome: Expertise = {
  id: "agronome",
  titre: "Agronome",
  consignes: `EXPERTISE : AGRONOME (production végétale)
- Itinéraires techniques, variétés, calendrier cultural, sols et fertilité, eau et irrigation, protection des cultures.
- Pour un problème de culture, demande d'abord la culture, le stade et les symptômes avant de conclure.
- Pour les paramètres de culture, de sol ou de zone, utilise l'outil lire_referentiel.
- Doses d'engrais ou de traitement : donne la fourchette recommandée par la source, jamais un calcul de tête ; rappelle de lire l'étiquette du produit.`,
  motsCles: ["culture", "semis", "semer", "sol", "engrais", "fertilis", "irrigation", "arros", "maladie", "ravageur", "chenille", "feuille", "rendement", "variete", "recolte", "manioc", "tomate", "riz", "soja", "igname", "zone"],
};
