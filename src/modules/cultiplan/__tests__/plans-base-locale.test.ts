/**
 * @jest-environment node
 *
 * Test d'intégration du plan persistant (migration cultiplan_plans) sur la base Supabase LOCALE (Docker).
 * Lancement : `npm run db:start` puis `npm run test:base-locale`. Ignoré dans `npm test`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Database } from "@/types/supabase";
import { ajouterAtelier, creerExploitation, repondreTerrain, type ClientBase } from "@/core/exploitation";
import { VERSION_MOTEURS } from "@/moteurs";
import {
  ajouterLigne,
  corrigerLigne,
  dupliquerPlan,
  genererPlan,
  listerPlans,
  lirePlan,
  modifierPlan,
  recalculer,
  supprimerLigne,
  supprimerPlan,
  type LigneChargePlan,
  type Plan,
} from "..";

const actif = process.env.CULTISIA_BASE_LOCALE === "1";
const decrire = actif ? describe : describe.skip;

interface StatutLocal {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
}

const SPEC = "test_plan_tomate";
const PRODUIT = `Test engrais plan ${randomUUID().slice(0, 8)}`;
const AUJOURDHUI = new Date("2026-11-27T08:00:00Z");

decrire("base locale : plan persistant Cultiplan", () => {
  let statut: StatutLocal;
  let admin: SupabaseClient<Database>;
  const ids: string[] = [];
  const clients: Record<"proprietaire" | "collaborateur" | "lecteur" | "etranger", ClientBase> = {} as never;
  const userIds: Record<string, string> = {};
  let produitId: string;
  let exploitationId: string;
  let plan: Plan;

  async function connecter(): Promise<{ id: string; client: ClientBase }> {
    const email = `test-${randomUUID()}@cultiso.test`;
    const motDePasse = randomUUID();
    const { data, error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
    if (error) throw error;
    ids.push(data.user.id);
    const client = createClient<Database>(statut.API_URL, statut.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await client.auth.signInWithPassword({ email, password: motDePasse });
    if (session.error) throw session.error;
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    statut = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    if (!statut.API_URL.includes("127.0.0.1") && !statut.API_URL.includes("localhost")) {
      throw new Error("Ce test ne tourne que sur la base locale.");
    }
    admin = createClient<Database>(statut.API_URL, statut.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    for (const role of ["proprietaire", "collaborateur", "lecteur", "etranger"] as const) {
      const u = await connecter();
      clients[role] = u.client;
      userIds[role] = u.id;
    }

    // Référentiel de test : 1 ha de tomate, deux cycles par an.
    const ref = admin.schema("ref");
    const s = await ref.from("speculations").upsert({ code: SPEC, nom: "Test tomate plan", secteur: "vegetal", unite_echelle: "ha", cycles_par_an: 2 });
    if (s.error) throw s.error;
    const c = await ref.from("modeles_charges").insert(
      [
        { speculation_code: SPEC, type_charge: "intrants", libelle: "Engrais", unite: "sac", quantite: 4, prix_reference: 18000, produit_prix: PRODUIT, nature: "variable", classe: "exploitation", ordre: 1 },
        { speculation_code: SPEC, type_charge: "main_oeuvre", libelle: "Main-d'œuvre", unite: "jour", quantite: 60, prix_reference: 2000, nature: "variable", classe: "exploitation", ordre: 2 },
        { speculation_code: SPEC, type_charge: "infrastructures", libelle: "Motopompe", unite: "unité", quantite: 1, prix_reference: 300000, base: "an", nature: "fixe", classe: "investissement", duree_vie_ans: 5, ordre: 3 },
      ],
      { defaultToNull: false },
    );
    if (c.error) throw c.error;
    const r = await ref.from("modeles_revenus").insert({
      speculation_code: SPEC, type_revenu: "principal", libelle: "Vente de tomates", unite: "kg",
      quantite_pessimiste: 6000, quantite_realiste: 8000, quantite_optimiste: 10000, pertes: 0.2, prix_reference: 150,
    });
    if (r.error) throw r.error;
    const question = await ref.from("questions_terrain").upsert({
      cle: "test_plan_acces", libelle: "Accès (test)", reponses: [{ valeur: "isole", libelle: "Isolé" }], ordre: 999,
    });
    if (question.error) throw question.error;
    const regle = await ref.from("regles_ajustement").insert({
      cle_question: "test_plan_acces", valeur: "isole", speculation_code: SPEC, effet: "multiplier",
      cible_sens: "charge", cible_type: "main_oeuvre", coefficient: 1.5,
    });
    if (regle.error) throw regle.error;

    // Prix du marché : un relevé récent au sac (retenu), un plus ancien, un trop vieux (ignoré).
    const p = await admin.from("products").insert({ name: PRODUIT, category: "intrants", default_unit: "sac" }).select("id").single();
    if (p.error) throw p.error;
    produitId = p.data.id;
    const releves = await admin.from("price_records").insert(
      [
        { product_id: produitId, price: 21000, unit: "sac", location: "Lomé", record_date: "2026-11-10", source: "Relevé test" },
        { product_id: produitId, price: 19000, unit: "sac", location: "Kara", record_date: "2026-09-01", source: "Relevé test" },
        { product_id: produitId, price: 99000, unit: "sac", location: "Lomé", record_date: "2025-01-01", source: "Trop vieux" },
      ],
      { defaultToNull: false },
    );
    if (releves.error) throw releves.error;

    const e = await creerExploitation(clients.proprietaire, { nom: "Ferme test plan", lieu: "Tsévié" });
    exploitationId = e.id;
    const membres = await admin.from("cultiso_members").insert([
      { cultiso_id: e.id, user_id: userIds.collaborateur, role: "collaborator" },
      { cultiso_id: e.id, user_id: userIds.lecteur, role: "viewer" },
    ]);
    if (membres.error) throw membres.error;
    await ajouterAtelier(clients.proprietaire, e.id, { speculationCode: SPEC, taille: 2, unite: "ha" });
    await repondreTerrain(clients.proprietaire, e.id, { cle: "test_plan_acces", valeur: "isole" });
  }, 300000);

  afterAll(async () => {
    if (exploitationId) await admin.from("cultisos").delete().eq("id", exploitationId);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
    await admin.schema("ref").from("regles_ajustement").delete().eq("cle_question", "test_plan_acces");
    await admin.schema("ref").from("questions_terrain").delete().eq("cle", "test_plan_acces");
    await admin.schema("ref").from("speculations").delete().eq("code", SPEC);
    if (produitId) await admin.from("products").delete().eq("id", produitId);
  });

  it("génère le plan depuis l'exploitation : lignes avec origine, prix du marché, règles du terrain, résultats du moteur", async () => {
    plan = await genererPlan(clients.proprietaire, exploitationId, { titre: "Tomate 2 ha", financement: { apport: 200000 } }, { aujourdhui: AUJOURDHUI });
    expect(plan).toMatchObject({ titre: "Tomate 2 ha", version: 1, statut: "brouillon", varianteDe: null, versionMoteur: VERSION_MOTEURS });
    expect(plan.financement).toEqual({ apport: 200000, credit: null, moisTirageCredit: 0, regleFinanceur: null });
    // R1, R4 : la spéculation d'essai n'a ni itinéraire ni profil dans le référentiel : le plan le dit et garde l'ancien calendrier.
    expect(plan.generation.calendrier?.notes.join(' ')).toContain('dès la première année');
    expect(plan.hypotheses.montee).toEqual([]);
    expect(plan.moteurObsolete).toBe(false);
    expect(plan.hypotheses.horizonAnnees).toBe(3);
    expect(plan.lignes).toHaveLength(4);

    const engrais = plan.lignes.find((l) => l.libelle === "Engrais") as LigneChargePlan;
    expect(engrais).toMatchObject({ origine: "prix_marche", prixUnitaire: 21000, quantite: 8, cyclesParAn: 2, sourcePrix: { source: "Relevé test, Lomé", date: "2026-11-10" } });
    const mo = plan.lignes.find((l) => l.libelle === "Main-d'œuvre") as LigneChargePlan;
    expect(mo).toMatchObject({ origine: "ajustee_terrain", quantite: 180 });
    expect(mo.ajustements).toEqual([expect.objectContaining({ effet: "multiplier", coefficient: 1.5 })]);
    expect(plan.lignes.find((l) => l.libelle === "Motopompe")).toMatchObject({ origine: "estimation", classe: "investissement", dureeVieAns: 5 });
    expect(plan.generation.prixMarche).toEqual([expect.objectContaining({ prix: 21000, date: "2026-11-10" })]);

    // Chiffres du moteur : CA réaliste an 1 = 2 ha × 8 000 kg × 150 × (1 − 0,2) × 2 cycles = 3 840 000.
    expect(plan.resultats?.scenarios.realiste.annees[0].chiffreAffaires).toBe(3_840_000);
    // Motopompe : 1 par ha, donc 2 pour 2 ha.
    expect(plan.resultats?.investissementTotal).toBe(600_000);

    const relu = await lirePlan(clients.lecteur, plan.id);
    expect(relu.resultats).toEqual(plan.resultats);
    expect(await listerPlans(clients.collaborateur, exploitationId)).toEqual([expect.objectContaining({ id: plan.id, version: 1 })]);
  });

  it("corrige une ligne : origine « utilisateur », nouvelle version, résultats recalculés", async () => {
    const engrais = plan.lignes.find((l) => l.libelle === "Engrais")!;
    const avant = plan.resultats!.scenarios.realiste.annees[0].resultat;
    const apres = await corrigerLigne(clients.collaborateur, plan.id, engrais.id, { prixUnitaire: 25000 });
    expect(apres.version).toBe(2);
    expect(apres.lignes.find((l) => l.id === engrais.id)).toMatchObject({ origine: "utilisateur", prixUnitaire: 25000, sourcePrix: null });
    // 8 sacs × 4 000 FCFA de plus × 2 cycles = 64 000 de résultat en moins.
    expect(apres.resultats!.scenarios.realiste.annees[0].resultat).toBe(avant - 64_000);
    plan = apres;
  });

  it("ajoute puis retire une ligne, change les hypothèses et le financement", async () => {
    const avecLigne = await ajouterLigne(clients.proprietaire, plan.id, {
      sens: "revenu", type: "coproduit", libelle: "Plants vendus", unite: "plant", base: "an",
      quantites: { pessimiste: 500, realiste: 1000, optimiste: 1500 }, prixUnitaire: 50,
    });
    const plants = avecLigne.lignes.find((l) => l.libelle === "Plants vendus")!;
    expect(plants.origine).toBe("utilisateur");
    expect(avecLigne.resultats!.scenarios.realiste.annees[0].chiffreAffaires).toBe(3_840_000 + 50_000);

    const sans = await supprimerLigne(clients.proprietaire, plan.id, plants.id);
    expect(sans.lignes).toHaveLength(4);

    const finance = await modifierPlan(clients.proprietaire, plan.id, {
      hypotheses: { horizonAnnees: 5 },
      financement: { credit: { montant: 500000, tauxAnnuel: 0.24, dureeMois: 12 } },
    });
    expect(finance.hypotheses).toMatchObject({ horizonAnnees: 5, tauxActualisation: 0.12 });
    expect(finance.financement).toMatchObject({ apport: 200000, credit: { montant: 500000 } });
    expect(finance.resultats!.scenarios.realiste.annees).toHaveLength(5);
    expect(finance.resultats!.scenarios.realiste.annees[0].interets).toBeGreaterThan(0);
    expect(finance.version).toBe(5);

    await expect(modifierPlan(clients.proprietaire, plan.id, { hypotheses: { horizonAnnees: 11 } })).rejects.toMatchObject({ code: "invalide" });
    plan = finance;
  });

  it("le lecteur lit mais ne modifie pas ; l'étranger ne voit rien", async () => {
    const ligne = plan.lignes[0];
    await expect(corrigerLigne(clients.lecteur, plan.id, ligne.id, { quantite: 1 })).rejects.toMatchObject({ code: "refuse" });
    await expect(recalculer(clients.lecteur, plan.id)).rejects.toMatchObject({ code: "refuse" });
    await expect(genererPlan(clients.lecteur, exploitationId, {}, { aujourdhui: AUJOURDHUI })).rejects.toMatchObject({ code: "refuse" });
    await expect(lirePlan(clients.etranger, plan.id)).rejects.toMatchObject({ code: "introuvable" });
    const lignes = await clients.etranger.from("plan_lignes").select("id").eq("plan_id", plan.id);
    expect(lignes.data).toEqual([]);
  });

  it("« Et si ? » : la variante copie les lignes et reste indépendante", async () => {
    const variante = await dupliquerPlan(clients.collaborateur, plan.id, "Et si le prix baisse ?");
    expect(variante).toMatchObject({ varianteDe: plan.id, version: 1, statut: "brouillon", titre: "Et si le prix baisse ?" });
    expect(variante.lignes.map((l) => [l.libelle, l.origine])).toEqual(plan.lignes.map((l) => [l.libelle, l.origine]));
    // Les lignes copiées ont de nouveaux identifiants (ligneId, et id dans la grille mensuelle) : on compare les résultats sans eux.
    const sansIds = (r: unknown) => JSON.parse(JSON.stringify(r).replace(/"(ligneId|id)":"[^"]*"/g, '"$1":""'));
    expect(sansIds(variante.resultats)).toEqual(sansIds(plan.resultats));

    const vente = variante.lignes.find((l) => l.sens === "revenu")!;
    const baisse = await corrigerLigne(clients.collaborateur, variante.id, vente.id, { prixUnitaire: 100 });
    expect(baisse.resultats!.scenarios.realiste.annees[0].chiffreAffaires).toBe(2_560_000);
    expect((await lirePlan(clients.proprietaire, plan.id)).resultats).toEqual(plan.resultats);
  });

  it("un plan lancé est figé, pour le service comme pour la base", async () => {
    const lance = await modifierPlan(clients.proprietaire, plan.id, { statut: "lance" });
    expect(lance).toMatchObject({ statut: "lance", version: plan.version, versionMoteur: VERSION_MOTEURS });
    await expect(recalculer(clients.proprietaire, plan.id)).rejects.toMatchObject({ code: "fige" });
    await expect(corrigerLigne(clients.proprietaire, plan.id, plan.lignes[0].id, { quantite: 1 })).rejects.toMatchObject({ code: "fige" });
    await expect(modifierPlan(clients.proprietaire, plan.id, { hypotheses: { horizonAnnees: 2 } })).rejects.toMatchObject({ code: "fige" });

    // En contournant le service, la base refuse aussi.
    const direct = await clients.proprietaire.from("plan_lignes").update({ quantite: 1 }).eq("id", plan.lignes[0].id).select("id");
    expect(direct.data).toEqual([]);
    const ajout = await clients.proprietaire.from("plan_lignes").insert({ plan_id: plan.id, sens: "charge", type: "intrants", libelle: "Fraude", unite: "u", quantite: 1, prix_unitaire: 1, nature: "fixe", classe: "exploitation", origine: "utilisateur" });
    expect(ajout.error?.code).toBe("42501");

    // Le titre reste modifiable ; la variante d'un plan lancé est possible.
    expect((await modifierPlan(clients.proprietaire, plan.id, { titre: "Tomate 2 ha (banque)" })).titre).toBe("Tomate 2 ha (banque)");
    expect((await dupliquerPlan(clients.proprietaire, plan.id)).titre).toBe("Et si ? Tomate 2 ha (banque)");
  });

  it("seul le propriétaire supprime un plan ; la base refuse une origine inconnue", async () => {
    await expect(supprimerPlan(clients.collaborateur, plan.id)).rejects.toMatchObject({ code: "introuvable" });
    const origine = await admin.from("plan_lignes").update({ origine: "magie" }).eq("id", plan.lignes[0].id);
    expect(origine.error?.code).toBe("23514");
    await supprimerPlan(clients.proprietaire, plan.id);
    await expect(lirePlan(clients.proprietaire, plan.id)).rejects.toMatchObject({ code: "introuvable" });
  });
});
