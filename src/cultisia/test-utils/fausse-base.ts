import type { EntreeBudget } from "@/moteurs";
import type { RegleFinanceurRef } from "@/referentiel";
import { normaliser, type AccesDonnees, type Culture, type LignePrix, type ResumeExploitation, type Sol, type SpeculationRef, type Zone } from "../donnees";

/** Petit référentiel de test (pour 1 unité d'échelle) : tomate à l'hectare, poulet de chair au sujet. */
export const REFERENTIEL_TEST: Pick<EntreeBudget, "modelesCharges" | "modelesRevenus" | "regles"> = {
  modelesCharges: [
    { id: "c-engrais", speculationCode: "tomate", typeCharge: "intrants", libelle: "Engrais", unite: "sac", quantite: 4, prixReference: 18000, nature: "variable", classe: "exploitation", statut: "brouillon_ia" },
    { id: "c-mo", speculationCode: "tomate", typeCharge: "main_oeuvre", libelle: "Main-d'œuvre", unite: "jour", quantite: 60, prixReference: 2000, nature: "variable", classe: "exploitation", statut: "brouillon_ia" },
    { id: "c-pompe", speculationCode: "tomate", typeCharge: "infrastructures", libelle: "Motopompe", unite: "unité", quantite: 1, prixReference: 300000, base: "an", nature: "fixe", classe: "investissement", dureeVieAns: 5, statut: "brouillon_ia" },
    { id: "c-poussin", speculationCode: "poulet_chair", typeCharge: "intrants", libelle: "Poussins", unite: "sujet", quantite: 1, prixReference: 500, nature: "variable", classe: "exploitation", statut: "validee" },
    { id: "c-aliment", speculationCode: "poulet_chair", typeCharge: "intrants", libelle: "Aliment", unite: "kg", quantite: 4, prixReference: 350, nature: "variable", classe: "exploitation", statut: "validee" },
    { id: "c-batiment", speculationCode: "poulet_chair", typeCharge: "infrastructures", libelle: "Poulailler", unite: "m2", quantite: 0.1, prixReference: 25000, base: "an", nature: "fixe", classe: "investissement", dureeVieAns: 10, statut: "validee" },
  ],
  modelesRevenus: [
    { id: "r-tomate", speculationCode: "tomate", typeRevenu: "principal", libelle: "Vente de tomates", unite: "kg", quantite: { pessimiste: 6000, realiste: 8000, optimiste: 10000 }, pertes: 0.2, prixReference: 150, statut: "brouillon_ia" },
    { id: "r-poulet", speculationCode: "poulet_chair", typeRevenu: "principal", libelle: "Vente de poulets", unite: "sujet", quantite: { pessimiste: 0.9, realiste: 0.95, optimiste: 0.97 }, pertes: 0, prixReference: 2500, statut: "validee" },
  ],
  regles: [
    { id: "g-isole", cleQuestion: "acces", valeur: "isole", effet: "multiplier", cible: { sens: "charge", type: "main_oeuvre" }, coefficient: 1.5, statut: "brouillon_ia" },
  ],
};

/** Règle de test (même forme que la ligne de départ ANPGF, qui reste en brouillon IA). */
export const REGLES_FINANCEURS_TEST: RegleFinanceurRef[] = [
  {
    id: "f-anpgf",
    organisme: "ANPGF",
    produit: "projet_demarrage",
    libelle: "Projet en démarrage",
    pays: "TG",
    apportMinimum: 0.2,
    dureeMaxMois: 48,
    dureeInclutDiffere: true,
    differeMaxMois: 12,
    tauxIndicatif: null,
    taxes: [],
    piecesExigees: ["Plan d'affaires au canevas ANPGF"],
    formatDossier: "Canevas ANPGF",
    notes: null,
    statut: "brouillon_ia",
    source: "Canevas ANPGF §10.1, §10.3",
  },
];

