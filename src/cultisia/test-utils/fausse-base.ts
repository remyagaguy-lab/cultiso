import { normaliser, type AccesDonnees, type Culture, type LignePrix, type ResumeExploitation, type Sol, type Zone } from "../donnees";

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

  return {
    chercherPrix: async (terme) => prix.filter((p) => normaliser(p.produit).includes(terme)),
    lireExploitation: async (id) => (id === exploitation.id ? exploitation : null),
    chercherCultures: async (terme) => cultures.filter((c) => normaliser(`${c.slug} ${c.nom}`).includes(terme)),
    chercherSols: async (terme) => sols.filter((s) => normaliser(`${s.slug} ${s.nom}`).includes(terme)),
    listerZones: async () => zones,
    chercherSavoir: async () => [],
    ...surcharges,
  };
}
