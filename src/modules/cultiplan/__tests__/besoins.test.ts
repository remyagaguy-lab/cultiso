/** @jest-environment node */
import { REFERENTIEL_TEST } from "@/cultisia/test-utils/fausse-base";
import { genererBudget } from "@/moteurs";
import { confronterExistant, type EcartBesoin, type EntreeBesoins } from "../besoins";
import { ProfilPorteurVide } from "../test-utils/profil-vide";

const SPECS = [
  { code: "tomate", nom: "Tomate", uniteEchelle: "ha" },
  { code: "poulet_chair", nom: "Poulet de chair", uniteEchelle: "sujet" },
];
type Profil = ReturnType<typeof ProfilPorteurVide>;

function entree(code: string, taille: number, profil: Profil = ProfilPorteurVide(), extra: Partial<EntreeBesoins> = {}): EntreeBesoins {
  const budget = genererBudget({
    ateliers: [{ atelierId: "a1", speculationCode: code, taille, cyclesParAn: 1 }],
    modelesCharges: REFERENTIEL_TEST.modelesCharges.filter((m) => m.speculationCode === code),
    modelesRevenus: REFERENTIEL_TEST.modelesRevenus.filter((m) => m.speculationCode === code),
    regles: [],
    contexte: {},
  });
  return { profil, ateliers: [{ speculationCode: code, taille }], speculations: SPECS, charges: budget.charges, revenus: budget.revenus, ...extra };
}
const de = (ecarts: EcartBesoin[], code: EcartBesoin["code"]) => ecarts.find((e) => e.code === code)!;

