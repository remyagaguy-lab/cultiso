/** @jest-environment node */
// Branchement du financement détaillé (M6) et du travail familial (R2) sur la grille de M1 (moteur 2.1.0).
import { calculerFinances } from "../finance";
import { calculerFinancement, financementPourMoteur } from "../financement";
import { calculerMainOeuvre } from "../main-oeuvre";
import { tomate2ha } from "../test-utils/tomate";

const prets = [{ id: "p", libelle: "Prêt", credit: { montant: 600_000, tauxAnnuel: 0.12, dureeMois: 12 } }];
const fin = calculerFinancement({
  horizonMois: 36,
  emploisInitiaux: { investissement: 600_000, bfr: 0 },
  apportEspeces: 100_000,
  prets,
  creditsChaine: [{ id: "c", libelle: "Chaîne", acheteur: "Acheteur", montant: 200_000, tauxAnnuel: 0.1, moisTirage: 2, moisPaiementAcheteur: 5 }],
  subventions: [{ id: "s", libelle: "Subvention", type: "investissement", montant: 300_000, moisEncaissement: 3, dureeRepriseAns: 3 }],
  taxeInterets: { taux: 0.1, nom: "Taxe test", source: "essai" },
});

describe("financement détaillé branché sur la grille", () => {
  const base = calculerFinances({ ...tomate2ha, horizonAnnees: 3 }).scenarios.realiste;
  const branche = calculerFinances({ ...tomate2ha, horizonAnnees: 3, apport: 100_000, financement: financementPourMoteur(fin.mois) }).scenarios.realiste;

  it("la trésorerie de la grille égale celle du financement, mois par mois", () => {
    branche.tresorerieMensuelle.forEach((t, m) => {
      expect(t.solde).toBeCloseTo(base.tresorerieMensuelle[m].solde + fin.mois[m].flux, -2);
    });
  });

  it("frais financiers, taxe et reprise des subventions arrivent dans le résultat", () => {
    fin.annees.slice(0, 3).forEach((a, i) => {
      const an = branche.annees[i];
      expect(an.fraisFinanciers).toBeCloseTo(a.fraisFinanciers, -2);
      expect(an.taxeInterets).toBeCloseTo(a.taxeInterets, -2);
      expect(an.repriseSubventions).toBeCloseTo(a.repriseSubventions, -2);
      expect(an.resultat).toBeCloseTo(base.annees[i].resultat - a.fraisFinanciers + a.repriseSubventions, -2);
      // La reprise n'est pas de l'argent : la CAF ne la compte pas.
      expect(an.cafNette).toBeCloseTo(base.annees[i].cafNette - a.fraisFinanciers, -2);
    });
    expect(branche.annees[0].fraisFinanciers).toBeGreaterThan(0);
  });

  it("le capital remboursé comprend la retenue de l'acheteur, sans double comptage", () => {
    const capital = branche.annees.reduce((t, a) => t + a.remboursementCapital, 0);
    expect(capital).toBeCloseTo(fin.annees.slice(0, 3).reduce((t, a) => t + a.capitalRembourse, 0), -2);
  });

  it("le crédit et l'apport simples ne sont plus comptés dans la grille quand le détail est donné", () => {
    const double = calculerFinances({
      ...tomate2ha,
      horizonAnnees: 3,
      apport: 100_000,
      credit: { montant: 600_000, tauxAnnuel: 0.12, dureeMois: 12 },
      financement: financementPourMoteur(fin.mois),
    }).scenarios.realiste;
    expect(double.tresorerieMensuelle.map((t) => t.solde)).toEqual(branche.tresorerieMensuelle.map((t) => t.solde));
  });

  it("sans financement détaillé, le comportement du crédit simple est inchangé", () => {
    const simple = calculerFinances({ ...tomate2ha, horizonAnnees: 3, apport: 100_000, credit: { montant: 600_000, tauxAnnuel: 0.12, dureeMois: 12 } }).scenarios.realiste;
    expect(simple.annees[0].taxeInterets).toBe(0);
    expect(simple.annees[0].fraisFinanciers).toBe(simple.annees[0].interets);
  });
});

describe("travail familial branché (coût de revient, jamais en trésorerie)", () => {
  const mo = calculerMainOeuvre({
    membres: [{ id: "f", libelle: "Famille", type: "famille", heuresParMois: 100 }],
    besoinsHeuresParMois: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80],
    surfaceHa: 2,
    prixHeure: { valeur: 500, source: "essai" },
  });
  it("la valeur du travail retire du résultat apparent mais pas de la trésorerie", () => {
    const sans = calculerFinances(tomate2ha).scenarios.realiste;
    const avec = calculerFinances({ ...tomate2ha, travailFamilial: { montantAnnuel: mo.valorisationFamille.montantAn ?? 480_000 } }).scenarios.realiste;
    expect(avec.tresorerieMensuelle).toEqual(sans.tresorerieMensuelle);
    expect(avec.annees[0].resultat).toBe(sans.annees[0].resultat);
    expect(avec.annees[0].resultatApresTravailFamilial).toBe(sans.annees[0].resultat - avec.annees[0].travailFamilial);
    expect(avec.annees[0].travailFamilial).toBeGreaterThan(0);
  });
});
