/** @jest-environment node */
// M4 : contrôles nommés et ratios, sur le cas « 2 ha de tomate » (test-utils/tomate.ts).
// Coût du projet : motopompe 600 000 + BFR 855 000 = 1 455 000. Excédent brut : 1 830 000 par an.
import { CODES_CONTROLE, enFcfa, normaliserLibelle, type CodeControle, type Controle } from "../controles";
import { calculerFinances, type EntreeFinance } from "../finance";
import { tomate2ha } from "../test-utils/tomate";

const realiste = (e: EntreeFinance) => calculerFinances(e).scenarios.realiste;
const trouver = (controles: Controle[], code: CodeControle) => controles.filter((c) => c.code === code);
const un = (controles: Controle[], code: CodeControle) => {
  const liste = trouver(controles, code);
  expect(liste).toHaveLength(1);
  return liste[0];
};
const credit = (montant: number) => ({ montant, tauxAnnuel: 0.24, dureeMois: 12 });
const ANPGF = { nom: "ANPGF", apportMinimum: 0.2, source: "Canevas ANPGF §10.1 (brouillon_ia)" };

describe("M4 : contrôles du plan sans financement", () => {
  const s = realiste(tomate2ha);

  it("chaque contrôle a un code connu, un niveau, des valeurs et une phrase", () => {
    for (const c of s.controles) {
      expect(CODES_CONTROLE).toContain(c.code);
      expect(["ok", "info", "alerte", "bloquant"]).toContain(c.niveau);
      expect(typeof c.valeurs).toBe("object");
      expect(c.message.length).toBeGreaterThan(20);
    }
  });

  it("trésorerie négative : les mois, le point bas et ce qu'il manque", () => {
    const c = un(s.controles, "TRESORERIE_NEGATIVE");
    expect(c.niveau).toBe("bloquant");
    expect(c.valeurs).toEqual({ mois: [0, 1, 2, 3], pointBas: -1_455_000, moisPointBas: 3 });
    expect(c.message).toContain("il manque 1 455 000 FCFA");
  });

  it("BFR non financé", () => {
    const c = un(s.controles, "BFR_NON_FINANCE");
    expect(c.niveau).toBe("bloquant");
    expect(c.valeurs).toEqual({ ressources: 0, investissement: 600_000, besoinFondsRoulement: 855_000, manque: 1_455_000 });
  });

  it("ménage non renseigné : une information, pas un verdict", () => {
    expect(un(s.controles, "MENAGE_NON_RENSEIGNE").niveau).toBe("info");
    expect(trouver(s.controles, "MENAGE_NON_COUVERT")).toHaveLength(0);
  });

  it("sans règle de financeur ni bornes, ces contrôles ne sont pas faits", () => {
    expect(trouver(s.controles, "APPORT_INSUFFISANT")).toHaveLength(0);
    expect(trouver(s.controles, "RENDEMENT_HORS_BORNES")).toHaveLength(0);
  });

  it("garanties du moteur : BFR compté une fois, pas amorti ; fin d'horizon rentable", () => {
    expect(un(s.controles, "VARIATION_BFR")).toMatchObject({ niveau: "ok", valeurs: { besoinFondsRoulement: 855_000, variations: [855_000, 0, 0] } });
    expect(un(s.controles, "BFR_AMORTI").niveau).toBe("ok");
    expect(un(s.controles, "DERNIERES_ANNEES_DEFICITAIRES").niveau).toBe("ok");
  });

  it("ratios", () => {
    expect(s.ratios).toEqual({ coutProjet: 1_455_000, endettement: null, dettesSurCaf: 0, chargesFinancieresSurCA: 0, partApport: 0 });
  });
});

