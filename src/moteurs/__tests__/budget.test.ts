/** @jest-environment node */
import { genererBudget, type ModeleCharge, type ModeleRevenu, type RegleAjustement } from "../budget";
import { ErreurMoteur } from "../commun";
import { calculerFinances } from "../finance";

// Modèles fictifs pour 1 ha de tomate et 100 poulets de chair (données de test, pas de référentiel).
const modelesCharges: ModeleCharge[] = [
  { id: "tom-sem", speculationCode: "tomate", typeCharge: "intrants", libelle: "Semences", unite: "sachet", quantite: 1, prixReference: 150_000, nature: "variable", classe: "exploitation", statut: "validee" },
  { id: "tom-eng", speculationCode: "tomate", typeCharge: "intrants", libelle: "Engrais NPK", unite: "sac", quantite: 8, prixReference: 25_000, produitPrix: "npk-50kg", nature: "variable", classe: "exploitation", statut: "brouillon_ia" },
  { id: "tom-log", speculationCode: "tomate", typeCharge: "logistique", libelle: "Transport des récoltes", unite: "voyage", quantite: 4, prixReference: 20_000, nature: "variable", classe: "exploitation", statut: "brouillon_ia" },
  { id: "pou-ali", speculationCode: "poulet", typeCharge: "intrants", libelle: "Aliment", unite: "sac", quantite: 10, prixReference: 18_000, nature: "variable", classe: "exploitation", statut: "brouillon_ia" },
];
const modelesRevenus: ModeleRevenu[] = [
  { id: "tom-vente", speculationCode: "tomate", typeRevenu: "principal", libelle: "Tomate fraîche", unite: "kg", quantite: { pessimiste: 10_000, realiste: 15_000, optimiste: 18_000 }, pertes: 0.3, prixReference: 150, produitPrix: "tomate-kg", statut: "brouillon_ia" },
  { id: "pou-vente", speculationCode: "poulet", typeRevenu: "principal", libelle: "Poulet vif", unite: "tête", quantite: { pessimiste: 90, realiste: 95, optimiste: 97 }, prixReference: 3_000, statut: "brouillon_ia" },
];
const regles: RegleAjustement[] = [
  {
    id: "eau-motopompe",
    cleQuestion: "acces_eau",
    valeur: "motopompe",
    speculationCode: "tomate",
    effet: "ajouter_ligne",
    ligne: { typeCharge: "energie", libelle: "Carburant d'irrigation", unite: "litre", quantite: 200, prixReference: 700, nature: "variable", classe: "exploitation" },
    statut: "brouillon_ia",
  },
  { id: "isole-logistique", cleQuestion: "accessibilite", valeur: "isole", effet: "multiplier", cible: { sens: "charge", type: "logistique" }, coefficient: 1.25, statut: "brouillon_ia" },
  { id: "emballage-premium", cleQuestion: "conditionnement", valeur: "premium", effet: "multiplier", cible: { sens: "revenu", type: "principal" }, coefficient: 1.15, statut: "brouillon_ia" },
];
const base = { modelesCharges, modelesRevenus, regles };

