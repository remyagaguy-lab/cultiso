import { calculerFinances } from "@/moteurs";
import type { LigneChargeBudget, LigneRevenuBudget } from "@/moteurs/budget";
import type { ItineraireMensuel, ProfilPluriannuel } from "@/referentiel/calendrier";
import { appliquerCalendrier, type CalendrierReferentiel } from "../calendrier";
import { moteurObsolete } from "../service";

const trace = { atelierId: "a1", modeleId: null, unite: "u", origine: "estimation" as const, sourcePrix: null };
const charge = (id: string, typeCharge: string, extra: object = {}): LigneChargeBudget => ({ id, libelle: id, typeCharge, quantite: 1, prixUnitaire: 120_000, nature: "variable", classe: "exploitation", base: "cycle", cyclesParAn: 1, ...trace, ...extra });
const revenu = (extra: object = {}): LigneRevenuBudget => ({ id: "r", libelle: "Vente", typeRevenu: "principal", quantite: { pessimiste: 100, realiste: 100, optimiste: 100 }, prixUnitaire: 1_000, base: "cycle", cyclesParAn: 1, pertes: 0, ...trace, ...extra });
const itineraire = (extra: Partial<ItineraireMensuel> = {}): ItineraireMensuel => ({
  variante: "essai",
  partCouts: [{ typeCharge: "intrants", parts: [0.5, 0.5] }, { typeCharge: null, parts: [0.25, 0.25, 0.25, 0.25] }],
  heuresParUnite: null,
  partRecolte: [0, 0, 0, 0, 1],
  sources: ["Document d'essai"],
  statut: "brouillon_ia",
  avertissements: [],
  ...extra,
});
const profil = (extra: Partial<ProfilPluriannuel> = {}): ProfilPluriannuel => ({
  variante: "essai", type: "perenne", coefficientRendement: {}, tauxUtilisation: {}, declarationObligatoire: true, source: "Document d'essai", dateSource: "2026-11-27", statut: "brouillon_ia", ...extra,
});
const ref = (e: Partial<CalendrierReferentiel> = {}): CalendrierReferentiel => ({ itineraires: {}, profils: {}, indisponibles: [], ...e });
const ateliers = [{ atelierId: "a1", speculationCode: "x" }];

describe("R1 : le profil mensuel du référentiel est posé sur les lignes de l'atelier", () => {
  it("les coûts suivent leur type de charge (sinon le profil général), les ventes suivent la récolte, et le moteur les place sur la grille", () => {
    const charges = [charge("semences", "intrants"), charge("mo", "main_oeuvre")];
    const revenus = [revenu()];
    const r = appliquerCalendrier(charges, revenus, ateliers, ref({ itineraires: { x: [itineraire()] } }));
    expect(charges[0].calendrier).toMatchObject({ debutMois: 1, parts: [0.5, 0.5] });
    expect(charges[1].calendrier?.parts).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(revenus[0].calendrier?.parts).toEqual([0, 0, 0, 0, 1]);
    expect(r.notes.join(" ")).toContain("itinéraire du référentiel");
    const s = calculerFinances({ charges, revenus, horizonAnnees: 1 }).scenarios.realiste;
    expect(s.grille.lignes.find((l) => l.id === "r")!.mensuel[5]).toBe(100_000);
    expect(s.grille.lignes.find((l) => l.id === "semences")!.mensuel.slice(1, 3)).toEqual([60_000, 60_000]);
    expect(s.pointBasTresorerie.mois).toBe(4);
  });

  it("sans itinéraire dans le référentiel, les lignes gardent leur ancien calendrier", () => {
    const charges = [charge("semences", "intrants", { moisDecaissement: [1] })];
    appliquerCalendrier(charges, [revenu()], ateliers, ref());
    expect(charges[0].calendrier).toBeUndefined();
  });

  it("plusieurs variantes sans choix : rien n'est appliqué et la liste est rendue ; avec un choix, la variante voulue", () => {
    const deux = ref({ itineraires: { x: [itineraire({ variante: "a" }), itineraire({ variante: "b", partRecolte: [1] })] } });
    const charges = [charge("semences", "intrants")];
    const revenus = [revenu()];
    const r = appliquerCalendrier(charges, revenus, ateliers, deux);
    expect(r.aChoisir).toEqual([{ speculationCode: "x", type: "itineraire", variantes: ["a", "b"] }]);
    expect(revenus[0].calendrier).toBeUndefined();
    appliquerCalendrier(charges, revenus, ateliers, deux, { x: "b" });
    expect(revenus[0].calendrier?.parts).toEqual([1]);
  });

  it("une lecture impossible du référentiel est dite, pas cachée", () => {
    const r = appliquerCalendrier([], [], ateliers, ref({ indisponibles: ["Le référentiel calendaire n'est pas lisible pour x (table absente)."] }));
    expect(r.notes[0]).toContain("pas lisible");
  });
});