describe("M4 : apport, crédit et ratios bancaires", () => {
  it("apport sous le seuil du financeur passé en paramètre", () => {
    const s = realiste({ ...tomate2ha, apport: 200_000, credit: credit(1_300_000), regleFinanceur: ANPGF });
    const c = un(s.controles, "APPORT_INSUFFISANT");
    expect(c.niveau).toBe("alerte");
    expect(c.valeurs).toMatchObject({ partApport: 0.1375, apportMinimum: 0.2, financeur: "ANPGF", manque: 91_000 });
    expect(c.message).toContain("ANPGF demande au moins 20 %");
    expect(c.message).toContain("Il manque 91 000 FCFA");
  });

  it("apport suffisant", () => {
    const s = realiste({ ...tomate2ha, apport: 300_000, credit: credit(1_200_000), regleFinanceur: ANPGF });
    expect(un(s.controles, "APPORT_INSUFFISANT")).toMatchObject({ niveau: "ok", valeurs: { partApport: 0.2062 } });
    expect(un(s.controles, "BFR_NON_FINANCE").niveau).toBe("ok");
    // Financé sur le papier, mais les échéances mensuelles commencent avant les ventes d'avril : la caisse passe sous zéro.
    expect(un(s.controles, "TRESORERIE_NEGATIVE")).toMatchObject({ niveau: "bloquant", valeurs: { mois: [3] } });
  });

  it("endettement, dettes / CAF, charges financières / CA, part d'apport", () => {
    const s = realiste({ ...tomate2ha, apport: 200_000, credit: credit(1_300_000) });
    const a1 = s.annees[0];
    expect(s.ratios.endettement).toBe(6.5);
    expect(s.ratios.dettesSurCaf).toBeCloseTo(1_300_000 / a1.cafNette, 4);
    expect(s.ratios.chargesFinancieresSurCA).toBeCloseTo(a1.interets / 3_150_000, 4);
    expect(s.ratios.partApport).toBe(0.1375);
  });

  it("crédit plus grand que tout le besoin : ressource sans doute comptée deux fois", () => {
    const s = realiste({ ...tomate2ha, credit: credit(2_000_000) });
    expect(un(s.controles, "RESSOURCE_EN_DOUBLE")).toMatchObject({ niveau: "alerte", valeurs: { credit: 2_000_000, coutProjet: 1_455_000 } });
    const leger = realiste({ ...tomate2ha, apport: 500_000, credit: credit(1_000_000) });
    expect(un(leger.controles, "RESSOURCE_EN_DOUBLE")).toMatchObject({ niveau: "info" });
    expect(un(leger.controles, "RESSOURCE_EN_DOUBLE").message).toContain("45 000 FCFA");
  });
});

describe("M4 : ménage et années déficitaires", () => {
  const menage = (prelevementsAnnuels: number) => ({ prelevementsAnnuels, revenusExterieursAnnuels: 300_000 });

  it("ménage couvert, mais pas les échéances", () => {
    const s = realiste({ ...tomate2ha, apport: 455_000, credit: credit(1_000_000), menage: menage(1_500_000) });
    const c = un(s.controles, "MENAGE_NON_COUVERT");
    expect(c).toMatchObject({ niveau: "bloquant", valeurs: { annees: [1], soldeResiduelMin: -504_715, capaciteMin: 630_000 } });
    expect(c.message).toContain("ne laisse pas de quoi payer les échéances");
  });

  it("ménage non couvert même sans crédit", () => {
    const s = realiste({ ...tomate2ha, apport: 1_455_000, menage: menage(2_500_000) });
    const c = un(s.controles, "MENAGE_NON_COUVERT");
    expect(c.valeurs).toMatchObject({ annees: [1, 2, 3], capaciteMin: -370_000 });
    expect(c.message).toContain("Même sans crédit");
  });

  it("ménage couvert", () => {
    const s = realiste({ ...tomate2ha, apport: 1_605_000, menage: menage(900_000) });
    expect(un(s.controles, "MENAGE_NON_COUVERT")).toMatchObject({ niveau: "ok", valeurs: { annees: [], soldeResiduelMin: 1_230_000 } });
  });

  it("deux dernières années déficitaires", () => {
    const s = realiste({ ...tomate2ha, revenus: [{ ...tomate2ha.revenus[0], prixUnitaire: 50 }] });
    expect(un(s.controles, "DERNIERES_ANNEES_DEFICITAIRES")).toMatchObject({ niveau: "bloquant", valeurs: { annees: [2, 3] } });
    const unAn = realiste({ ...tomate2ha, horizonAnnees: 1, revenus: [{ ...tomate2ha.revenus[0], prixUnitaire: 50 }] });
    expect(un(unAn.controles, "DERNIERES_ANNEES_DEFICITAIRES").valeurs).toMatchObject({ annees: [1] });
  });
});

