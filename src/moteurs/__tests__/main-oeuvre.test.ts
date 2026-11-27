import { calculerMainOeuvre, ErreurMoteur, type EntreeMainOeuvre } from "..";

const mois = (v: number[]) => v;
const base: EntreeMainOeuvre = {
  membres: [
    { id: "p", libelle: "Toi", type: "famille", heuresParMois: 100, equivalentActif: 1 },
    { id: "c", libelle: "Ton conjoint", type: "famille", heuresParMois: mois([50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50]), equivalentActif: 0.5 },
  ],
  besoinsHeuresParMois: [100, 100, 150, 300, 150, 100, 100, 100, 100, 100, 100, 100],
};

describe("main d'oeuvre (R2)", () => {
  it("couvre le besoin avec la famille, puis signale la pointe avec la tâche qui la cause", () => {
    const r = calculerMainOeuvre({
      ...base,
      heuresParJour: { valeur: 8, source: "paramètre du test" },
      taches: [
        { libelle: "Semis", heuresParMois: [0, 0, 0, 200, 0, 0, 0, 0, 0, 0, 0, 0] },
        { libelle: "Entretien", heuresParMois: [100, 100, 150, 100, 150, 100, 100, 100, 100, 100, 100, 100] },
      ],
    });
    expect(r.mois[0].capaciteFamilleHeures).toBe(150);
    expect(r.mois[0].heuresFamilleUtilisees).toBe(100);
    expect(r.mois[3].heuresManquantes).toBe(150);
    expect(r.mois[3].joursManquants).toBe(18.8);
    expect(r.pointes).toHaveLength(1);
    expect(r.pointes[0]).toMatchObject({ mois: 4, heuresManquantes: 150, tachePrincipale: "Semis" });
    expect(r.controles.find((c) => c.code === "PIC_DE_TRAVAIL")?.message).toContain("tu n'en as");
    expect(r.moisLePlusCharge).toEqual({ mois: 4, besoinHeures: 300 });
  });

  it("un salarié absorbe la pointe : plus de manque, ses heures sont comptées à part", () => {
    const r = calculerMainOeuvre({ ...base, membres: [...base.membres, { id: "s", libelle: "Saisonnier", type: "saisonnier", heuresParMois: [0, 0, 0, 200, 0, 0, 0, 0, 0, 0, 0, 0] }] });
    expect(r.pointes).toHaveLength(0);
    expect(r.mois[3].heuresSalarieesUtilisees).toBe(150);
    expect(r.controles.map((c) => c.code)).not.toContain("PIC_DE_TRAVAIL");
  });

  it("valorise le travail familial au prix du marché dans le coût de revient, sans toucher la trésorerie", () => {
    const r = calculerMainOeuvre({ ...base, prixHeure: { valeur: 500, source: "marché local d'essai" }, coutsDecaissesAn: 1_000_000, quantiteVendueAn: 1000 });
    const heures = r.totaux.heuresFamilleUtilisees;
    expect(r.valorisationFamille.montantAn).toBe(heures * 500);
    expect(r.valorisationFamille.impactTresorerie).toBe(0);
    expect(r.coutRevient.total).toBe(1_000_000 + heures * 500);
    expect(r.coutRevient.parUniteVendue).toBeGreaterThan(r.coutRevient.parUniteVendueSansFamille as number);
    expect(r.coutRevient.parUniteVendueSansFamille).toBe(1000);
  });

  it("sans prix de l'heure, rien n'est valorisé et le dit", () => {
    const r = calculerMainOeuvre({ ...base, coutsDecaissesAn: 1_000_000 });
    expect(r.valorisationFamille.statut).toBe("non_evalue");
    expect(r.valorisationFamille.montantAn).toBeNull();
    expect(r.coutRevient.statut).toBe("non_evalue");
    expect(r.controles.map((c) => c.code)).toContain("PRIX_HEURE_NON_RENSEIGNE");
  });

  it("norme de surface par actif : alerte au-dessus, non évaluée sans norme", () => {
    const sans = calculerMainOeuvre({ ...base, surfaceHa: 3 });
    expect(sans.norme.statut).toBe("non_evalue");
    expect(sans.controles.map((c) => c.code)).toContain("NORME_NON_EVALUEE");
    const trop = calculerMainOeuvre({ ...base, surfaceHa: 3, normeSurface: { valeur: 1, source: "norme d'essai" } });
    expect(trop.norme).toMatchObject({ statut: "evalue", actifs: 1.5, surfaceMaxHa: 1.5, ratio: 2 });
    expect(trop.controles.map((c) => c.code)).toContain("SURFACE_AU_DESSUS_NORME");
    const ok = calculerMainOeuvre({ ...base, surfaceHa: 1, normeSurface: { valeur: 1, source: "norme d'essai" } });
    expect(ok.controles.map((c) => c.code)).not.toContain("SURFACE_AU_DESSUS_NORME");
  });

  it("la norme n'est pas évaluée si la part d'actif d'un membre est inconnue", () => {
    const r = calculerMainOeuvre({
      ...base,
      membres: [{ id: "p", libelle: "Toi", type: "famille", heuresParMois: 100 }],
      surfaceHa: 1,
      normeSurface: { valeur: 1, source: "norme d'essai" },
    });
    expect(r.norme.statut).toBe("non_evalue");
  });

  it("signale des heures par tâche qui ne s'additionnent pas au besoin", () => {
    const r = calculerMainOeuvre({ ...base, taches: [{ libelle: "Tout", heuresParMois: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }] });
    expect(r.controles.map((c) => c.code)).toContain("TACHES_INCOHERENTES");
  });

  it("refuse des besoins qui ne font pas 12 mois et une norme sans source", () => {
    expect(() => calculerMainOeuvre({ ...base, besoinsHeuresParMois: [1, 2, 3] })).toThrow(ErreurMoteur);
    expect(() => calculerMainOeuvre({ ...base, normeSurface: { valeur: 1, source: "" } })).toThrow(ErreurMoteur);
  });
});