describe("existant contre besoins", () => {
  it("sans aucune réponse du porteur : tout ce qui dépend de lui est non évalué, avec ce que demande le référentiel", () => {
    const e = confronterExistant(entree("tomate", 2));
    expect(de(e, "TERRE_SURFACE")).toMatchObject({ feu: "non_evalue", besoin: "2 ha" });
    expect(de(e, "TRAVAIL_JOURS")).toMatchObject({ feu: "non_evalue", besoin: "120 jours de travail par an" });
    expect(de(e, "ARGENT_INVESTISSEMENT").feu).toBe("non_evalue");
    expect(de(e, "MATERIEL_EXISTANT").feu).toBe("non_evalue");
    expect(de(e, "MATERIEL_EXISTANT").phrase).toContain("Motopompe");
    expect(e.filter((x) => x.feu === "vert" || x.feu === "rouge")).toEqual([]);
  });

  it("terre : vert si la surface suffit, orange avec l'extension, rouge sinon, en disant ce qui n'est pas compté", () => {
    const f = (profil: Profil) => de(confronterExistant(entree("tomate", 2, profil)), "TERRE_SURFACE");
    expect(f(ProfilPorteurVide({ terreSurfaceHa: 3 })).feu).toBe("vert");
    expect(f(ProfilPorteurVide({ terreSurfaceHa: 2 })).feu).toBe("vert");
    expect(f(ProfilPorteurVide({ terreSurfaceHa: 2 })).phrase).toContain("jachère");
    expect(f(ProfilPorteurVide({ terreSurfaceHa: 1, terreExtensionPossible: true, terreExtensionHa: 1 })).feu).toBe("orange");
    expect(f(ProfilPorteurVide({ terreSurfaceHa: 1, terreExtensionPossible: true, terreExtensionHa: 0.5 })).feu).toBe("rouge");
    expect(f(ProfilPorteurVide({ terreSurfaceHa: 1 })).phrase).toContain("trop petite");
    expect(f(ProfilPorteurVide({}, { inconnus: ["terreSurfaceHa"] })).phrase).toContain("Tu ne sais pas encore");
  });

  it("terre : non évaluée pour une production qui ne se compte pas en hectares", () => {
    const e = de(confronterExistant(entree("poulet_chair", 500, ProfilPorteurVide({ terreSurfaceHa: 1 }))), "TERRE_SURFACE");
    expect(e.feu).toBe("non_evalue");
    expect(e.phrase).toContain("ne se compte pas en hectares");
  });

  it("eau : jamais confrontée tant que le référentiel n'a pas de besoin en eau, mais le débit du porteur est rappelé", () => {
    const e = de(confronterExistant(entree("tomate", 2, ProfilPorteurVide({ eauSource: "forage", eauDebitM3Jour: 8 }))), "EAU_BESOIN");
    expect(e.feu).toBe("non_evalue");
    expect(e.disponible).toBe("8 m³ par jour");
    expect(e.phrase).toContain("pas encore le besoin en eau");
    expect(de(confronterExistant(entree("tomate", 2)), "EAU_BESOIN").phrase).toContain("Quand tu connaîtras ton débit");
  });

  it("travail : donne le besoin en jours, ne devine pas la durée d'un jour, évalue si elle est fournie", () => {
    const profil = ProfilPorteurVide({ tempsHeuresSemaine: 20, familleActifs: 2, familleHeuresSemaine: 30 });
    const sans = de(confronterExistant(entree("tomate", 2, profil)), "TRAVAIL_JOURS");
    expect(sans.feu).toBe("non_evalue");
    expect(sans.disponible).toBe("50 heures par semaine (dont 30 de ta famille)");
    expect(sans.phrase).toContain("ne dit pas combien d'heures dure un jour");
    expect(de(confronterExistant(entree("tomate", 2, profil, { heuresParJourTravail: 8 })), "TRAVAIL_JOURS").feu).toBe("vert");
    const peu = ProfilPorteurVide({ tempsHeuresSemaine: 10, familleActifs: 0, familleHeuresSemaine: 0 });
    expect(de(confronterExistant(entree("tomate", 2, peu, { heuresParJourTravail: 8 })), "TRAVAIL_JOURS").feu).toBe("orange");
    const flou = ProfilPorteurVide({ tempsHeuresSemaine: 10, familleActifs: 3 });
    expect(de(confronterExistant(entree("tomate", 2, flou, { heuresParJourTravail: 8 })), "TRAVAIL_JOURS").feu).toBe("non_evalue");
  });

  it("argent : confronte l'apport aux investissements de départ du référentiel, sans compter le reste", () => {
    const arg = de(confronterExistant(entree("tomate", 2, ProfilPorteurVide({ apportEspecesFcfa: 100000, apportNatureFcfa: 50000 }))), "ARGENT_INVESTISSEMENT");
    expect(arg.feu).toBe("orange");
    expect(arg.besoin).toBe("600 000 FCFA d'investissements de départ");
    expect(arg.phrase).toContain("il manque 450 000 FCFA");
    expect(arg.phrase).toContain("dépenses courantes");
    expect(de(confronterExistant(entree("tomate", 2, ProfilPorteurVide({ apportEspecesFcfa: 700000 }))), "ARGENT_INVESTISSEMENT").feu).toBe("vert");
    expect(de(confronterExistant(entree("tomate", 2, ProfilPorteurVide({}, { inconnus: ["apportEspecesFcfa"] }))), "ARGENT_INVESTISSEMENT").feu).toBe("non_evalue");
  });

  it("matériel : rapproche l'existant des investissements par leur nom, signale le mauvais état et ce qui est à prévoir", () => {
    const f = (existant: Profil["existant"], sans = false) => de(confronterExistant(entree("tomate", 2, ProfilPorteurVide({}, { existant, sansExistant: sans }))), "MATERIEL_EXISTANT");
    expect(f([{ categorie: "materiel", libelle: "Ma motopompe Honda", etat: "bon" }]).feu).toBe("vert");
    expect(f([{ categorie: "materiel", libelle: "Ma motopompe Honda", etat: "bon" }]).phrase).toContain("Tu as déjà : Motopompe");
    const mauvais = f([{ categorie: "materiel", libelle: "Motopompe", etat: "mauvais" }]);
    expect(mauvais.feu).toBe("orange");
    expect(mauvais.phrase).toContain("À remplacer");
    const rien = f([], true);
    expect(rien.feu).toBe("orange");
    expect(rien.phrase).toContain("À prévoir : Motopompe");
    expect(f([{ categorie: "animaux", libelle: "Trois chèvres" }]).phrase).toContain("À prévoir");
  });

  it("rendement : dit s'il n'y a pas de bornes, et signale quand elles sont des brouillons", () => {
    expect(de(confronterExistant(entree("tomate", 2)), "RENDEMENT_BORNES").feu).toBe("non_evalue");
    const base = entree("tomate", 2);
    const avec = { ...base, revenus: base.revenus.map((r) => ({ ...r, bornesQuantite: { min: 1, max: 9, source: "x", statut: "brouillon_ia" as const } })) };
    const r = de(confronterExistant(avec), "RENDEMENT_BORNES");
    expect(r.feu).toBe("vert");
    expect(r.phrase).toContain("brouillons");
  });
});
