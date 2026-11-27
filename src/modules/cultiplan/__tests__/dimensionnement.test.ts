/** @jest-environment node */
import { REFERENTIEL_TEST } from "@/cultisia/test-utils/fausse-base";
import { ErreurMoteur } from "@/moteurs";
import { dimensionnerARebours, type EntreeDimensionnement, type ParametresDimensionnement } from "../dimensionnement";
import { ProfilPorteurVide } from "../test-utils/profil-vide";

const TOMATE = { code: "tomate", nom: "Tomate", uniteEchelle: "ha" };
const POULET = { code: "poulet_chair", nom: "Poulet de chair", uniteEchelle: "sujet" };
type Profil = ReturnType<typeof ProfilPorteurVide>;

// Tomate : 8 000 kg par ha, 20 % de pertes dans le modèle => 6 400 kg vendables par ha, à 150 FCFA le kg.
// Charges d'exploitation par ha : engrais 4 × 18 000 = 72 000 ; main d'oeuvre 60 jours × 2 000 = 120 000.
const DEBOUCHE = { volumeParMois: 1600, moisParAn: 6, unite: "kg", origine: "contrat" as const, source: "Contrat de la coopérative de Tsévié" };

function entree(params: Partial<ParametresDimensionnement> = {}, profil: Profil = ProfilPorteurVide(), speculation = TOMATE): EntreeDimensionnement {
  return {
    profil,
    speculation,
    budget: {
      modelesCharges: REFERENTIEL_TEST.modelesCharges.filter((m) => m.speculationCode === speculation.code),
      modelesRevenus: REFERENTIEL_TEST.modelesRevenus.filter((m) => m.speculationCode === speculation.code),
      regles: [],
      contexte: {},
      prix: [],
    },
    parametres: { debouche: DEBOUCHE, ...params },
  };
}
const taille = (r: ReturnType<typeof dimensionnerARebours>, cle: string) => r.tailles.find((t) => t.cle === cle)!;

