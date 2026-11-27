/** @jest-environment node */
// R10, M13 : Cultisia confronte l'existant du porteur aux besoins du référentiel, sans rien calculer ni deviner.
import { confronterExistant } from "@/modules/cultiplan/besoins";
import type { EtatEntretien } from "@/modules/cultiplan/entretien";
import { entretienDeDepart } from "@/modules/cultiplan/test-utils/entretien-depart";
import { ProfilPorteurVide } from "@/modules/cultiplan/test-utils/profil-vide";
import { genererBudget } from "@/moteurs";
import type { AccesDonnees } from "../donnees";
import { confronterExistantOutil } from "../outils/besoins";
import { pointDeFaisabiliteOutil } from "../outils/consultation";
import type { ContexteOutil } from "../outils/registre";
import { fausseBase, REFERENTIEL_TEST } from "../test-utils/fausse-base";

const base = (surcharges: Partial<AccesDonnees> = {}): AccesDonnees =>
  fausseBase({
    listerSpeculations: async () => [
      { code: "tomate", nom: "Tomate", secteur: "vegetal", uniteEchelle: "ha", statut: "brouillon_ia" },
      { code: "poulet_chair", nom: "Poulet de chair", secteur: "animal", uniteEchelle: "sujet", statut: "validee" },
    ],
    preparerBudget: async ({ ateliers, contexte }) => ({
      ateliers: ateliers.map((a) => ({ atelierId: a.id, speculationCode: a.speculationCode, taille: a.taille, cyclesParAn: 1 })),
      modelesCharges: REFERENTIEL_TEST.modelesCharges,
      modelesRevenus: REFERENTIEL_TEST.modelesRevenus,
      regles: [],
      contexte,
    }),
    ...surcharges,
  });
const contexte = (surcharges: Partial<AccesDonnees> = {}, exploitationId = "exp-1"): ContexteOutil => ({ module: "cultiplan", utilisateurId: "u1", exploitationId, donnees: base(surcharges) });
const profil = ProfilPorteurVide({ terreSurfaceHa: 1, apportEspecesFcfa: 100000, tempsHeuresSemaine: 20 }, { sansExistant: true });
const lireProfil = async (id: string) => (id === "exp-1" ? profil : null);

let espion: jest.SpyInstance;
beforeEach(() => (espion = jest.spyOn(console, "error").mockImplementation(() => {})));
afterEach(() => espion.mockRestore());

describe("confronter_existant", () => {
  it("restitue les écarts du service, un par dimension, avec feu, phrase, besoin et ce que le porteur a", async () => {
    const r = await confronterExistantOutil.executer!({}, contexte({ lireProfil }));
    const budget = genererBudget({
      ateliers: [{ atelierId: "at-1", speculationCode: "tomate", taille: 2, cyclesParAn: 1 }],
      modelesCharges: REFERENTIEL_TEST.modelesCharges.filter((m) => m.speculationCode === "tomate"),
      modelesRevenus: REFERENTIEL_TEST.modelesRevenus.filter((m) => m.speculationCode === "tomate"),
      regles: [],
      contexte: { acces: "isole" },
    });
    const attendus = confronterExistant({
      profil,
      ateliers: [{ speculationCode: "tomate", taille: 2 }],
      speculations: [{ code: "tomate", nom: "Tomate", uniteEchelle: "ha" }],
      charges: budget.charges,
      revenus: budget.revenus,
    });
    for (const e of attendus) expect(r.contenu).toContain(e.phrase);
    expect(r.contenu).toContain("- Terre : ROUGE. Ton projet demande 2 ha et tu disposes de 1 ha.");
    expect(r.contenu).toContain("- Eau : NON ÉVALUÉ.");
    expect(r.contenu).toContain("- Argent : ORANGE.");
    expect(r.contenu).toContain("[besoin : 600 000 FCFA d'investissements de départ]");
    expect(r.contenu).toContain("N'ajoute aucun chiffre");
    expect(r.contenu).toContain("non encore validées par un expert");
    expect(r.sources?.map((s) => s.origine)).toEqual(["referentiel", "exploitation"]);
  });

  it("accepte des ateliers donnés dans la demande", async () => {
    const r = await confronterExistantOutil.executer!({ ateliers: [{ speculation: "tomate", taille: 0.5 }] }, contexte({ lireProfil }));
    expect(r.contenu).toContain("- Terre : VERT. Ton projet demande 0,5 ha et tu disposes de 1 ha.");
  });

  it("garde-fous : pas d'exploitation, profil non installé, exploitation inaccessible, spéculation inconnue, panne", async () => {
    expect((await confronterExistantOutil.executer!({}, contexte({ lireProfil }, ""))).contenu).toMatch(/^AUCUNE EXPLOITATION ACTIVE/);
    expect((await confronterExistantOutil.executer!({}, contexte({ lireProfil: undefined }))).contenu).toMatch(/^PROFIL NON DISPONIBLE/);
    expect((await confronterExistantOutil.executer!({}, contexte({ lireProfil }, "autre"))).contenu).toMatch(/^(EXPLOITATION INTROUVABLE|L'EXPLOITATION N'A AUCUN ATELIER)/);
    expect((await confronterExistantOutil.executer!({ ateliers: [{ speculation: "licorne", taille: 1 }] }, contexte({ lireProfil }))).contenu).toMatch(/^SPÉCULATION INCONNUE/);
    const panne = await confronterExistantOutil.executer!({}, contexte({ lireProfil: async () => { throw new Error("coupure"); } }));
    expect(panne.contenu).toMatch(/^ERREUR D'ACCÈS AUX DONNÉES/);
  });
});

describe("point de faisabilité et existant contre besoins", () => {
  const entretien = entretienDeDepart();
  const etat: EtatEntretien = { profil, contexte: {} };
  const lireConsultation = async (id: string) => (id === "exp-1" ? { entretien, etat } : null);

  it("ajoute la section « existant contre besoins » quand le projet a des ateliers", async () => {
    const r = await pointDeFaisabiliteOutil.executer!({}, contexte({ lireConsultation, lireProfil }));
    expect(r.contenu).toContain("Existant contre besoins du référentiel");
    expect(r.contenu).toContain("- Terre : ROUGE.");
  });

  it("reste utilisable sans cette section quand elle ne peut pas être établie", async () => {
    const r = await pointDeFaisabiliteOutil.executer!({}, contexte({ lireConsultation, lireProfil: undefined }));
    expect(r.contenu).toContain("POINT DE FAISABILITÉ");
    expect(r.contenu).not.toContain("Existant contre besoins");
    const panne = await pointDeFaisabiliteOutil.executer!({}, contexte({ lireConsultation, lireProfil: async () => { throw new Error("x"); } }));
    expect(panne.contenu).toContain("POINT DE FAISABILITÉ");
    expect(panne.contenu).not.toContain("Existant contre besoins");
  });
});
