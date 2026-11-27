/** @jest-environment node */
import { ErreurMoteur, VERSION_MOTEURS } from "..";
import { simulerBandes, type EntreeBandes } from "../bandes";

// Courbes d'essai SIMPLES, inventées pour ce test seulement (le moteur n'a aucune courbe) : 2 mois d'élevage sans ponte, 3 mois de ponte.
const courbe = (valeurs: number[]) => valeurs.map((valeur, i) => ({ age: i + 1, valeur }));
const base = (): EntreeBandes => ({
  courbes: {
    mortalite: courbe([0.1, 0, 0, 0, 0]),
    consommation: courbe([20, 50, 100, 100, 100]),
    production: courbe([0, 0, 0.5, 0.5, 0.5]),
  },
  joursParMois: 30,
  dureeBandeMois: 5,
  bandes: [{ debutMois: 1, effectif: 100 }],
  prix: { animal: 1000, aliment: 200, produit: 100, reforme: 2000 },
});

describe("atelier animal à bandes (M14)", () => {
  it("une bande : effectifs, aliment, production et ventes mois par mois, trésorerie du mois 0 à la réforme", () => {
    const r = simulerBandes(base());
    expect(r.versionMoteur).toBe(VERSION_MOTEURS);
    expect(r.horizonMois).toBe(5);
    const m1 = r.mois[1];
    // mois 1 : 100 sujets en début de mois, 10 % de morts, 20 g × 30 j = 0,6 kg par sujet
    expect(m1).toMatchObject({ effectifDebut: 100, morts: 10, alimentKg: 60, production: 0, achatsAnimaux: 100000, alimentFcfa: 12000 });
    // mois 2 : 90 sujets, 50 g × 30 j = 1,5 kg par sujet = 135 kg
    expect(r.mois[2]).toMatchObject({ effectifDebut: 90, alimentKg: 135, production: 0 });
    // mois 3 : 90 sujets pondent à 50 % pendant 30 jours = 1 350 œufs à 100 FCFA
    expect(r.mois[3]).toMatchObject({ effectifProducteur: 90, production: 1350, ventesProduit: 135000 });
    // mois 5 : 90 sujets vendus à 2 000 FCFA à la fin de la bande
    expect(r.mois[5].ventesReformees).toBe(180000);
    expect(r.totalProduction).toBe(4050);
    expect(r.totalVentes).toBe(3 * 135000 + 180000);
    // pas d'investissement ni d'apport : le cumul du mois 1 est la dépense du mois
    expect(r.mois[0].cumul).toBe(0);
    expect(r.mois[1].cumul).toBe(-112000);
  });

  it("coût de l'animal prêt à produire : achat, aliment et soins de la phase improductive, par sujet mis en place et par sujet vivant", () => {
    const r = simulerBandes({ ...base(), chargesParSujetMois: [{ libelle: "Soins", montant: 10 }], chargesFixesMensuelles: [{ libelle: "Gardien", montant: 20000 }] });
    const c = r.coutAnimalPretAProduire!;
    expect(c.moisImproductifs).toBe(2);
    expect(c.effectifMisEnPlace).toBe(100);
    expect(c.effectifPretAProduire).toBe(90);
    expect(c.achatAnimaux).toBe(100000);
    // aliment : 100 × 0,6 kg + 90 × 1,5 kg = 195 kg × 200 = 39 000 ; soins : (100 + 90) × 10 = 1 900
    expect(c.aliment).toBe(39000);
    expect(c.chargesParSujet).toBe(1900);
    expect(c.total).toBe(140900);
    expect(c.parSujetMisEnPlace).toBe(1409);
    expect(c.parSujetPretAProduire).toBeCloseTo(1565.56, 2);
    // les charges fixes de la phase sont montrées, pas imputées
    expect(c.chargesFixesDeLaPhase).toBe(40000);
  });

  it("seuil technique : production par sujet et par jour qui couvre les charges des mois de production, comparée à la production prévue", () => {
    const r = simulerBandes({ ...base(), chargesFixesMensuelles: [{ libelle: "Gardien", montant: 20000 }] });
    // mois de production 3 à 5 : 90 sujets × 100 g × 30 j = 270 kg × 200 = 54 000 + 20 000 de charges fixes = 74 000 par mois
    // seuil = 74 000 / (100 FCFA × 90 sujets × 30 jours) = 0,2741
    expect(r.seuilTechnique.seuilMoyen).toBeCloseTo(0.2741, 4);
    expect(r.seuilTechnique.prevuMoyen).toBe(0.5);
    expect(r.seuilTechnique.seuilAtteint).toBe(true);
    expect(r.seuilTechnique.margeSecurite).toBeCloseTo(0.2259, 4);
    expect(r.seuilTechnique.parMois.map((p) => p.mois)).toEqual([3, 4, 5]);
    // un œuf à 40 FCFA : le seuil monte au-dessus de la production prévue
    const bas = simulerBandes({ ...base(), prix: { ...base().prix, produit: 40 }, chargesFixesMensuelles: [{ libelle: "Gardien", montant: 20000 }] });
    expect(bas.seuilTechnique.seuilAtteint).toBe(false);
    expect(bas.lecture.join(" ")).toContain("charges ne sont pas couvertes");
    // sans prix du produit : seuil non évalué, jamais inventé
    const sans = simulerBandes({ ...base(), prix: { ...base().prix, produit: 0 } });
    expect(sans.seuilTechnique.seuilMoyen).toBeNull();
    expect(sans.lecture.join(" ")).toContain("seuil technique n'est pas évalué");
  });

  it("besoin de financement = point bas sans apport, investissement compris ; l'apport le couvre ou non", () => {
    const e = { ...base(), investissement: 500000 };
    const r = simulerBandes({ ...e, apport: 0 });
    // mois 0 : −500 000 ; mois 1 : −112 000 ; mois 2 : −(90 × 1,5 × 200 = 27 000) ; mois 3 : +135 000 − 27 000 − ... (aliment 54 000) = +81 000
    expect(r.besoinFinancement).toBe(639000);
    expect(r.apportSuffisant).toBe(false);
    expect(r.pointBasTresorerie).toEqual({ montant: -639000, mois: 2 });
    const couvert = simulerBandes({ ...e, apport: 700000 });
    expect(couvert.apportSuffisant).toBe(true);
    expect(couvert.pointBasTresorerie.montant).toBe(61000);
    expect(couvert.besoinFinancement).toBe(639000);
  });

  it("renouvellement : la trésorerie de fin paie-t-elle de quoi redémarrer une bande, et ce qui reste à retirer", () => {
    const r = simulerBandes(base());
    // redémarrer = point bas d'une bande seule : 112 000 + 27 000 = 139 000 ; fin : 3 × 135 000 + 180 000 − 100 000 − 12 000 − 27 000 − 3 × 54 000 = 284 000
    expect(r.renouvellement.besoinRedemarrage).toBe(139000);
    expect(r.renouvellement.autofinancement).toBe(284000);
    expect(r.renouvellement.autofinance).toBe(true);
    expect(r.renouvellement.retraitPossible).toBe(145000);
    expect(r.renouvellement.retraitPossibleParMois).toBe(29000);
    const cher = simulerBandes({ ...base(), prix: { ...base().prix, produit: 50 } });
    expect(cher.renouvellement.autofinance).toBe(false);
    expect(cher.renouvellement.retraitPossible).toBe(0);
  });

  it("bandes décalées : les ventes de la première bande financent la seconde, le besoin de financement baisse", () => {
    const seule = simulerBandes({ ...base(), bandes: [{ debutMois: 1, effectif: 100 }] });
    const decalees = simulerBandes({ ...base(), bandes: [{ debutMois: 1, effectif: 100 }, { debutMois: 4, effectif: 100 }] });
    expect(decalees.horizonMois).toBe(8);
    expect(decalees.totalProduction).toBe(2 * seule.totalProduction);
    // au mois 4, la bande 1 produit déjà (mois d'âge 4) pendant que la bande 2 démarre : les deux effectifs sont comptés
    expect(decalees.mois[4].effectifDebut).toBe(190);
    expect(decalees.mois[4].effectifProducteur).toBe(90);
    // le besoin de financement des deux bandes décalées est inférieur à deux bandes lancées ensemble
    const ensemble = simulerBandes({ ...base(), bandes: [{ debutMois: 1, effectif: 100 }, { debutMois: 1, effectif: 100 }] });
    expect(decalees.besoinFinancement).toBeLessThan(ensemble.besoinFinancement);
    expect(decalees.coutAnimalPretAProduire?.bande).toBe("bande 1");
  });

  it("une courbe sans valeur à un âge de la bande est refusée, jamais prolongée ; valeurs hors limites refusées", () => {
    const e = base();
    e.courbes.production = courbe([0, 0, 0.5]);
    expect(() => simulerBandes(e)).toThrow(/production n'a pas de valeur pour le mois 4/);
    const dbl = base();
    dbl.courbes.mortalite = [...courbe([0.1, 0, 0, 0, 0]), { age: 2, valeur: 0.2 }];
    expect(() => simulerBandes(dbl)).toThrow(/deux valeurs pour le mois 2/);
    const trop = base();
    trop.courbes.mortalite = courbe([1.5, 0, 0, 0, 0]);
    expect(() => simulerBandes(trop)).toThrow(/dépasse 100 %/);
    expect(() => simulerBandes({ ...base(), joursParMois: 0 })).toThrow(ErreurMoteur);
    expect(() => simulerBandes({ ...base(), bandes: [] })).toThrow(ErreurMoteur);
  });

  it("sans production dans les courbes : coût de l'animal et seuil non évalués, dit simplement", () => {
    const e = base();
    e.courbes.production = courbe([0, 0, 0, 0, 0]);
    const r = simulerBandes(e);
    expect(r.coutAnimalPretAProduire).toBeNull();
    expect(r.seuilTechnique.seuilMoyen).toBeNull();
    expect(r.lecture.join(" ")).toContain("aucune production");
  });
});
