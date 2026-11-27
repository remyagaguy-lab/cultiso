/** @jest-environment node */
// Contrôles du §3.6 portés par des champs optionnels des lignes (itinéraire, bande, pérennes, emploi, débouché, concentration).
// Sans la donnée, aucun de ces contrôles ne se déclenche ; sans seuil, la mesure est donnée sans jugement.
import { CODES_CONTROLE, type CodeControle, type Controle } from "../controles";
import { calculerFinances, type EntreeFinance } from "../finance";
import { tomate2ha } from "../test-utils/tomate";

const realiste = (e: EntreeFinance) => calculerFinances(e).scenarios.realiste;
const trouver = (c: Controle[], code: CodeControle) => c.filter((x) => x.code === code);

const avecCharge = (id: string, extra: Record<string, unknown>): EntreeFinance => ({
  ...tomate2ha,
  charges: tomate2ha.charges.map((c) => (c.id === id ? { ...c, ...extra } : c)),
});
const avecRevenu = (extra: Record<string, unknown>): EntreeFinance => ({
  ...tomate2ha,
  revenus: tomate2ha.revenus.map((r) => ({ ...r, ...extra })),
});

const NOUVEAUX: CodeControle[] = [
  "INTRANTS_ECART_ITINERAIRE", "CONSOMMATION_BANDE", "PERIODE_IMPRODUCTIVE", "MAIN_OEUVRE_SAISONNIERE",
  "MASSE_SALARIALE", "VOLUME_HORS_DEBOUCHE", "CONCENTRATION_CLIENT", "CONCENTRATION_FOURNISSEUR",
];

