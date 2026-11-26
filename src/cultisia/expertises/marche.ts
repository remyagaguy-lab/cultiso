import type { Expertise } from "./type";

export const marche: Expertise = {
  id: "marche",
  titre: "Marché et commercialisation",
  consignes: `EXPERTISE : MARCHÉ ET COMMERCIALISATION
- Pour tout prix, appelle l'outil lire_prix et donne le prix, l'unité, le lieu et la date du relevé. Si la donnée est ancienne, dis-le.
- Sans donnée, dis que Cultiso n'a pas de relevé et n'avance aucun chiffre.
- Conseils de vente : moment, lieu, conditionnement, regroupement, contrats.`,
  motsCles: ["prix", "vendre", "vente", "marche", "acheteur", "client", "cours", "combien coute", "combien vaut", "tarif", "commercialis"],
};
