/** @jest-environment node */
import { ErreurPlan } from "../erreurs";
import { deduireDuProfil, ecrireProfil, lireProfil, schemaModificationProfil } from "../profil";
import { fauxClientProfil } from "../test-utils/fausse-base-profil";

const EXPLOITATION = "exp-1";

describe("schéma du profil du porteur", () => {
  it("accepte une valeur, null (je ne sais pas) ou l'absence pour chaque champ", () => {
    const r = schemaModificationProfil.safeParse({ terreSurfaceHa: 2, eauSource: null, menagePersonnes: 5 });
    expect(r.success).toBe(true);
    expect(schemaModificationProfil.safeParse({}).success).toBe(true);
    expect(schemaModificationProfil.safeParse({ existant: null, credits: null }).success).toBe(true);
  });

  it("refuse les valeurs hors liste, négatives ou les champs inconnus", () => {
    expect(schemaModificationProfil.safeParse({ terreStatut: "squat" }).success).toBe(false);
    expect(schemaModificationProfil.safeParse({ epargneFcfa: -1 }).success).toBe(false);
    expect(schemaModificationProfil.safeParse({ tempsHeuresSemaine: 200 }).success).toBe(false);
    expect(schemaModificationProfil.safeParse({ nimporte: 1 }).success).toBe(false);
    expect(schemaModificationProfil.safeParse({ finalites: [] }).success).toBe(false);
    expect(schemaModificationProfil.safeParse({ credits: [{ mensualiteFcfa: -5 }] }).success).toBe(false);
  });
});

describe("lecture et écriture du profil", () => {
  it("renvoie un profil vide tant que rien n'est enregistré", async () => {
    const { client } = fauxClientProfil();
    const p = await lireProfil(client, EXPLOITATION);
    expect(p.existe).toBe(false);
    expect(p.inconnus).toEqual([]);
    expect(p.valeurs.terreSurfaceHa).toBeNull();
  });

  it("enregistre des champs, garde les autres et mémorise « je ne sais pas »", async () => {
    const { client } = fauxClientProfil();
    await ecrireProfil(client, EXPLOITATION, { terreSurfaceHa: 2, eauSource: null });
    const p = await ecrireProfil(client, EXPLOITATION, { epargneFcfa: 150000 });
    expect(p.existe).toBe(true);
    expect(p.valeurs.terreSurfaceHa).toBe(2);
    expect(p.valeurs.epargneFcfa).toBe(150000);
    expect(p.valeurs.eauSource).toBeNull();
    expect(p.inconnus).toEqual(["eauSource"]);
  });

  it("retire un champ des « je ne sais pas » quand le porteur répond enfin", async () => {
    const { client } = fauxClientProfil();
    await ecrireProfil(client, EXPLOITATION, { eauSource: null, terreSol: null });
    const p = await ecrireProfil(client, EXPLOITATION, { eauSource: "forage" });
    expect(p.valeurs.eauSource).toBe("forage");
    expect(p.inconnus).toEqual(["terreSol"]);
  });

  it("remplace l'existant et les crédits, et distingue « aucun » de « pas demandé » et de « je ne sais pas »", async () => {
    const { client } = fauxClientProfil();
    let p = await ecrireProfil(client, EXPLOITATION, {
      existant: [{ categorie: "materiel", libelle: "Motopompe", etat: "bon", annee: 2022, valeurEstimeeFcfa: 120000 }],
      credits: [],
    });
    expect(p.existant).toHaveLength(1);
    expect(p.existant[0]).toMatchObject({ libelle: "Motopompe", valeurEstimeeFcfa: 120000, etat: "bon" });
    expect(p.sansCredit).toBe(true);
    expect(p.sansExistant).toBe(false);

    p = await ecrireProfil(client, EXPLOITATION, { existant: [], credits: null });
    expect(p.existant).toHaveLength(0);
    expect(p.sansExistant).toBe(true);
    expect(p.sansCredit).toBe(false);
    expect(p.inconnus).toEqual(["credits"]);

    p = await ecrireProfil(client, EXPLOITATION, { credits: [{ creancier: "Mutuelle", mensualiteFcfa: 15000, moisRestants: 10 }] });
    expect(p.credits).toEqual([expect.objectContaining({ creancier: "Mutuelle", mensualiteFcfa: 15000 })]);
    expect(p.inconnus).toEqual([]);
  });

  it("refuse des champs incohérents entre eux, sans rien enregistrer", async () => {
    const { client, tables } = fauxClientProfil();
    await expect(ecrireProfil(client, EXPLOITATION, { menagePersonnes: 3, menageBouches: 5 })).rejects.toBeInstanceOf(ErreurPlan);
    await expect(ecrireProfil(client, EXPLOITATION, { terreExtensionPossible: false, terreExtensionHa: 2 })).rejects.toThrow(/extension/);
    expect(tables.profil_porteur).toHaveLength(0);
  });

  it("vérifie la cohérence avec ce qui est déjà enregistré", async () => {
    const { client } = fauxClientProfil();
    await ecrireProfil(client, EXPLOITATION, { menagePersonnes: 4 });
    await expect(ecrireProfil(client, EXPLOITATION, { menageBouches: 6 })).rejects.toThrow(/bouches/);
  });

  it("refuse une entrée invalide avec un message lisible", async () => {
    const { client } = fauxClientProfil();
    await expect(ecrireProfil(client, EXPLOITATION, { epargneFcfa: -10 })).rejects.toMatchObject({ code: "invalide" });
  });

  it("traduit une erreur de la base, et reste tolérant à une base non migrée seulement si on le demande", async () => {
    const absente = { code: "42P01", message: "relation absente" };
    const { client } = fauxClientProfil({}, { profil_porteur: absente });
    await expect(lireProfil(client, EXPLOITATION)).rejects.toMatchObject({ code: "base" });
    expect((await lireProfil(client, EXPLOITATION, { tolerant: true })).existe).toBe(false);
    const refus = fauxClientProfil({}, { profil_porteur: { code: "42501", message: "rls" } });
    await expect(lireProfil(refus.client, EXPLOITATION, { tolerant: true })).rejects.toMatchObject({ code: "refuse" });
  });
});