describe("M4 : rendement borné par le référentiel", () => {
  const borne = (bornesQuantite: { min?: number; max?: number; source?: string }) => ({
    ...tomate2ha,
    revenus: [{ ...tomate2ha.revenus[0], bornesQuantite }],
  });

  it("au-dessus du maximum connu, par scénario", () => {
    const r = calculerFinances(borne({ min: 10_000, max: 25_000, source: "ref, brouillon_ia" }));
    const c = un(r.scenarios.realiste.controles, "RENDEMENT_HORS_BORNES");
    expect(c).toMatchObject({ niveau: "alerte", valeurs: { ligneId: "tomate", quantite: 30_000, min: 10_000, max: 25_000, source: "ref, brouillon_ia" } });
    expect(c.message).toContain("dépasse le maximum connu (25 000)");
    expect(un(r.scenarios.pessimiste.controles, "RENDEMENT_HORS_BORNES").niveau).toBe("ok");
  });

  it("sous le minimum : une simple information", () => {
    expect(un(realiste(borne({ min: 35_000 })).controles, "RENDEMENT_HORS_BORNES").niveau).toBe("info");
  });
});

describe("M4 : incohérences des plans réels (§3.6)", () => {
  const charge = tomate2ha.charges[0];

  it("BFR ou imprévus amortis comme du matériel", () => {
    const s = realiste({
      ...tomate2ha,
      charges: [...tomate2ha.charges, { id: "bfr", libelle: "Fonds de roulement", typeCharge: "infrastructures", quantite: 1, prixUnitaire: 300_000, nature: "fixe", classe: "investissement", dureeVieAns: 3 }],
    });
    expect(un(s.controles, "BFR_AMORTI")).toMatchObject({ niveau: "alerte", valeurs: { lignes: ["bfr"] } });
  });

  it("un poste, une seule source", () => {
    const s = realiste({
      ...tomate2ha,
      credit: credit(1_000_000),
      impotsAnnuels: 50_000,
      salairesAnnuels: 240_000,
      charges: [
        ...tomate2ha.charges,
        { ...charge, id: "semences-bis", libelle: "semences" },
        { id: "agios", libelle: "Agios", typeCharge: "frais_financiers", quantite: 1, prixUnitaire: 100_000, base: "an", nature: "fixe", classe: "exploitation" },
        { id: "patente", libelle: "Patente et taxes", typeCharge: "infrastructures", quantite: 1, prixUnitaire: 50_000, base: "an", nature: "fixe", classe: "exploitation" },
        { id: "gardien", libelle: "Gardien", typeCharge: "main_oeuvre", quantite: 1, prixUnitaire: 360_000, base: "an", nature: "fixe", classe: "exploitation" },
      ],
    });
    const postes = trouver(s.controles, "POSTE_EN_DOUBLE").map((c) => [c.valeurs.poste, c.valeurs.lignes, c.niveau]);
    expect(postes).toEqual([
      ["Semences", ["semences", "semences-bis"], "alerte"],
      ["frais_financiers", ["agios"], "alerte"],
      ["impots", ["patente"], "alerte"],
      ["salaires", ["gardien"], "info"],
    ]);
  });

  it("unités et périodes : mois en double, salaire fixe payé une fois par an", () => {
    const s = realiste({
      ...tomate2ha,
      charges: [
        { ...charge, moisDecaissement: [2, 2] },
        { id: "chef", libelle: "Chef de culture", typeCharge: "main_oeuvre", quantite: 1, prixUnitaire: 80_000, base: "an", nature: "fixe", classe: "exploitation", moisDecaissement: [12] },
      ],
    });
    expect(trouver(s.controles, "UNITE_PERIODE").map((c) => [c.niveau, c.valeurs])).toEqual([
      ["alerte", { liste: "Semences", mois: [2, 2] }],
      ["info", { ligneId: "chef", mois: [12] }],
    ]);
  });
});

describe("outils des contrôles", () => {
  it("met en forme et normalise sans rien calculer", () => {
    expect(enFcfa(1_455_000)).toBe("1 455 000 FCFA");
    expect(normaliserLibelle("  Engrais N.P.K. ")).toBe("engrais n p k");
    expect(normaliserLibelle("Imprévus")).toBe("imprevus");
  });
});
