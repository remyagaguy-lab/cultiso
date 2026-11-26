/** @jest-environment node */
import type { AccesDonnees } from "../donnees";
import { chercherSavoir, lireExploitation, lirePrix, lireReferentiel, traduire, CULTURES_EN as CULTURES_EN_TEST } from "../outils/lecture";
import type { ContexteOutil } from "../outils/registre";
import { fausseBase } from "../test-utils/fausse-base";

const contexte = (surcharges: Partial<AccesDonnees> = {}, exploitationId?: string): ContexteOutil => ({
  module: "cultisia",
  utilisateurId: "u1",
  exploitationId,
  donnees: fausseBase(surcharges),
});

const enPanne = async (): Promise<never> => {
  throw new Error("base injoignable");
};

let espion: jest.SpyInstance;
beforeEach(() => (espion = jest.spyOn(console, "error").mockImplementation(() => {})));
afterEach(() => espion.mockRestore());

describe("lire_prix", () => {
  it("trouve un prix, filtre par lieu et renvoie des sources datées", async () => {
    const r = await lirePrix.executer!({ produits: ["Maïs"], lieu: "lome" }, contexte());
    expect(r.contenu).toContain("Maïs grain : 350 FCFA / kg ; lieu : Lomé, Adawlato ; date : 2026-11-20");
    expect(r.contenu).not.toContain("Kara");
    expect(r.sources).toEqual([{ file_name: "Cours des prix Cultiso : Maïs grain (2026-11-20)", origine: "prix", date: "2026-11-20" }]);
  });

  it("signale l'absence de relevé dans le lieu demandé et donne les autres", async () => {
    const r = await lirePrix.executer!({ produits: ["maïs"], lieu: "Sokodé" }, contexte());
    expect(r.contenu).toMatch(/^Aucun prix relevé à Sokodé/);
    expect(r.contenu).toContain("Kara");
  });

  it("dit honnêtement quand rien n'est trouvé", async () => {
    const r = await lirePrix.executer!({ produits: ["vanille"] }, contexte());
    expect(r.contenu).toMatch(/AUCUNE DONNÉE TROUVÉE/);
    expect(r.sources).toBeUndefined();
  });

  it("transforme une erreur de base en message honnête", async () => {
    const r = await lirePrix.executer!({ produits: ["maïs"] }, contexte({ chercherPrix: enPanne }));
    expect(r.contenu).toMatch(/ERREUR D'ACCÈS/);
  });
});

describe("lire_exploitation", () => {
  it("résume l'exploitation active", async () => {
    const r = await lireExploitation.executer!({}, contexte({}, "exp-1"));
    expect(r.contenu).toContain("Exploitation : Ferme de Tsévié");
    expect(r.contenu).toContain("Surface : 2 ha");
    expect(r.contenu).toContain("2026-11-10 ; dépense ; Engrais ; 72000 FCFA");
    expect(r.sources).toEqual([{ file_name: "Ton exploitation : Ferme de Tsévié", origine: "exploitation" }]);
  });

  it("gère l'absence d'exploitation active et l'exploitation d'un autre utilisateur", async () => {
    expect((await lireExploitation.executer!({}, contexte())).contenu).toMatch(/AUCUNE EXPLOITATION ACTIVE/);
    expect((await lireExploitation.executer!({}, contexte({}, "exp-autre"))).contenu).toMatch(/INTROUVABLE/);
  });

  it("transforme une erreur de base en message honnête", async () => {
    const r = await lireExploitation.executer!({}, contexte({ lireExploitation: enPanne }, "exp-1"));
    expect(r.contenu).toMatch(/ERREUR D'ACCÈS/);
  });
});

describe("lire_referentiel", () => {
  it("lit une culture, un sol et une zone", async () => {
    const manioc = (await lireReferentiel.executer!({ type: "culture", terme: "Manioc" }, contexte())).contenu;
    expect(manioc.split("\n")[0]).toBe("- Default Cassava, Calendar (Columbia, Nigeria, Togo) : température de base 10 °C, maximale 35 °C, indice de récolte de référence 70 %");
    const sol = (await lireReferentiel.executer!({ type: "sol", terme: "sol limon sableux" }, contexte())).contenu;
    expect(sol).toContain("'sandy loam' soil profile : capacité au champ 22 %");
    expect(sol).not.toContain("clay");
    const zone = await lireReferentiel.executer!({ type: "zone", terme: "zone iv" }, contexte());
    expect(zone.contenu).toContain("Zone IV (Plateaux)");
    expect(zone.contenu).not.toContain("Maritime");
    expect(zone.sources?.[0].origine).toBe("referentiel");
  });

  it("liste toutes les zones sans terme, et dit quand rien n'est trouvé", async () => {
    expect((await lireReferentiel.executer!({ type: "zone" }, contexte())).contenu.split("\n")).toHaveLength(2);
    expect((await lireReferentiel.executer!({ type: "culture", terme: "vanille" }, contexte())).contenu).toMatch(/AUCUNE DONNÉE/);
    expect((await lireReferentiel.executer!({ type: "sol" }, contexte())).contenu).toMatch(/Précise/);
  });

  it("transforme une erreur de base en message honnête", async () => {
    const r = await lireReferentiel.executer!({ type: "zone" }, contexte({ listerZones: enPanne }));
    expect(r.contenu).toMatch(/ERREUR D'ACCÈS/);
  });
});

describe("traduction des noms du référentiel", () => {
  it("traduit les noms français courants vers AquaCrop", () => {
    expect(traduire("mais", CULTURES_EN_TEST)).toBe("maize");
    expect(traduire("pomme de terre", CULTURES_EN_TEST)).toBe("potato");
    expect(traduire("quinoa", CULTURES_EN_TEST)).toBe("quinoa");
  });
});

describe("chercher_savoir", () => {
  it("répond honnêtement qu'aucune source autorisée n'est disponible", async () => {
    const r = await chercherSavoir.executer!({ question: "lutte contre la chenille" }, contexte());
    expect(r.contenu).toMatch(/AUCUNE SOURCE DOCUMENTAIRE AUTORISÉE/);
    expect(r.sources).toBeUndefined();
  });

  it("renvoie les extraits autorisés et leurs sources dédoublonnées", async () => {
    const r = await chercherSavoir.executer!(
      { question: "chenille" },
      contexte({
        chercherSavoir: async () => [
          { document: "Guide ITRA maïs", contenu: "Extrait 1", similarite: 0.8 },
          { document: "Guide ITRA maïs", contenu: "Extrait 2", similarite: 0.7 },
        ],
      }),
    );
    expect(r.contenu).toContain("[Guide ITRA maïs]\nExtrait 1");
    expect(r.sources).toEqual([{ file_name: "Guide ITRA maïs", origine: "savoir" }]);
  });

  it("transforme une erreur en message honnête", async () => {
    const r = await chercherSavoir.executer!({ question: "chenille" }, contexte({ chercherSavoir: enPanne }));
    expect(r.contenu).toMatch(/ERREUR D'ACCÈS/);
  });
});
