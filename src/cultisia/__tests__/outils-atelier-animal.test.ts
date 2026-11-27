/** @jest-environment node */
// M14 : Cultisia restitue la simulation de l'atelier animal du moteur, sans rien calculer ni deviner.
import type { VarianteElevage } from "@/referentiel/elevage";
import type { AccesDonnees } from "../donnees";
import { simulerAtelierAnimalOutil } from "../outils/atelier-animal";
import type { ContexteOutil } from "../outils/registre";
import { fausseBase } from "../test-utils/fausse-base";

const points = (valeurs: number[]) => valeurs.map((valeur, i) => ({ age: i + 1, valeur }));
const p = (valeur: number, unite: string) => ({ valeur, unite, source: "Source d'essai p. 1", dateSource: "2026-11-27", statut: "brouillon_ia" as const });
// Variante d'ESSAI, inventée pour ce test seulement.
const essai: VarianteElevage = {
  variante: "essai",
  courbes: { mortalite: points([0.1, 0, 0, 0, 0]), consommation: points([20, 50, 100, 100, 100]), production: points([0, 0, 0.5, 0.5, 0.5]), poids: [] },
  parametres: { age_reforme_mois: p(5, "mois"), jours_par_mois: p(30, "jours") },
  sources: ["Source d'essai p. 1"],
  statut: "brouillon_ia",
};
const contexte = (surcharges: Partial<AccesDonnees> = {}): ContexteOutil => ({
  module: "cultiplan",
  utilisateurId: "u1",
  donnees: fausseBase({
    listerSpeculations: async () => [
      { code: "poule_pondeuse", nom: "Poule pondeuse", secteur: "animal", uniteEchelle: "sujet", statut: "brouillon_ia" },
      { code: "tilapia", nom: "Tilapia", secteur: "halieutique", uniteEchelle: "m3", statut: "brouillon_ia" },
    ],
    lireVariantesElevage: async (code) => (code === "poule_pondeuse" ? [essai] : []),
    ...surcharges,
  }),
});
const args = { speculation: "poule pondeuse", bandes: [{ debutMois: 1, effectif: 100 }], prix: { animal: 1000, aliment: 200, produit: 100, reforme: 2000 } };
const parse = (a: object) => simulerAtelierAnimalOutil.schema.parse(a);

let espion: jest.SpyInstance;
beforeEach(() => (espion = jest.spyOn(console, "error").mockImplementation(() => {})));
afterEach(() => espion.mockRestore());

describe("simuler_atelier_animal", () => {
  it("restitue le coût de l'animal prêt à produire, le seuil technique, le financement et le renouvellement, avec l'origine des courbes", async () => {
    const r = await simulerAtelierAnimalOutil.executer!(parse(args), contexte());
    expect(r.contenu).toContain("ATELIER ANIMAL À BANDES (variante essai, 5 mois)");
    expect(r.contenu).toContain("Source d'essai p. 1");
    expect(r.contenu).toContain("coût de l'animal prêt à produire : 1 544,44 FCFA par sujet vivant");
    expect(r.contenu).toContain("seuil technique : 20 % pour une production prévue de 50 %");
    expect(r.contenu).toContain("renouvellement : financé par l'atelier");
    expect(r.contenu).toContain("non encore validées par un expert");
    expect(r.contenu).toContain("N'ajoute aucune courbe");
    expect(r.sources?.map((s) => s.origine)).toEqual(["referentiel"]);
  });

  it("référentiel sans courbe : « non évalué », jamais de chiffre inventé", async () => {
    const r = await simulerAtelierAnimalOutil.executer!(parse({ ...args, speculation: "tilapia" }), contexte());
    expect(r.contenu).toMatch(/^ATELIER ANIMAL NON ÉVALUÉ/);
    expect(r.contenu).toContain("aucune courbe");
    expect(r.contenu).not.toContain("FCFA par sujet");
  });

  it("garde-fous : référentiel non installé, spéculation inconnue, moteur qui refuse, panne", async () => {
    expect((await simulerAtelierAnimalOutil.executer!(parse(args), contexte({ lireVariantesElevage: undefined }))).contenu).toMatch(/^COURBES D'ÉLEVAGE NON DISPONIBLES/);
    expect((await simulerAtelierAnimalOutil.executer!(parse({ ...args, speculation: "licorne" }), contexte())).contenu).toMatch(/^SPÉCULATION INCONNUE/);
    const trop = await simulerAtelierAnimalOutil.executer!(parse({ ...args, dureeBandeMois: { valeur: 8, source: "essai" } }), contexte());
    expect(trop.contenu).toMatch(/^ENTRÉE REFUSÉE PAR LE MOTEUR/);
    const panne = await simulerAtelierAnimalOutil.executer!(parse(args), contexte({ lireVariantesElevage: async () => { throw new Error("coupure"); } }));
    expect(panne.contenu).toMatch(/^ERREUR D'ACCÈS AUX DONNÉES/);
  });

  it("le schéma exige la source d'une durée de bande donnée par l'appelant", () => {
    expect(simulerAtelierAnimalOutil.schema.safeParse({ ...args, dureeBandeMois: { valeur: 5, source: "" } }).success).toBe(false);
  });
});