describe("contrôles du §3.6 sur lignes enrichies", () => {
  it("les codes sont déclarés", () => {
    for (const c of NOUVEAUX) expect(CODES_CONTROLE).toContain(c);
  });

  it("sans champ optionnel, aucun de ces contrôles", () => {
    const s = realiste(tomate2ha);
    for (const c of NOUVEAUX) expect(trouver(s.controles, c)).toHaveLength(0);
  });

  it("intrants : écart à l'itinéraire, mesure sans seuil, alerte avec seuil", () => {
    const e = avecCharge("engrais", { referenceItineraire: { quantite: 1, source: "fiche test" } });
    const sans = trouver(realiste(e).controles, "INTRANTS_ECART_ITINERAIRE");
    expect(sans).toHaveLength(1);
    expect(sans[0].niveau).toBe("info");
    expect(sans[0].valeurs).toMatchObject({ quantite: 2, quantiteItineraire: 1, ecart: 1, seuil: null });
    const avec = trouver(realiste({ ...e, seuilsControles: { ecartIntrants: 0.2 } }).controles, "INTRANTS_ECART_ITINERAIRE");
    expect(avec[0].niveau).toBe("alerte");
    const ok = trouver(realiste({ ...avecCharge("engrais", { referenceItineraire: { quantite: 2 } }), seuilsControles: { ecartIntrants: 0.2 } }).controles, "INTRANTS_ECART_ITINERAIRE");
    expect(ok[0].niveau).toBe("ok");
  });

  it("consommation : aliment budgété sur 7 mois pour une bande de 18", () => {
    const c = trouver(realiste(avecCharge("semences", { couverture: { moisCouverts: 7, dureeBandeMois: 18 } })).controles, "CONSOMMATION_BANDE");
    expect(c[0].niveau).toBe("alerte");
    expect(c[0].valeurs).toMatchObject({ moisCouverts: 7, dureeBandeMois: 18, quantiteNecessaire: 5.14 });
    const ok = trouver(realiste(avecCharge("semences", { couverture: { moisCouverts: 18, dureeBandeMois: 18 } })).controles, "CONSOMMATION_BANDE");
    expect(ok[0].niveau).toBe("ok");
  });

  it("pérenne : période improductive à déclarer, production comptée trop tôt signalée", () => {
    const non = trouver(realiste(avecRevenu({ perenne: {} })).controles, "PERIODE_IMPRODUCTIVE");
    expect(non[0].niveau).toBe("alerte");
    const trois = trouver(realiste(avecRevenu({ perenne: { anneeEntreeProduction: 3 } })).controles, "PERIODE_IMPRODUCTIVE");
    expect(trois[0].niveau).toBe("info");
    expect(trois[0].valeurs).toMatchObject({ anneeEntreeProduction: 3, anneesSansProduction: [1, 2] });
    const un = trouver(realiste(avecRevenu({ perenne: { anneeEntreeProduction: 1 } })).controles, "PERIODE_IMPRODUCTIVE");
    expect(un[0].niveau).toBe("info");
  });

  it("saisonniers payés 12 mois", () => {
    const e = avecCharge("mo", { emploi: { effectif: 5, saisonnier: true } });
    expect(trouver(realiste(e).controles, "MAIN_OEUVRE_SAISONNIERE")[0].niveau).toBe("alerte");
    const horsSaison = avecCharge("mo", { moisDecaissement: [1, 2, 8], emploi: { effectif: 5, saisonnier: true, moisTravailles: [1, 2, 3] } });
    const c = trouver(realiste(horsSaison).controles, "MAIN_OEUVRE_SAISONNIERE")[0];
    expect(c.niveau).toBe("alerte");
    expect(c.valeurs).toMatchObject({ moisPayesSansTravail: [8] });
    const bon = avecCharge("mo", { moisDecaissement: [1, 2, 3], emploi: { effectif: 5, saisonnier: true, moisTravailles: [1, 2, 3] } });
    expect(trouver(realiste(bon).controles, "MAIN_OEUVRE_SAISONNIERE")[0].niveau).toBe("ok");
  });

  it("masse salariale : 5 ouvriers à 65 000 par mois, 390 000 au budget", () => {
    const e = avecCharge("mo", { quantite: 1, prixUnitaire: 390_000, base: "an", moisDecaissement: [1, 2, 3, 4, 5, 6], emploi: { effectif: 5, salaireMensuel: 65_000, saisonnier: false } });
    const sans = trouver(realiste(e).controles, "MASSE_SALARIALE")[0];
    expect(sans.niveau).toBe("info");
    expect(sans.valeurs).toMatchObject({ montantAnnuel: 390_000, attendu: 1_950_000, mois: 6 });
    expect(trouver(realiste({ ...e, seuilsControles: { ecartMasseSalariale: 0.1 } }).controles, "MASSE_SALARIALE")[0].niveau).toBe("alerte");
    const juste = avecCharge("mo", { quantite: 1, prixUnitaire: 1_950_000, base: "an", moisDecaissement: [1, 2, 3, 4, 5, 6], emploi: { effectif: 5, salaireMensuel: 65_000, saisonnier: false } });
    expect(trouver(realiste(juste).controles, "MASSE_SALARIALE")[0].niveau).toBe("ok");
  });

  it("volume vendable contre débouché : pertes déduites", () => {
    // Réaliste : 30 000 × 0,7 = 21 000 vendables.
    const trop = trouver(realiste(avecRevenu({ debouche: { volumeAbsorbable: 15_000 } })).controles, "VOLUME_HORS_DEBOUCHE")[0];
    expect(trop.niveau).toBe("alerte");
    expect(trop.valeurs).toMatchObject({ volumeVendable: 21_000, volumeAbsorbable: 15_000 });
    expect(trouver(realiste(avecRevenu({ debouche: { volumeAbsorbable: 25_000 } })).controles, "VOLUME_HORS_DEBOUCHE")[0].niveau).toBe("ok");
  });

  it("concentration client : mesure sans seuil, alerte au-dessus du seuil", () => {
    const e: EntreeFinance = {
      ...tomate2ha,
      revenus: [
        { ...tomate2ha.revenus[0], quantite: { pessimiste: 10, realiste: 100, optimiste: 200 }, pertes: 0, prixUnitaire: 1000, client: "Marché de Lomé" },
        { id: "autre", libelle: "Autre", typeRevenu: "coproduit", quantite: { pessimiste: 1, realiste: 25, optimiste: 40 }, prixUnitaire: 1000, client: "Grossiste B" },
      ],
    };
    const sans = trouver(realiste(e).controles, "CONCENTRATION_CLIENT")[0];
    expect(sans.niveau).toBe("info");
    expect(sans.valeurs).toMatchObject({ nom: "Marché de Lomé", part: 0.8, seuil: null });
    expect(trouver(realiste({ ...e, seuilsControles: { concentrationMax: 0.5 } }).controles, "CONCENTRATION_CLIENT")[0].niveau).toBe("alerte");
    expect(trouver(realiste({ ...e, seuilsControles: { concentrationMax: 0.9 } }).controles, "CONCENTRATION_CLIENT")[0].niveau).toBe("ok");
  });

  it("concentration fournisseur : part des achats d'exploitation", () => {
    const e = { ...tomate2ha, seuilsControles: { concentrationMax: 0.3 }, charges: tomate2ha.charges.map((c) => (c.id === "semences" || c.id === "engrais" ? { ...c, fournisseur: "Agro Plus" } : c)) };
    // Exploitation : 300 000 + 400 000 + 500 000 + 120 000 = 1 320 000 ; Agro Plus 700 000.
    const c = trouver(realiste(e).controles, "CONCENTRATION_FOURNISSEUR")[0];
    expect(c.niveau).toBe("alerte");
    expect(c.valeurs).toMatchObject({ nom: "Agro Plus", part: 0.5303 });
  });
});