/** Fausse base pour les tests : données fixes, erreurs simulables par surcharge. */
export function fausseBase(surcharges: Partial<AccesDonnees> = {}): AccesDonnees {
  const prix: LignePrix[] = [
    { produit: "Maïs grain", prix: 350, devise: "FCFA", unite: "kg", lieu: "Lomé, Adawlato", date: "2026-11-20", source: "Relevé Cultiso" },
    { produit: "Maïs grain", prix: 300, devise: "FCFA", unite: "kg", lieu: "Kara", date: "2026-11-18", source: null },
  ];
  const exploitation: ResumeExploitation = {
    id: "exp-1",
    nom: "Ferme de Tsévié",
    domaine: "maraichage",
    statut: "active",
    surface: 2,
    uniteSurface: "ha",
    localisation: "Tsévié",
    plans: [{ titre: "Tomate saison sèche", misAJour: "2026-11-01" }],
    operations: [{ date: "2026-11-10", type: "expense", categorie: "Engrais", montant: 72000, description: null }],
  };
  const cultures: Culture[] = [
    { slug: "cassavagdd", nom: "Cassava, GDD", temperatureBaseC: 10, temperatureMaxC: 35, indiceRecoltePct: 70 },
    { slug: "cassava", nom: "Default Cassava, Calendar (Columbia, Nigeria, Togo)", temperatureBaseC: 10, temperatureMaxC: 35, indiceRecoltePct: 70 },
  ];
  const sols: Sol[] = [
    { slug: "sandyloam", nom: "deep uniform 'sandy loam' soil profile", capaciteChampPct: 22, pointFletrissementPct: 10, ksatMmJour: 1200 },
    { slug: "clay", nom: "deep uniform 'heavy clay' soil profile", capaciteChampPct: 54, pointFletrissementPct: 39, ksatMmJour: 35 },
  ];
  const zones: Zone[] = [
    { code: "ZONE_4", nom: "Zone IV (Plateaux)", description: "Sud-ouest.", pluieMinMm: 1400, pluieMaxMm: 1600 },
    { code: "ZONE_5", nom: "Zone V (Maritime)", description: "Sud.", pluieMinMm: 800, pluieMaxMm: 1200 },
  ];

  const speculations: SpeculationRef[] = [
    { code: "tomate", nom: "Tomate", secteur: "vegetal", uniteEchelle: "ha", statut: "brouillon_ia" },
    { code: "poulet_chair", nom: "Poulet de chair", secteur: "animal", uniteEchelle: "sujets", statut: "brouillon_ia" },
    { code: "sans_modele", nom: "Vanille", secteur: "vegetal", uniteEchelle: "ha", statut: "brouillon_ia" },
  ];

  return {
    listerSpeculations: async () => speculations,
    preparerBudget: async ({ ateliers, contexte }) => {
      const codes = new Set(ateliers.map((a) => a.speculationCode));
      return {
        ateliers: ateliers.map((a) => ({ atelierId: a.id, speculationCode: a.speculationCode, taille: a.taille, cyclesParAn: a.speculationCode === "poulet_chair" ? 4 : 2 })),
        modelesCharges: REFERENTIEL_TEST.modelesCharges.filter((m) => codes.has(m.speculationCode)),
        modelesRevenus: REFERENTIEL_TEST.modelesRevenus.filter((m) => codes.has(m.speculationCode)),
        contexte,
        regles: REFERENTIEL_TEST.regles,
        prix: [],
      };
    },
    lireReglesFinanceurs: async (filtre = {}) =>
      REGLES_FINANCEURS_TEST.filter((r) => (!filtre.organisme || r.organisme.toLowerCase() === filtre.organisme.toLowerCase()) && (!filtre.produit || r.produit === filtre.produit)),
    lireAteliersEtContexte: async (id) =>
      id === exploitation.id ? { ateliers: [{ id: "at-1", speculationCode: "tomate", taille: 2 }], contexte: { acces: "isole" } } : null,
    chercherPrix: async (terme) => prix.filter((p) => normaliser(p.produit).includes(terme)),
    lireExploitation: async (id) => (id === exploitation.id ? exploitation : null),
    chercherCultures: async (terme) => cultures.filter((c) => normaliser(`${c.slug} ${c.nom}`).includes(terme)),
    chercherSols: async (terme) => sols.filter((s) => normaliser(`${s.slug} ${s.nom}`).includes(terme)),
    listerZones: async () => zones,
    chercherSavoir: async () => [],
    ...surcharges,
  };
}
