import { assemblerFiches, assemblerItineraires, assemblerProfils } from "../calendrier";

const base = { source: "Document de test (p. 1)", statut: "brouillon_ia" as const };

describe("itinéraires calendaires : assemblage (R1)", () => {
  it("assemble une fiche technique avec fourchette, système et opération datée", () => {
    const [f] = assemblerFiches([
      { variante: "v", code: "densite", phase: null, systeme: null, intrant: null, valeur_min: 66600, valeur_max: null, unite: "pieds par ha", repere: null, jours_apres_repere: null, date_source: "2026-11-27", ...base },
      { variante: "v", code: "fumure_couverture", phase: null, systeme: null, intrant: "urée", valeur_min: 50, valeur_max: null, unite: "kg par ha", repere: "repiquage", jours_apres_repere: 20, date_source: "2026-11-27", ...base },
      { variante: "v", code: "delai_recolte", phase: null, systeme: null, intrant: null, valeur_min: 90, valeur_max: 105, unite: "jours", repere: "repiquage", jours_apres_repere: null, date_source: "2026-11-27", ...base, statut: "validee" },
    ]);
    expect(f.valeurs).toHaveLength(3);
    expect(f.valeurs[1]).toMatchObject({ code: "fumure_couverture", intrant: "urée", repere: "repiquage", joursApresRepere: 20 });
    expect(f.valeurs[2]).toMatchObject({ min: 90, max: 105 });
    expect(f.statut).toBe("brouillon_ia");
  });

  it("refuse une fiche incohérente avec la variante et le code", () => {
    expect(() =>
      assemblerFiches([{ variante: "v", code: "densite", phase: null, systeme: null, intrant: null, valeur_min: -1, valeur_max: null, unite: "x", repere: null, jours_apres_repere: null, date_source: "2026-11-27", ...base }]),
    ).toThrow(/fiche technique v\/densite/);
  });

  it("un profil mensuel de somme 1 est retenu, par type de charge, avec les heures et la récolte", () => {
    const l = (grandeur: "part_couts" | "heures_par_unite" | "part_recolte", mois: number, valeur: number, type: string | null = null) => ({ variante: "v", mois_cycle: mois, grandeur, type_charge: type, valeur, ...base });
    const [it] = assemblerItineraires([
      l("part_couts", 1, 0.6, "intrants"), l("part_couts", 2, 0.4, "intrants"),
      l("part_couts", 1, 0.5), l("part_couts", 3, 0.5),
      l("heures_par_unite", 1, 100), l("heures_par_unite", 2, 40),
      l("part_recolte", 3, 0.5), l("part_recolte", 4, 0.5),
    ]);
    expect(it.partCouts).toContainEqual({ typeCharge: "intrants", parts: [0.6, 0.4] });
    expect(it.partCouts).toContainEqual({ typeCharge: null, parts: [0.5, 0, 0.5] });
    expect(it.heuresParUnite).toEqual([100, 40]);
    expect(it.partRecolte).toEqual([0, 0, 0.5, 0.5]);
    expect(it.avertissements).toEqual([]);
  });

  it("un profil dont la somme n'est pas 1 est écarté et signalé, jamais corrigé", () => {
    const [it] = assemblerItineraires([
      { variante: "v", mois_cycle: 1, grandeur: "part_recolte", type_charge: null, valeur: 0.6, ...base },
      { variante: "v", mois_cycle: 2, grandeur: "part_recolte", type_charge: null, valeur: 0.3, ...base },
    ]);
    expect(it.partRecolte).toBeNull();
    expect(it.avertissements[0]).toContain("0.9000");
  });
});

describe("profil pluriannuel (R4)", () => {
  it("le cheptel et le pérenne exigent la déclaration ; l'annuelle non ; les années inconnues restent absentes", () => {
    const profils = assemblerProfils(
      [
        { variante: "a", type_profil: "cheptel", mois_improductifs: 6, annees_plein_regime: null, date_source: "2026-11-27", ...base },
        { variante: "b", type_profil: "annuelle", mois_improductifs: null, annees_plein_regime: null, date_source: "2026-11-27", ...base },
        { variante: "c", type_profil: "perenne", mois_improductifs: null, annees_plein_regime: 4, date_source: "2026-11-27", ...base },
      ],
      [
        { variante: "c", annee: 1, grandeur: "coefficient_rendement", valeur: 0, statut: "a_valider" },
        { variante: "c", annee: 3, grandeur: "coefficient_rendement", valeur: 0.5, statut: "brouillon_ia" },
        { variante: "c", annee: 3, grandeur: "taux_utilisation", valeur: 0.8, statut: "brouillon_ia" },
        { variante: "zz", annee: 1, grandeur: "coefficient_rendement", valeur: 1, statut: "brouillon_ia" },
      ],
    );
    const par = Object.fromEntries(profils.map((p) => [p.variante, p]));
    expect(par.a).toMatchObject({ declarationObligatoire: true, moisImproductifs: 6 });
    expect(par.b.declarationObligatoire).toBe(false);
    expect(par.c.coefficientRendement).toEqual({ 1: 0, 3: 0.5 });
    expect(par.c.tauxUtilisation).toEqual({ 3: 0.8 });
    expect(par.c.anneesPleinRegime).toBe(4);
    expect(par.zz).toBeUndefined();
  });
});
