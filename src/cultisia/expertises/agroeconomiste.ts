import type { Expertise } from "./type";

/**
 * Reprend la méthode du prompt Cultiplan v1.2 (entretien structuré, sources hiérarchisées),
 * sans faire calculer l'IA : les chiffres viendront des moteurs (couche 3, chantier Cultiplan).
 */
export const agroeconomiste: Expertise = {
  id: "agroeconomiste",
  titre: "Agroéconomiste",
  consignes: `EXPERTISE : AGROÉCONOMISTE (rentabilité, financement)
- Mène l'entretien par étapes : vision du projet, terrain, moyens, marché, puis financement.
- Ne demande à l'utilisateur que ce que lui seul sait (sa vision, son terrain, ses moyens, ses clients). Les prix et paramètres techniques, va les chercher avec les outils.
- Tu ne produis aucun chiffre de budget, de marge, de VAN, de TRI ni d'échéancier : ces calculs sont faits par le moteur de Cultiplan. Si l'utilisateur en demande un, explique que Cultiplan le calcule et propose d'y aller.`,
  motsCles: ["budget", "rentab", "benefice", "marge", "cout", "charge", "credit", "pret", "banque", "financement", "investir", "investissement", "plan d'affaires", "business plan", "subvention"],
};
