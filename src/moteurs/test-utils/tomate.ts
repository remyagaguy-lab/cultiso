// Cas de référence partagé par les tests des moteurs, vérifié à la main.
import type { EntreeFinance } from "../finance";

// Cas de référence, vérifié à la main : 2 ha de tomate, 1 cycle par an, 30 % de pertes.
// Réaliste : 30 000 kg × 150 FCFA × 0,7 = 3 150 000 FCFA de chiffre d'affaires.
// Charges variables 1 200 000 (semences 300 000, engrais 400 000, main-d'œuvre 500 000),
// charges fixes 120 000 (location de terre), motopompe 600 000 amortie sur 3 ans (200 000 par an).
export const tomate2ha: EntreeFinance = {
  horizonAnnees: 3,
  charges: [
    { id: "semences", libelle: "Semences", typeCharge: "intrants", quantite: 2, prixUnitaire: 150_000, nature: "variable", classe: "exploitation", moisDecaissement: [1] },
    { id: "engrais", libelle: "Engrais NPK", typeCharge: "intrants", quantite: 2, prixUnitaire: 200_000, nature: "variable", classe: "exploitation", moisDecaissement: [2, 3] },
    { id: "mo", libelle: "Main-d'œuvre", typeCharge: "main_oeuvre", quantite: 2, prixUnitaire: 250_000, nature: "variable", classe: "exploitation" },
    { id: "terre", libelle: "Location de terre", typeCharge: "infrastructures", quantite: 1, prixUnitaire: 120_000, base: "an", nature: "fixe", classe: "exploitation" },
    { id: "pompe", libelle: "Motopompe", typeCharge: "infrastructures", quantite: 1, prixUnitaire: 600_000, nature: "fixe", classe: "investissement", dureeVieAns: 3 },
  ],
  revenus: [
    {
      id: "tomate",
      libelle: "Tomate fraîche",
      typeRevenu: "principal",
      quantite: { pessimiste: 20_000, realiste: 30_000, optimiste: 36_000 },
      prixUnitaire: 150,
      pertes: 0.3,
      moisVente: [4, 5],
    },
  ],
};