describe("branchement du profil aux moteurs", () => {
  it("ne produit rien tant que le porteur n'a rien dit (rien n'est inventé)", async () => {
    const { client } = fauxClientProfil();
    const d = deduireDuProfil(await lireProfil(client, EXPLOITATION));
    expect(d).toEqual({ hypotheses: {}, financement: {}, origines: [] });
  });

  it("ne produit rien pour un « je ne sais pas »", async () => {
    const { client } = fauxClientProfil();
    const d = deduireDuProfil(await ecrireProfil(client, EXPLOITATION, { menageCoutVieAnnuelFcfa: null, apportEspecesFcfa: null }));
    expect(d.hypotheses).toEqual({});
    expect(d.financement).toEqual({});
  });

  it("le coût de vie et les revenus extérieurs alimentent M3, les crédits en cours s'ajoutent aux prélèvements", async () => {
    const { client } = fauxClientProfil();
    const p = await ecrireProfil(client, EXPLOITATION, {
      menageCoutVieAnnuelFcfa: 900000,
      menageRevenusExterieursAnnuelsFcfa: 300000,
      credits: [{ mensualiteFcfa: 10000 }, { mensualiteFcfa: 5000 }],
    });
    const d = deduireDuProfil(p);
    expect(d.hypotheses).toEqual({ prelevementsAnnuels: 900000 + 15000 * 12, revenusExterieursAnnuels: 300000 });
    expect(d.origines.join(" ")).toMatch(/2 crédit\(s\)/);
  });

  it("l'apport en espèces et en nature alimente M4 et R11", async () => {
    const { client } = fauxClientProfil();
    const d = deduireDuProfil(await ecrireProfil(client, EXPLOITATION, { apportEspecesFcfa: 200000, apportNatureFcfa: 150000 }));
    expect(d.financement.apport).toBe(350000);
    const seul = deduireDuProfil(await ecrireProfil(client, EXPLOITATION, { apportEspecesFcfa: null, apportNatureFcfa: 80000 }));
    expect(seul.financement.apport).toBe(80000);
  });
});