describe("R4 : profil pluriannuel et montée en production", () => {
  it("un pérenne sans mois improductifs oblige la déclaration (alerte du moteur) ; avec des mois, l'entrée en production est déduite", () => {
    const sans = [revenu()];
    appliquerCalendrier([], sans, ateliers, ref({ profils: { x: [profil()] } }));
    expect(sans[0].perenne).toEqual({});
    const avec = [revenu()];
    appliquerCalendrier([], avec, ateliers, ref({ profils: { x: [profil({ moisImproductifs: 30 })] } }));
    expect(avec[0].perenne).toEqual({ anneeEntreeProduction: 3 });
    const cheptel = [revenu()];
    appliquerCalendrier([], cheptel, ateliers, ref({ profils: { x: [profil({ type: "cheptel", moisImproductifs: 6 })] } }));
    expect(cheptel[0].perenne).toEqual({ anneeEntreeProduction: 1 });
  });

  it("une annuelle n'est pas déclarée ; une déclaration déjà faite n'est pas écrasée", () => {
    const a = [revenu()];
    appliquerCalendrier([], a, ateliers, ref({ profils: { x: [profil({ type: "annuelle", declarationObligatoire: false })] } }));
    expect(a[0].perenne).toBeUndefined();
    const b = [revenu({ perenne: { anneeEntreeProduction: 4 } })];
    appliquerCalendrier([], b, ateliers, ref({ profils: { x: [profil({ moisImproductifs: 6 })] } }));
    expect(b[0].perenne).toEqual({ anneeEntreeProduction: 4 });
  });

  it("les coefficients par année deviennent la montée de l'atelier ; une année manquante les fait écarter", () => {
    const ok = appliquerCalendrier([], [revenu()], ateliers, ref({ profils: { x: [profil({ coefficientRendement: { 1: 0, 2: 0.5, 3: 1 }, tauxUtilisation: { 1: 0.5, 2: 1 } })] } }));
    expect(ok.montee).toEqual([{ atelierId: "a1", coefficientsRendement: [0, 0.5, 1], tauxUtilisation: [0.5, 1], origine: "ref, variante essai (brouillon_ia)" }]);
    const trou = appliquerCalendrier([], [revenu()], ateliers, ref({ profils: { x: [profil({ coefficientRendement: { 1: 0, 3: 1 } })] } }));
    expect(trou.montee).toEqual([]);
    expect(trou.notes.join(" ")).toContain("années manquantes");
  });

  it("sans profil dans le référentiel, le plan le dit au lieu de supposer une production immédiate sans le signaler", () => {
    const r = appliquerCalendrier([], [revenu()], ateliers, ref());
    expect(r.notes.join(" ")).toContain("dès la première année");
  });

  it("de bout en bout : un verger déclaré de l'an 3, avec montée, ne vend rien avant et le point bas se creuse", () => {
    const revenus = [revenu({ base: "an" })];
    const charges = [charge("entretien", "intrants", { base: "an", nature: "fixe", prixUnitaire: 20_000 })];
    const r = appliquerCalendrier(charges, revenus, ateliers, ref({ profils: { x: [profil({ moisImproductifs: 24, coefficientRendement: { 1: 0, 2: 0, 3: 0.5, 4: 1 } })] } }));
    const s = calculerFinances({ charges, revenus, montee: r.montee, horizonAnnees: 5 }).scenarios.realiste;
    expect(s.annees.map((a) => a.chiffreAffaires)).toEqual([0, 0, 50_000, 100_000, 100_000]);
    expect(s.pointBasTresorerie.an).toBe(2);
    expect(s.controles.find((c) => c.code === "PERIODE_IMPRODUCTIVE")).toMatchObject({ niveau: "info", valeurs: { anneeEntreeProduction: 3 } });
  });
});

describe("plans calculés par un ancien moteur", () => {
  it("sont marqués obsolètes quand la version majeure est plus ancienne ; un plan jamais calculé ne l'est pas", () => {
    expect(moteurObsolete("1.8.0")).toBe(true);
    expect(moteurObsolete("2.0.0")).toBe(false);
    expect(moteurObsolete("2.3.1")).toBe(false);
    expect(moteurObsolete(null)).toBe(false);
  });
});