describe("générateur de budget", () => {
  it("modèle × taille, avec l'origine de chaque ligne", () => {
    const b = genererBudget({ ...base, ateliers: [{ atelierId: "a1", speculationCode: "tomate", taille: 2 }] });
    expect(b.charges.map((c) => [c.id, c.quantite, c.prixUnitaire, c.origine])).toEqual([
      ["a1:tom-sem", 2, 150_000, "reference"],
      ["a1:tom-eng", 16, 25_000, "estimation"],
      ["a1:tom-log", 8, 20_000, "estimation"],
    ]);
    expect(b.revenus[0].quantite).toEqual({ pessimiste: 20_000, realiste: 30_000, optimiste: 36_000 });
    expect(b.journal).toEqual([]);
    expect(b.ateliersSansModele).toEqual([]);
  });

  it("le prix du marché remplace la référence et garde sa source", () => {
    const b = genererBudget({
      ...base,
      ateliers: [{ atelierId: "a1", speculationCode: "tomate", taille: 1 }],
      prix: [{ produitId: "npk-50kg", prix: 27_500, source: "Marché d'Adawlato", date: "2026-11-20" }],
    });
    const engrais = b.charges.find((c) => c.modeleId === "tom-eng");
    expect(engrais?.prixUnitaire).toBe(27_500);
    expect(engrais?.origine).toBe("prix_marche");
    expect(engrais?.sourcePrix).toEqual({ source: "Marché d'Adawlato", date: "2026-11-20" });
  });

  it("motopompe : une ligne de carburant est ajoutée, à l'échelle de l'atelier", () => {
    const b = genererBudget({ ...base, ateliers: [{ atelierId: "a1", speculationCode: "tomate", taille: 2 }], contexte: { acces_eau: "motopompe" } });
    const carburant = b.charges.find((c) => c.id === "a1:eau-motopompe");
    expect(carburant).toMatchObject({ quantite: 400, prixUnitaire: 700, origine: "ajustee_terrain", modeleId: null });
    expect(b.journal).toEqual([{ regleId: "eau-motopompe", ligneId: "a1:eau-motopompe", effet: "ajouter_ligne", coefficient: null }]);
  });

  it("zone isolée : la logistique est multipliée, le reste ne bouge pas", () => {
    const b = genererBudget({ ...base, ateliers: [{ atelierId: "a1", speculationCode: "tomate", taille: 1 }], contexte: { accessibilite: "isole" } });
    expect(b.charges.find((c) => c.typeCharge === "logistique")).toMatchObject({ quantite: 5, origine: "ajustee_terrain" });
    expect(b.charges.find((c) => c.modeleId === "tom-sem")?.origine).toBe("reference");
  });

  it("emballage premium : le prix de vente (du marché) est majoré", () => {
    const b = genererBudget({
      ...base,
      ateliers: [{ atelierId: "a1", speculationCode: "tomate", taille: 1 }],
      contexte: { conditionnement: "premium" },
      prix: [{ produitId: "tomate-kg", prix: 200, source: "Annonces WhatsApp", date: "2026-11-25" }],
    });
    expect(b.revenus[0].prixUnitaire).toBeCloseTo(230, 6);
    expect(b.revenus[0].origine).toBe("ajustee_terrain");
  });

  it("les lignes ajoutées passent avant les coefficients, quel que soit l'ordre des règles", () => {
    const b = genererBudget({
      ...base,
      regles: [
        { id: "contre-saison", cleQuestion: "saisonnalite", valeur: "contre_saison", effet: "multiplier", cible: { sens: "charge", type: "energie" }, coefficient: 1.35, statut: "brouillon_ia" },
        regles[0],
      ],
      ateliers: [{ atelierId: "a1", speculationCode: "tomate", taille: 1 }],
      contexte: { acces_eau: "motopompe", saisonnalite: "contre_saison" },
    });
    expect(b.charges.find((c) => c.id === "a1:eau-motopompe")?.quantite).toBeCloseTo(270, 6);
    expect(b.journal.map((j) => j.regleId)).toEqual(["eau-motopompe", "contre-saison"]);
  });

  it("une règle limitée à une spéculation ne touche pas les autres ateliers", () => {
    const b = genererBudget({
      ...base,
      ateliers: [
        { atelierId: "a1", speculationCode: "tomate", taille: 1 },
        { atelierId: "a2", speculationCode: "poulet", taille: 5, cyclesParAn: 5 },
      ],
      contexte: { acces_eau: "motopompe" },
    });
    expect(b.charges.filter((c) => c.atelierId === "a2").map((c) => c.id)).toEqual(["a2:pou-ali"]);
    expect(b.charges.find((c) => c.id === "a2:pou-ali")).toMatchObject({ quantite: 50, cyclesParAn: 5 });
  });

  it("signale un atelier sans modèle de référence", () => {
    const b = genererBudget({ ...base, ateliers: [{ atelierId: "a9", speculationCode: "autruche", taille: 3 }] });
    expect(b.ateliersSansModele).toEqual(["a9"]);
    expect(b.charges).toEqual([]);
  });

  it("le budget généré passe directement dans le moteur financier", () => {
    const b = genererBudget({ ...base, ateliers: [{ atelierId: "a1", speculationCode: "tomate", taille: 2 }] });
    const f = calculerFinances({ charges: b.charges, revenus: b.revenus });
    // 30 000 kg × 150 × 0,7 ; charges 300 000 + 400 000 + 160 000.
    expect(f.scenarios.realiste.annees[0].chiffreAffaires).toBe(3_150_000);
    expect(f.scenarios.realiste.annees[0].chargesVariables).toBe(860_000);
  });

  it("refuse une règle « multiplier » sans coefficient", () => {
    expect(() =>
      genererBudget({
        ...base,
        regles: [{ id: "x", cleQuestion: "a", valeur: "b", effet: "multiplier", cible: { sens: "charge" }, statut: "brouillon_ia" }],
        ateliers: [{ atelierId: "a1", speculationCode: "tomate", taille: 1 }],
      }),
    ).toThrow(ErreurMoteur);
  });
});
