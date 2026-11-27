/**
 * @jest-environment node
 *
 * Test d'intégration du référentiel (migration cultiplan_referentiel, schéma ref) sur la base Supabase LOCALE.
 * Lancement : `npm run db:start` puis `npm run test:base-locale`. Ignoré dans `npm test`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Database } from "@/types/supabase";
import { ajouterAtelier, creerExploitation, lireExploitation, repondreTerrain, type ClientBase } from "@/core/exploitation";
import { calculerFinances, genererBudget } from "@/moteurs";
import { lireModeles, lireQuestionsTerrain, lireRegles, lireSpeculations, preparerBudget } from "..";

const actif = process.env.CULTISIA_BASE_LOCALE === "1";
const decrire = actif ? describe : describe.skip;

interface StatutLocal {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
}

const TOMATE = "test_ref_tomate";
const AUTRE = "test_ref_oignon";
const QUESTION = "test_ref_acces_eau";

decrire("base locale : référentiel ref", () => {
  let statut: StatutLocal;
  let admin: SupabaseClient<Database>;
  let utilisateur: ClientBase;
  let visiteur: ClientBase;
  let userId: string;

  beforeAll(async () => {
    statut = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    if (!statut.API_URL.includes("127.0.0.1") && !statut.API_URL.includes("localhost")) {
      throw new Error("Ce test ne tourne que sur la base locale.");
    }
    admin = createClient<Database>(statut.API_URL, statut.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    visiteur = createClient<Database>(statut.API_URL, statut.ANON_KEY, { auth: { persistSession: false } });

    const email = `test-${randomUUID()}@cultiso.test`;
    const motDePasse = randomUUID();
    const cree = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
    if (cree.error) throw cree.error;
    userId = cree.data.user.id;
    utilisateur = createClient<Database>(statut.API_URL, statut.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await utilisateur.auth.signInWithPassword({ email, password: motDePasse });
    if (session.error) throw session.error;

    // Données de test, écrites par le serveur (seul autorisé à écrire dans ref).
    const r = admin.schema("ref");
    const specs = await r.from("speculations").insert([
      { code: TOMATE, nom: "Tomate (test)", secteur: "vegetal", unite_echelle: "ha", duree_cycle_jours: 120, cycles_par_an: 1, statut: "validee", source: "Test", valide_le: "2026-11-27T00:00:00Z" },
      { code: AUTRE, nom: "Oignon (test)", secteur: "vegetal", unite_echelle: "ha", cycles_par_an: 2 },
    ], { defaultToNull: false });
    if (specs.error) throw specs.error;
    const charges = await r.from("modeles_charges").insert([
      { speculation_code: TOMATE, type_charge: "intrants", libelle: "Semences", unite: "sachet", quantite: 1, prix_reference: 150_000, nature: "variable", classe: "exploitation", ordre: 1, statut: "validee", source: "Test", mois_decaissement: [1] },
      { speculation_code: TOMATE, type_charge: "intrants", libelle: "Engrais NPK", unite: "sac", quantite: 8, prix_reference: 25_000, nature: "variable", classe: "exploitation", ordre: 2 },
      { speculation_code: TOMATE, type_charge: "infrastructures", libelle: "Pulvérisateur", unite: "unité", quantite: 0.5, prix_reference: 60_000, nature: "fixe", classe: "investissement", duree_vie_ans: 3, ordre: 3 },
    ], { defaultToNull: false });
    if (charges.error) throw charges.error;
    const revenus = await r.from("modeles_revenus").insert({
      speculation_code: TOMATE, type_revenu: "principal", libelle: "Tomate fraîche", unite: "kg",
      quantite_pessimiste: 10_000, quantite_realiste: 15_000, quantite_optimiste: 18_000, pertes: 0.3, prix_reference: 150, mois_vente: [4, 5],
    });
    if (revenus.error) throw revenus.error;
    const question = await r.from("questions_terrain").insert({
      cle: QUESTION, libelle: "Comment arroses-tu ?", sous_titre: "L'eau change le budget.",
      reponses: [{ valeur: "pluie", libelle: "Pluie seulement" }, { valeur: "motopompe", libelle: "Motopompe" }],
      secteurs: ["vegetal"], ordre: -100,
    });
    if (question.error) throw question.error;
    const regles = await r.from("regles_ajustement").insert([
      { cle_question: QUESTION, valeur: "motopompe", speculation_code: TOMATE, effet: "ajouter_ligne",
        ligne: { typeCharge: "energie", libelle: "Carburant d'irrigation", unite: "litre", quantite: 200, prixReference: 700, nature: "variable", classe: "exploitation" } },
      { cle_question: QUESTION, valeur: "motopompe", speculation_code: AUTRE, effet: "multiplier", cible_sens: "charge", coefficient: 2 },
    ], { defaultToNull: false });
    if (regles.error) throw regles.error;
  }, 300000);

  afterAll(async () => {
    await admin.auth.admin.deleteUser(userId);
    await admin.schema("ref").from("questions_terrain").delete().eq("cle", QUESTION);
    await admin.schema("ref").from("speculations").delete().in("code", [TOMATE, AUTRE]);
  });

  it("lit les spéculations, avec leur statut", async () => {
    const specs = await lireSpeculations(utilisateur, { codes: [TOMATE, AUTRE] });
    expect(specs.map((s) => [s.code, s.cyclesParAn, s.statut])).toEqual([
      [AUTRE, 2, "brouillon_ia"],
      [TOMATE, 1, "validee"],
    ]);
  });

  it("un visiteur ne voit que les données validées", async () => {
    const specs = await lireSpeculations(visiteur, { codes: [TOMATE, AUTRE] });
    expect(specs.map((s) => s.code)).toEqual([TOMATE]);
    const modeles = await lireModeles(visiteur, [TOMATE]);
    expect(modeles.modelesCharges.map((c) => c.libelle)).toEqual(["Semences"]);
    expect(modeles.modelesRevenus).toEqual([]);
  });

  it("un utilisateur ne peut pas écrire dans le référentiel", async () => {
    const ecriture = await utilisateur.schema("ref").from("speculations").insert({ code: "test_ref_pirate", nom: "Pirate", secteur: "vegetal", unite_echelle: "ha" });
    expect(ecriture.error).not.toBeNull();
    const maj = await utilisateur.schema("ref").from("modeles_charges").update({ prix_reference: 1 }).eq("speculation_code", TOMATE).select("id");
    expect(maj.data ?? []).toEqual([]);
  });

  it("lit les modèles dans l'ordre, convertis pour le moteur", async () => {
    const { modelesCharges, modelesRevenus } = await lireModeles(utilisateur, [TOMATE]);
    expect(modelesCharges.map((c) => [c.libelle, c.quantite, c.classe, c.statut])).toEqual([
      ["Semences", 1, "exploitation", "validee"],
      ["Engrais NPK", 8, "exploitation", "brouillon_ia"],
      ["Pulvérisateur", 0.5, "investissement", "brouillon_ia"],
    ]);
    expect(modelesCharges[0].moisDecaissement).toEqual([1]);
    expect(modelesRevenus[0]).toMatchObject({ quantite: { pessimiste: 10_000, realiste: 15_000, optimiste: 18_000 }, pertes: 0.3, moisVente: [4, 5] });
  });

  it("lit les questions de terrain d'un secteur et les règles applicables", async () => {
    const questions = await lireQuestionsTerrain(utilisateur, ["vegetal"]);
    expect(questions.find((q) => q.cle === QUESTION)?.reponses).toHaveLength(2);
    expect((await lireQuestionsTerrain(utilisateur, ["animal"])).some((q) => q.cle === QUESTION)).toBe(false);
    const regles = await lireRegles(utilisateur, [TOMATE]);
    expect(regles.filter((r) => r.cleQuestion === QUESTION).map((r) => r.effet)).toEqual(["ajouter_ligne"]);
  });

  it("la base refuse une donnée incohérente", async () => {
    const r = admin.schema("ref");
    const sansDuree = await r.from("modeles_charges").insert({ speculation_code: TOMATE, type_charge: "infrastructures", libelle: "Hangar", unite: "u", quantite: 1, prix_reference: 1, nature: "fixe", classe: "investissement" });
    expect(sansDuree.error?.code).toBe("23514");
    const scenarios = await r.from("modeles_revenus").insert({ speculation_code: TOMATE, type_revenu: "principal", libelle: "Incohérent", unite: "kg", quantite_pessimiste: 10, quantite_realiste: 5, quantite_optimiste: 20, prix_reference: 1 });
    expect(scenarios.error?.code).toBe("23514");
    const typeInconnu = await r.from("modeles_charges").insert({ speculation_code: TOMATE, type_charge: "semences_tomate", libelle: "Colonne métier", unite: "u", quantite: 1, prix_reference: 1, nature: "variable", classe: "exploitation" });
    expect(typeInconnu.error?.code).toBe("23514");
  });

  it("de l'exploitation au budget puis aux résultats, de bout en bout", async () => {
    const e = await creerExploitation(utilisateur, { nom: "Ferme test référentiel" });
    await ajouterAtelier(utilisateur, e.id, { speculationCode: TOMATE, taille: 2, unite: "ha" });
    await repondreTerrain(utilisateur, e.id, { cle: QUESTION, valeur: "motopompe" });

    const entree = await preparerBudget(utilisateur, await lireExploitation(utilisateur, e.id));
    const budget = genererBudget(entree);
    expect(budget.charges.map((c) => [c.libelle, c.quantite, c.origine])).toEqual([
      ["Semences", 2, "reference"],
      ["Engrais NPK", 16, "estimation"],
      ["Pulvérisateur", 1, "estimation"],
      ["Carburant d'irrigation", 400, "ajustee_terrain"],
    ]);

    const resultats = calculerFinances({ charges: budget.charges, revenus: budget.revenus });
    // 30 000 kg × 150 × 0,7 ; charges variables 300 000 + 400 000 + 280 000 ; amortissement 60 000 / 3.
    expect(resultats.scenarios.realiste.annees[0]).toMatchObject({
      chiffreAffaires: 3_150_000,
      chargesVariables: 980_000,
      amortissements: 20_000,
      resultat: 2_150_000,
    });
    expect(resultats.investissementTotal).toBe(60_000);
  });

  it("données de départ : import rejouable puis budget de 2 ha de tomate et 500 poulets", async () => {
    const importer = () =>
      execSync("node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/importer-referentiel.mjs", {
        stdio: "ignore",
        env: { ...process.env, REFERENTIEL_API_URL: statut.API_URL, REFERENTIEL_CLE_SERVICE: statut.SERVICE_ROLE_KEY },
      });
    importer();
    importer();
    const specs = await lireSpeculations(utilisateur, { codes: ["tomate", "poulet_chair"] });
    expect(specs.map((s) => s.code).sort()).toEqual(["poulet_chair", "tomate"]);
    expect((await lireQuestionsTerrain(utilisateur)).filter((q) => !q.cle.startsWith("test_"))).toHaveLength(16);

    const e = await creerExploitation(utilisateur, { nom: "Ferme de départ" });
    await ajouterAtelier(utilisateur, e.id, { speculationCode: "tomate", taille: 2, unite: "ha" });
    await ajouterAtelier(utilisateur, e.id, { speculationCode: "poulet_chair", taille: 500, unite: "sujet" });
    await repondreTerrain(utilisateur, e.id, { cle: "eau", valeur: "motopompe" });
    await repondreTerrain(utilisateur, e.id, { cle: "alimentation", valeur: "industriel" });

    const budget = genererBudget(await preparerBudget(utilisateur, await lireExploitation(utilisateur, e.id)));
    expect(budget.charges.find((c) => c.libelle === "Carburant de la motopompe")).toMatchObject({ quantite: 20, origine: "ajustee_terrain" });
    expect(budget.charges.filter((c) => c.libelle.startsWith("Aliment")).every((c) => c.origine === "ajustee_terrain")).toBe(true);
    expect(budget.charges.find((c) => c.libelle === "Poussins d'un jour")?.cyclesParAn).toBe(4);
    const f = calculerFinances({ charges: budget.charges, revenus: budget.revenus });
    expect(f.scenarios.realiste.annees[0].chiffreAffaires).toBeGreaterThan(0);
  }, 300000);
});
