/** @jest-environment node */
// M13 : Cultisia restitue le dimensionnement à rebours du service Cultiplan, sans rien calculer ni deviner.
import { ProfilPorteurVide } from "@/modules/cultiplan/test-utils/profil-vide";
import type { AccesDonnees } from "../donnees";
import { dimensionnerARebourOutil } from "../outils/dimensionnement";
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
const profil = ProfilPorteurVide({ terreSurfaceHa: 1, apportEspecesFcfa: 1000000, menageCoutVieAnnuelFcfa: 1200000 });
const lireProfil = async (id: string) => (id === "exp-1" ? profil : null);
const args = { speculation: "tomate", debouche: { volumeParMois: 1600, moisParAn: 6, unite: "kg", origine: "contrat" as const, source: "Contrat de la coopérative" } };

let espion: jest.SpyInstance;
beforeEach(() => (espion = jest.spyOn(console, "error").mockImplementation(() => {})));
afterEach(() => espion.mockRestore());

describe("dimensionner_a_rebours", () => {
  it("restitue les trois tailles avec origines, plafonds et paramètres manquants, sans rien deviner", async () => {
    const r = await dimensionnerARebourOutil.executer!(dimensionnerARebourOutil.schema.parse(args), contexte({ lireProfil }));
    expect(r.contenu).toContain("DIMENSIONNEMENT À REBOURS (tomate, scénario realiste)");
    expect(r.contenu).toContain("- Avec ce que tu as : 1 ha.");
    expect(r.contenu).toContain("- Pour couvrir ton coût de vie : 1,57 ha.");
    expect(r.contenu).toContain("- Ce que le marché absorbe : 1,5 ha.");
    expect(r.contenu).toContain("Contrat de la coopérative");
    expect(r.contenu).toContain("Eau : NON ÉVALUÉ");
    expect(r.contenu).toContain("Paramètres manquants");
    expect(r.contenu).toContain("pertes après récolte");
    expect(r.contenu).toContain("non encore validées par un expert");
    expect(r.contenu).toContain("ne choisis pas à sa place");
    expect(r.sources?.map((s) => s.origine)).toEqual(["referentiel", "exploitation"]);
  });

  it("refuse un paramètre sans source (validé par le schéma, avant tout calcul)", () => {
    expect(dimensionnerARebourOutil.schema.safeParse({ ...args, pertesApresRecolte: { valeur: 0.1, source: "" } }).success).toBe(false);
    expect(dimensionnerARebourOutil.schema.safeParse({ ...args, debouche: { ...args.debouche, source: "" } }).success).toBe(false);
  });

  it("garde-fous : pas d'exploitation, profil non installé, spéculation inconnue, unité fausse, panne", async () => {
    const parse = (a: object) => dimensionnerARebourOutil.schema.parse(a);
    expect((await dimensionnerARebourOutil.executer!(parse(args), contexte({ lireProfil }, ""))).contenu).toMatch(/^AUCUNE EXPLOITATION ACTIVE/);
    expect((await dimensionnerARebourOutil.executer!(parse(args), contexte({ lireProfil: undefined }))).contenu).toMatch(/^PROFIL NON DISPONIBLE/);
    expect((await dimensionnerARebourOutil.executer!(parse({ ...args, speculation: "licorne" }), contexte({ lireProfil }))).contenu).toMatch(/^SPÉCULATION INCONNUE/);
    expect((await dimensionnerARebourOutil.executer!(parse(args), contexte({ lireProfil }, "autre"))).contenu).toMatch(/^EXPLOITATION INTROUVABLE/);
    const unite = await dimensionnerARebourOutil.executer!(parse({ ...args, debouche: { ...args.debouche, unite: "sac" } }), contexte({ lireProfil }));
    expect(unite.contenu).toMatch(/^ENTRÉE REFUSÉE PAR LE MOTEUR/);
    const panne = await dimensionnerARebourOutil.executer!(parse(args), contexte({ lireProfil: async () => { throw new Error("coupure"); } }));
    expect(panne.contenu).toMatch(/^ERREUR D'ACCÈS AUX DONNÉES/);
  });
});
