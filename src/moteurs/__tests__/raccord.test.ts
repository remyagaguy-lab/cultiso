/** @jest-environment node */
import { simulerBandes, type EntreeBandes } from "../bandes";
import { calculerFinances } from "../finance";
import { lignesDepuisBandes, lignesDepuisTroupeau } from "../raccord";
import { simulerTroupeau } from "../troupeau";

// Mêmes courbes d'essai SIMPLES que bandes.test.ts (inventées pour le test seulement).
const courbe = (valeurs: number[]) => valeurs.map((valeur, i) => ({ age: i + 1, valeur }));
const bandes = (extra: Partial<EntreeBandes> = {}): EntreeBandes => ({
  courbes: { mortalite: courbe([0.1, 0, 0, 0, 0]), consommation: courbe([20, 50, 100, 100, 100]), production: courbe([0, 0, 0.5, 0.5, 0.5]) },
  joursParMois: 30,
  dureeBandeMois: 5,
  bandes: [{ debutMois: 1, effectif: 100 }],
  prix: { animal: 1000, aliment: 200, produit: 100, reforme: 2000 },
  chargesFixesMensuelles: [{ libelle: "Gardien", montant: 20_000 }],
  ...extra,
});

describe("raccord des bandes à la grille de M1", () => {
  it("la trésorerie de la grille est celle du moteur à bandes, mois par mois (sans amortissement, sans apport)", () => {
    const b = simulerBandes(bandes());
    const l = lignesDepuisBandes(b, { prefixe: "pond", atelierId: "a1" });
    const f = calculerFinances({ charges: l.charges, revenus: l.revenus, horizonMois: 12 }).scenarios.realiste;
    for (const m of b.mois) expect(f.tresorerieMensuelle[m.mois].solde).toBe(m.solde);
    expect(f.pointBasTresorerie.montant).toBe(b.pointBasTresorerie.montant);
    expect(f.pointBasTresorerie.mois).toBe(b.pointBasTresorerie.mois);
  });

  it("une bande décalée de 3 mois : tous les flux glissent de 3 mois", () => {
    const b = simulerBandes(bandes());
    const l = lignesDepuisBandes(b, { prefixe: "pond", decalageMois: 3 });
    const f = calculerFinances({ charges: l.charges, revenus: l.revenus, horizonMois: 12 }).scenarios.realiste;
    expect(f.tresorerieMensuelle[3].solde).toBe(0);
    for (const m of b.mois.slice(1)) expect(f.tresorerieMensuelle[m.mois + 3].solde).toBe(m.solde);
  });

  it("l'investissement avec une durée de vie est amorti et daté ; sans durée de vie il est compté comme une charge et signalé", () => {
    const b = simulerBandes(bandes({ investissement: 600_000 }));
    const avec = lignesDepuisBandes(b, { prefixe: "p", dureeVieAns: 10 });
    expect(avec.avertissements).toEqual([]);
    const f = calculerFinances({ charges: avec.charges, revenus: avec.revenus, horizonAnnees: 1 }).scenarios.realiste;
    expect(f.investissementsDates).toMatchObject([{ mois: 0, montant: 600_000, renouvellement: false }]);
    expect(f.annees[0].amortissements).toBe(60_000);
    const sans = lignesDepuisBandes(b, { prefixe: "p" });
    expect(sans.avertissements[0]).toContain("durée de vie");
    expect(calculerFinances({ charges: sans.charges, revenus: sans.revenus, horizonAnnees: 1 }).scenarios.realiste.annees[0].amortissements).toBe(0);
  });

  it("deux bandes décalées sont additionnées dans la même grille", () => {
    const une = simulerBandes(bandes());
    const deux = simulerBandes(bandes({ bandes: [{ debutMois: 1, effectif: 100 }, { debutMois: 4, effectif: 100 }], chargesFixesMensuelles: [] }));
    const l = lignesDepuisBandes(deux, { prefixe: "p" });
    const f = calculerFinances({ charges: l.charges, revenus: l.revenus, horizonMois: 12 }).scenarios.realiste;
    for (const m of deux.mois) expect(f.tresorerieMensuelle[m.mois].solde).toBe(m.solde);
    expect(une.totalVentes).toBeGreaterThan(0);
  });
});

describe("raccord du cheptel en flux", () => {
  it("achats et ventes d'animaux deviennent une charge et un revenu à série mensuelle ; les mouvements sans prix sont signalés", () => {
    const r = simulerTroupeau({
      horizonMois: 6,
      categories: [{ code: "brebis", libelle: "Brebis", effectifInitial: 10 }],
      mouvements: [
        { mois: 1, categorie: "brebis", type: "achat", effectif: 5, prixUnitaire: 40_000 },
        { mois: 6, categorie: "brebis", type: "vente", effectif: 2, prixUnitaire: 45_000 },
        { mois: 3, categorie: "brebis", type: "naissance", effectif: 2 },
        { mois: 4, categorie: "brebis", type: "vente", effectif: 1 },
      ],
    });
    const l = lignesDepuisTroupeau(r, { prefixe: "ov" });
    expect(l.avertissements[0]).toContain("sans prix");
    const f = calculerFinances({ charges: l.charges, revenus: l.revenus, horizonMois: 6 }).scenarios.realiste;
    expect(f.tresorerieMensuelle[1].solde).toBe(-200_000);
    expect(f.tresorerieMensuelle[6].solde).toBe(90_000);
    for (const t of r.tresorerie) expect(f.tresorerieMensuelle[t.mois].solde).toBe(t.solde);
  });
});
