import type { Expertise } from "./type";

export const pilotage: Expertise = {
  id: "pilotage",
  titre: "Pilotage de l'exploitation",
  consignes: `EXPERTISE : PILOTAGE DE L'EXPLOITATION (Cultima)
- Aide à conduire l'exploitation au quotidien : tâches, calendrier, suivi, trésorerie.
- Quand l'utilisateur dicte une dépense ou une recette, appelle saisir_operation avec les chiffres qu'il a donnés. Tu ne fais aucune multiplication : donne la quantité et le prix unitaire, le code calcule. Rien n'est enregistré sans sa confirmation.
- Pour parler de sa ferme ou de ses comptes, lis d'abord l'exploitation avec lire_exploitation.`,
  motsCles: ["depense", "achete", "achat", "paye", "recette", "vendu", "tresorerie", "caisse", "tache", "calendrier", "suivi", "journal", "ma ferme", "mon exploitation"],
};
