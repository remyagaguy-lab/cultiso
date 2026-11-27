import { calculerFinances, ErreurMoteur } from "@/moteurs";
import { versCircuit } from "@/referentiel/debouches";
import { ErreurReferentiel } from "@/referentiel";
import { analyserDebouches, debouchePourDimensionnement, type CircuitRef, type EntreeDebouches } from "../debouches";

const circuitsRef: CircuitRef[] = [
  { code: "bord_champ", libelle: "Vente au bord du champ", contractuel: false },
  { code: "marche_local", libelle: "Marché local", contractuel: false },
  { code: "grossiste", libelle: "Grossiste", contractuel: false },
  { code: "contrat", libelle: "Contrat avec un acheteur", contractuel: true },
];
const volumeAn = { pessimiste: 800, realiste: 1000, optimiste: 1200 };
const base: EntreeDebouches = {
  produit: "Tomate",
  unite: "kg",
  volumeAn,
  circuits: [
    { circuit: "marche_local", part: 0.5, client: "Revendeuses du marché", prix: 300 },
    { circuit: "grossiste", part: 0.3, client: "Grossiste A", prix: 250 },
  ],
};

describe("débouchés (R3)", () => {
  it("répartit le volume, calcule les recettes et signale le volume non vendu", () => {
    const r = analyserDebouches(base, circuitsRef);
    expect(r.partRepartie).toBe(0.8);
    expect(r.volumeVendu).toBe(800);
    expect(r.volumeNonVendu).toBe(200);
    expect(r.partNonVendue).toBe(0.2);
    expect(r.recettesAn).toBe(500 * 300 + 300 * 250);
    expect(r.controles.find((c) => c.code === "VOLUME_NON_VENDU")?.valeurs.volumeNonVendu).toBe(200);
    expect(r.circuits[0].partRecettes).toBeCloseTo(150_000 / 225_000, 3);
    expect(r.concentration.premierClient).toBe("Revendeuses du marché");
    expect(r.concentration.partNonAttribuee).toBe(0);
  });

  it("refuse plus de 100 % du volume réparti (bloquant)", () => {
    const r = analyserDebouches({ ...base, circuits: [{ circuit: "marche_local", part: 0.7, prix: 300 }, { circuit: "grossiste", part: 0.5, prix: 250 }] }, circuitsRef);
    expect(r.controles.find((c) => c.code === "PARTS_SUPERIEURES_A_UN")?.niveau).toBe("bloquant");
    expect(r.volumeVendu).toBe(1000);
  });

  it("prix par saison : une ligne de revenu par saison, saisonnalité visible mois par mois", () => {
    const r = analyserDebouches(
      {
        ...base,
        moisVente: [1, 2, 3, 4],
        circuits: [{ circuit: "marche_local", part: 1, prix: [{ mois: [1, 2], prix: 400 }, { mois: [3, 4], prix: 200 }] }],
      },
      circuitsRef,
    );
    expect(r.lignesRevenu).toHaveLength(2);
    expect(r.lignesRevenu[0].moisVente).toEqual([1, 2]);
    expect(r.lignesRevenu[0].quantite.realiste).toBe(500);
    expect(r.circuits[0].prixParMois.slice(0, 5)).toEqual([400, 400, 200, 200, null]);
    expect(r.circuits[0]).toMatchObject({ prixMin: 200, prixMax: 400, prixMoyen: 300 });
    expect(r.recettesAn).toBe(500 * 400 + 500 * 200);
  });

  it("refuse un mois de vente sans prix", () => {
    expect(() =>
      analyserDebouches({ ...base, moisVente: [1, 2, 3], circuits: [{ circuit: "marche_local", part: 1, prix: [{ mois: [1], prix: 400 }] }] }, circuitsRef),
    ).toThrow(/mois de vente 2, 3/);
  });

  it("refuse un circuit inconnu, un circuit en double, un contrat sur un circuit non contractuel, un circuit sans prix", () => {
    expect(() => analyserDebouches({ ...base, circuits: [{ circuit: "inconnu", part: 1, prix: 1 }] }, circuitsRef)).toThrow(/inconnu du référentiel/);
    expect(() => analyserDebouches({ ...base, circuits: [{ circuit: "grossiste", part: 0.5, prix: 1 }, { circuit: "grossiste", part: 0.5, prix: 1 }] }, circuitsRef)).toThrow(ErreurMoteur);
    expect(() =>
      analyserDebouches({ ...base, circuits: [{ circuit: "grossiste", part: 1, contrat: { volumeFixe: 1, prixFixe: 1, acheteur: "X", source: "contrat" } }] }, circuitsRef),
    ).toThrow(/pas contractuel/);
    expect(() => analyserDebouches({ ...base, circuits: [{ circuit: "grossiste", part: 1 }] }, circuitsRef)).toThrow(ErreurMoteur);
  });

  describe("débouché contractuel", () => {
    const avecContrat: EntreeDebouches = {
      ...base,
      circuits: [
        {
          circuit: "contrat",
          part: 0.6,
          contrat: { volumeFixe: 500, prixFixe: 280, servicesDeduits: [{ libelle: "semences", montantParUnite: 30 }, { libelle: "transport", montantParUnite: 10 }], acheteur: "Coopérative Z", source: "contrat signé d'essai" },
        },
        { circuit: "marche_local", part: 0.4, client: "Marché", prix: 350, sourcePrix: "relevé d'essai" },
      ],
    };

    it("prix net des services déduits, volume fixé, risque de vente parallèle si le marché paie plus", () => {
      const r = analyserDebouches(avecContrat, circuitsRef);
      const k = r.contrats[0];
      expect(k).toMatchObject({ paiementNetParUnite: 240, servicesDeduitsParUnite: 40, volumeFixe: 500, deductionsAn: 20_000, paiementNetAn: 120_000 });
      expect(k.margeVolume).toBe(100);
      expect(k.ecartPrixMarche).toBeCloseTo((350 - 240) / 240, 3);
      const codes = r.controles.map((c) => c.code);
      expect(codes).toContain("RISQUE_VENTE_PARALLELE");
      expect(codes).toContain("SERVICES_DEDUITS_A_RETIRER_DES_CHARGES");
      // 600 confiés pour 500 fixés : couvert en réaliste (information seulement pour le pessimiste, 480), mais 100 au-dessus du volume du contrat
      expect(r.controles.find((c) => c.code === "CONTRAT_NON_COUVERT")?.niveau).toBe("info");
      expect(codes).toContain("AU_DESSUS_DU_DEBOUCHE");
      // la ligne de revenu du contrat porte le prix net, le volume fixé comme débouché et l'acheteur
      const ligne = r.lignesRevenu.find((l) => l.id.endsWith("contrat"))!;
      expect(ligne).toMatchObject({ prixUnitaire: 240, client: "Coopérative Z", debouche: { volumeAbsorbable: 500 } });
    });

    it("pas de risque de vente parallèle quand le marché paie moins ; contrat non couvert si le volume confié est trop petit", () => {
      const moins = analyserDebouches({ ...avecContrat, circuits: [avecContrat.circuits[0], { circuit: "marche_local", part: 0.4, prix: 200 }] }, circuitsRef);
      expect(moins.controles.map((c) => c.code)).not.toContain("RISQUE_VENTE_PARALLELE");
      const court = analyserDebouches({ ...avecContrat, circuits: [{ ...avecContrat.circuits[0], part: 0.4 }, avecContrat.circuits[1]] }, circuitsRef);
      const c = court.controles.find((x) => x.code === "CONTRAT_NON_COUVERT");
      expect(c?.niveau).toBe("alerte");
      expect(c?.valeurs.manque).toBe(100);
    });

    it("dans un mauvais scénario seulement : information", () => {
      const r = analyserDebouches({ ...avecContrat, circuits: [{ ...avecContrat.circuits[0], part: 0.55 }, avecContrat.circuits[1]] }, circuitsRef);
      // réaliste 550 ≥ 500 ; pessimiste 440 < 500
      expect(r.controles.find((c) => c.code === "CONTRAT_NON_COUVERT")?.niveau).toBe("info");
    });
  });

  describe("branchement sur le moteur financier", () => {
    it("VOLUME_HORS_DEBOUCHE et CONCENTRATION_CLIENT se déclenchent sur les lignes produites", () => {
      const r = analyserDebouches(
        {
          ...base,
          circuits: [
            { circuit: "marche_local", part: 0.7, client: "Marché", prix: 300, volumeAbsorbable: 500 },
            { circuit: "grossiste", part: 0.3, client: "Grossiste A", prix: 250 },
          ],
        },
        circuitsRef,
      );
      const f = calculerFinances({
        charges: [{ id: "c1", libelle: "Semences", typeCharge: "intrants", quantite: 1, prixUnitaire: 50_000, nature: "variable", classe: "exploitation" }],
        revenus: r.lignesRevenu,
        horizonAnnees: 1,
        seuilsControles: { concentrationMax: 0.5 },
      });
      const controles = f.scenarios.realiste.controles;
      expect(controles.find((c) => c.code === "VOLUME_HORS_DEBOUCHE")?.niveau).toBe("alerte");
      const conc = controles.find((c) => c.code === "CONCENTRATION_CLIENT");
      expect(conc?.niveau).toBe("alerte");
      expect(f.scenarios.realiste.annees[0].chiffreAffaires).toBe(r.recettesAn);
    });
  });

  describe("volume vendable pour le dimensionnement (M13)", () => {
    it("donne le volume vendu par mois, avec l'origine et la source de l'appelant", () => {
      const r = analyserDebouches({ ...base, moisVente: [1, 2, 3, 4, 5, 6, 7, 8] }, circuitsRef);
      const d = debouchePourDimensionnement(r, { moisVente: [1, 2, 3, 4, 5, 6, 7, 8], source: "étude de marché d'essai" });
      expect(d).toEqual({ volumeParMois: 100, moisParAn: 8, unite: "kg", origine: "marche", source: "étude de marché d'essai" });
    });

    it("origine « contrat » quand tout le volume vendu est sous contrat", () => {
      const r = analyserDebouches(
        { ...base, circuits: [{ circuit: "contrat", part: 1, contrat: { volumeFixe: 1000, prixFixe: 250, acheteur: "Z", source: "contrat d'essai" } }] },
        circuitsRef,
      );
      expect(debouchePourDimensionnement(r, { source: "contrat d'essai" }).origine).toBe("contrat");
    });
  });
});

describe("circuits du référentiel", () => {
  const ligne = { code: "grossiste", libelle: "Grossiste", description: null, contractuel: false, ordre: 3, source: "ANALYSE §4.1", statut: "brouillon_ia", valide_le: null, valide_par: null, created_at: "", updated_at: "" };
  it("valide chaque ligne lue", () => {
    expect(versCircuit(ligne).code).toBe("grossiste");
    expect(() => versCircuit({ ...ligne, code: "Mauvais Code" })).toThrow(ErreurReferentiel);
    expect(() => versCircuit({ ...ligne, source: "" })).toThrow(ErreurReferentiel);
  });
});