describe("dimensionnement à rebours (M13)", () => {
  it("part du débouché : 9 600 kg par an à 6 400 kg vendables par hectare font 1,5 ha, avec l'origine de chaque chiffre", () => {
    const r = dimensionnerARebours(entree());
    expect(r.rendementVendable.valeur).toBe(6400);
    expect(r.debouche).toMatchObject({ valeur: 9600 });
    expect(r.debouche.origine).toContain("contrat");
    expect(r.debouche.origine).toContain("Contrat de la coopérative de Tsévié");
    const marche = taille(r, "ce_que_le_marche_absorbe");
    expect(marche).toMatchObject({ statut: "calculee", taille: 1.5 });
    expect(marche.detail?.productionNecessaireAn.valeur).toBe(12000);
    expect(marche.detail?.volumeVendableAn.valeur).toBe(9600);
    expect(marche.detail?.intrantsAn.valeur).toBe(108000);
    expect(marche.detail?.joursTravailAn.valeur).toBe(90);
    expect(marche.detail?.investissement.valeur).toBe(450000);
    expect(marche.detail?.depasseLeDebouche).toBe(false);
    expect(r.rendementVendable.origine).toContain("brouillon non validé");
    expect(r.donneesNonValidees).toBe(true);
  });

  it("sans paramètre de référence : rien n'est inventé, les manques sont listés et les dimensions sont non évaluées", () => {
    const r = dimensionnerARebours(entree());
    expect(r.plafonds.map((p) => [p.dimension, p.statut])).toEqual([
      ["terre", "non_evalue"],
      ["travail", "non_evalue"],
      ["argent", "non_evalue"],
      ["eau", "non_evalue"],
    ]);
    expect(taille(r, "avec_ce_que_tu_as")).toMatchObject({ statut: "non_evaluee", taille: null });
    expect(taille(r, "couvre_ton_cout_de_vie")).toMatchObject({ statut: "non_evaluee", taille: null });
    const m = r.manques.join(" | ");
    for (const mot of ["pertes après récolte", "part déclassée", "coefficient de rendement", "surface utile", "besoin en eau", "coût de vie"]) expect(m).toContain(mot);
  });

  it("pertes après récolte, déclassement et coefficient de rendement fournis avec leur source : la surface monte", () => {
    const r = dimensionnerARebours(
      entree({
        pertesApresRecolte: { valeur: 0.1, source: "Fiche conservation, DOC-X p. 3" },
        declassement: { valeur: 0.05, source: "Enquête de marché" },
        coefficientRendement: { valeur: 0.8, source: "Avis technicien ICAT" },
        surfaceUtile: { valeur: 1.2, source: "Fiche foncière" },
      }),
    );
    // 8000 × 0,8 × (1 − 0,2) × (1 − 0,1) × (1 − 0,05) = 4 377,6 kg vendables par ha
    expect(r.rendementVendable.valeur).toBeCloseTo(4377.6, 6);
    expect(r.rendementVendable.origine).toContain("Avis technicien ICAT");
    expect(r.rendementVendable.origine).toContain("Fiche conservation");
    const marche = taille(r, "ce_que_le_marche_absorbe");
    expect(marche.taille).toBeCloseTo(2.19, 2);
    expect(marche.detail?.surfaceAPrevoirHa.valeur).toBeCloseTo(2.19 * 1.2, 6);
    expect(marche.detail?.surfaceAPrevoirHa.origine).toContain("Fiche foncière");
    expect(r.manques.join(" ")).not.toContain("pertes après récolte");
  });

  it("avec ce que tu as : la plus petite limite évaluée l'emporte et la phrase nomme laquelle", () => {
    const profil = ProfilPorteurVide({ terreSurfaceHa: 3, tempsHeuresSemaine: 20, familleHeuresSemaine: 20, familleActifs: 2, apportEspecesFcfa: 500000, apportNatureFcfa: 100000 });
    const r = dimensionnerARebours(entree({ heuresParJourTravail: { valeur: 8, source: "Convention de travail du porteur" } }, profil));
    const parDim = Object.fromEntries(r.plafonds.map((p) => [p.dimension, p]));
    expect(parDim.terre.tailleMax).toBe(3);
    // 40 h × 52 = 2 080 h = 260 jours ; 60 jours par ha => 4,33 ha
    expect(parDim.travail.tailleMax).toBeCloseTo(260 / 60, 6);
    // 600 000 FCFA d'apport pour 300 000 FCFA d'investissement par ha => 2 ha
    expect(parDim.argent.tailleMax).toBe(2);
    expect(parDim.eau.statut).toBe("non_evalue");
    const a = taille(r, "avec_ce_que_tu_as");
    expect(a.taille).toBe(2);
    expect(a.phrase).toContain("ton apport");
    expect(a.phrase).toContain("Ne sont pas évalués : ton eau");
  });

  it("une taille qui dépasse l'existant ou le débouché est signalée, jamais cachée", () => {
    const profil = ProfilPorteurVide({ terreSurfaceHa: 1, apportEspecesFcfa: 1000000 });
    const r = dimensionnerARebours(entree({ debouche: { ...DEBOUCHE, volumeParMois: 3000 } }, profil));
    const marche = taille(r, "ce_que_le_marche_absorbe");
    expect(marche.taille).toBe(2.81);
    expect(marche.detail?.plafondsDepasses).toEqual(["terre"]);
    const avec = taille(r, "avec_ce_que_tu_as");
    expect(avec.taille).toBe(1);
    expect(avec.detail?.plafondsDepasses).toEqual([]);
  });

  it("couvre ton coût de vie : besoin net du ménage (crédits compris) divisé par la marge d'exploitation d'un hectare", () => {
    // marge par ha : 6 400 × 150 = 960 000 − 192 000 = 768 000 FCFA
    const profil = ProfilPorteurVide(
      { menageCoutVieAnnuelFcfa: 1200000, menageRevenusExterieursAnnuelsFcfa: 300000 },
      { credits: [{ creancier: "IMF", mensualiteFcfa: 20000, capitalRestantFcfa: null, moisRestants: null }] },
    );
    const r = dimensionnerARebours(entree({}, profil));
    // besoin = 1 200 000 + 240 000 − 300 000 = 1 140 000 ; 1 140 000 / 768 000 = 1,484 => 1,49 ha (arrondi au-dessus)
    const b = taille(r, "couvre_ton_cout_de_vie");
    expect(b).toMatchObject({ statut: "calculee", taille: 1.49 });
    expect(b.phrase).toContain("crédits en cours");
    expect(b.detail?.margeExploitationAn.valeur).toBeCloseTo(1.49 * 768000, 0);
    // M3 : le ménage est évalué par le moteur financier
    expect(b.detail?.finances.menageCouvert).not.toBeNull();
    expect(b.detail?.finances.soldeResiduelMinimum).not.toBeNull();
  });

  it("couvre ton coût de vie : impossible quand l'unité ne dégage pas de marge, couvert quand les revenus extérieurs suffisent", () => {
    const sansMarge = dimensionnerARebours(entree({}, ProfilPorteurVide({ menageCoutVieAnnuelFcfa: 1000000 })));
    expect(taille(sansMarge, "couvre_ton_cout_de_vie").statut).toBe("calculee");
    const e = entree({}, ProfilPorteurVide({ menageCoutVieAnnuelFcfa: 1000000 }));
    e.budget.prix = [{ produitId: "x", prix: 1, source: "s", date: "2026-11-01" }];
    e.budget.modelesRevenus = e.budget.modelesRevenus.map((m) => ({ ...m, prixReference: 10 }));
    const impossible = dimensionnerARebours(e);
    expect(taille(impossible, "couvre_ton_cout_de_vie")).toMatchObject({ statut: "impossible", taille: null });
    const couvert = dimensionnerARebours(entree({}, ProfilPorteurVide({ menageCoutVieAnnuelFcfa: 500000, menageRevenusExterieursAnnuelsFcfa: 800000 })));
    expect(taille(couvert, "couvre_ton_cout_de_vie")).toMatchObject({ statut: "non_evaluee", taille: null });
    expect(taille(couvert, "couvre_ton_cout_de_vie").phrase).toContain("couvrent déjà");
  });

  it("les contrôles M4 et les écarts de l'existant accompagnent chaque taille : le volume au-dessus du débouché est relevé par le moteur", () => {
    const r = dimensionnerARebours(entree({}, ProfilPorteurVide({ terreSurfaceHa: 2 })));
    const marche = taille(r, "ce_que_le_marche_absorbe").detail!;
    expect(marche.ecarts.map((e) => e.code)).toContain("TERRE_SURFACE");
    expect(marche.ecarts.find((e) => e.code === "TERRE_SURFACE")?.feu).toBe("vert");
    const codes = marche.finances.controles.map((c) => c.code);
    expect(codes).not.toContain("VOLUME_HORS_DEBOUCHE");
    // La taille « ce que tu as » plus grande que le marché est possible : le moteur signale alors le volume hors débouché.
    const grand = dimensionnerARebours(entree({ debouche: { ...DEBOUCHE, volumeParMois: 100 } }, ProfilPorteurVide({ terreSurfaceHa: 3 })));
    const avec = taille(grand, "avec_ce_que_tu_as");
    expect(avec.taille).toBe(3);
    expect(avec.detail?.depasseLeDebouche).toBe(true);
    expect(avec.detail?.finances.controles.map((c) => c.code)).toContain("VOLUME_HORS_DEBOUCHE");
  });

  it("élevage : la taille se compte en sujets, la terre n'est pas confrontée, l'unité du débouché doit être celle de la ligne", () => {
    const r = dimensionnerARebours(
      entree({ debouche: { volumeParMois: 190, moisParAn: 12, unite: "sujet", origine: "marche", source: "Enquête de terrain" }, cyclesParAn: 6 }, ProfilPorteurVide({ terreSurfaceHa: 1 }), POULET),
    );
    expect(r.plafonds.find((p) => p.dimension === "terre")?.phrase).toContain("ne se compte pas en hectares");
    // 0,95 sujet vendu par sujet mis en place et par cycle, 6 cycles : 5,7 sujets vendus par an et par sujet
    expect(r.rendementVendable.valeur).toBeCloseTo(5.7, 6);
    expect(taille(r, "ce_que_le_marche_absorbe").taille).toBe(400);
    expect(taille(r, "ce_que_le_marche_absorbe").detail?.surfaceAPrevoirHa.valeur).toBeNull();
    expect(() => dimensionnerARebours(entree({ debouche: { ...DEBOUCHE, unite: "kg" } }, ProfilPorteurVide(), POULET))).toThrow(/se compte en/);
  });

  it("entrées invalides : source du débouché obligatoire, spéculation sans revenu refusée", () => {
    expect(() => dimensionnerARebours(entree({ debouche: { ...DEBOUCHE, source: "" } }))).toThrow(ErreurMoteur);
    expect(() => dimensionnerARebours(entree({ pertesApresRecolte: { valeur: 0.1, source: "" } }))).toThrow(ErreurMoteur);
    const inconnue = entree({}, ProfilPorteurVide(), { code: "manioc", nom: "Manioc", uniteEchelle: "ha" });
    expect(() => dimensionnerARebours(inconnue)).toThrow(/aucune ligne de revenu/);
  });
});
