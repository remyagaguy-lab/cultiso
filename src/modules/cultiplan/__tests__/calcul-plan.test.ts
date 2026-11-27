/** @jest-environment node */
import { tomate2ha } from "@/moteurs/test-utils/tomate";
import { calculerAvecFinancement } from "../calcul-plan";
import { schemaFinancementDetaille } from "../financement-demande";
import { schemaFinancement } from "../service";

const detaille = schemaFinancementDetaille.parse({
  apportEspeces: 100_000,
  apportsNature: [{ libelle: "Terrain", valeur: 200_000, piece: "attestation villageoise" }],
  prets: [{ id: "p", libelle: "Prêt", credit: { montant: 500_000, tauxAnnuel: 0.1, dureeMois: 12 } }],
  creditsCampagne: [{ id: "c", libelle: "Campagne", tauxAnnuel: 0.1, campagnes: [{ montantDemande: 200_000, moisTirage: 1, moisRemboursement: 6 }], baremeDe: { speculationCode: "tomate", tailleAtelier: 2 } }],
  subventions: [{ id: "s", libelle: "Subvention", type: "investissement", montant: 100_000, moisEncaissement: 2, dureeRepriseAns: 4 }],
  taxeInterets: { taux: 0.1, nom: "Taxe d'essai", source: "essai" },
});

describe("plan avec financement détaillé", () => {
  it("la forme enregistrée est validée et vaut null par défaut", () => {
    expect(schemaFinancement.parse({}).detaille).toBeUndefined();
    expect(() => schemaFinancement.parse({ detaille: { prets: [{ id: "x" }] } })).toThrow();
    expect(schemaFinancement.parse({ detaille }).detaille?.prets).toHaveLength(1);
  });

  it("sans détail, le calcul est celui du moteur financier", () => {
    const r = calculerAvecFinancement(tomate2ha, null);
    expect(r.financement).toBeNull();
    expect(r.resultats.financementDetaille).toBeUndefined();
  });

  it("avec détail : frais financiers, taxe et reprise dans les années, trésorerie = exploitation + flux, un seul calcul de l'apport", () => {
    const r = calculerAvecFinancement(tomate2ha, detaille);
    const reel = r.resultats.scenarios.realiste;
    const fin = r.financement!;
    expect(reel.annees[0].fraisFinanciers).toBeGreaterThan(0);
    expect(reel.annees[0].taxeInterets).toBeGreaterThan(0);
    expect(reel.annees[0].repriseSubventions).toBeGreaterThan(0);
    reel.tresorerieMensuelle.forEach((t, m) => expect(t.solde).toBeCloseTo(r.exploitationSeule!.tresorerieMensuelle[m].solde + fin.mois[m].flux, -2));
    // L'apport du plan simple (s'il existait) ne s'ajoute pas : seul le détail alimente la grille.
    const avecApportSimple = calculerAvecFinancement({ ...tomate2ha, apport: 999_999 }, detaille).resultats.scenarios.realiste;
    expect(avecApportSimple.tresorerieMensuelle.map((t) => t.solde)).toEqual(reel.tresorerieMensuelle.map((t) => t.solde));
    expect(r.resultats.financementDetaille?.planAnnuel.length).toBeGreaterThan(0);
  });

  it("le plafond de campagne inconnu est signalé par le moteur, pas deviné", () => {
    const r = calculerAvecFinancement(tomate2ha, detaille);
    expect(r.financement!.controles.map((c) => c.code)).toContain("PLAFOND_CAMPAGNE_NON_VERIFIE");
  });
});
