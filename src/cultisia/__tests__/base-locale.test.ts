/**
 * @jest-environment node
 *
 * Test d'intégration sur la base Supabase LOCALE (Docker). Ne touche jamais la base en ligne.
 * Lancement : `npm run db:start` puis `npm run test:base-locale`. Ignoré dans `npm test`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { CreditsSupabase } from "../supabase/credits";
import { DonneesSupabase } from "../supabase/donnees";
import type { Embeddeur } from "../supabase/embeddings";
import { appel, FauxModele, texte, usage, type TourScripte } from "../llm/faux-modele";
import { fabriqueSupabase, traiterCultisia, type FabriqueCultisia } from "../serveur";
import { calculerPlan } from "../outils/calcul";
import { lireSSE } from "../test-utils/utilitaires";

const actif = process.env.CULTISIA_BASE_LOCALE === "1";
const decrire = actif ? describe : describe.skip;

interface StatutLocal {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
}

const vecteur = (valeur: number) => Array.from({ length: 384 }, (_, i) => (i === 0 ? valeur : 0.01));
const embeddeurFixe = (v: number[] | null): Embeddeur => ({ requete: async () => v });

decrire("base locale : migration cultisia_noyau et accès aux données", () => {
  let statut: StatutLocal;
  let admin: SupabaseClient;
  const utilisateurs: { id: string; jeton: string }[] = [];
  let exploitationId: string;

  const clientDe = (jeton: string) =>
    createClient(statut.API_URL, statut.ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jeton}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

  async function creerUtilisateur(): Promise<{ id: string; jeton: string }> {
    const email = `test-${randomUUID()}@cultiso.test`;
    const motDePasse = randomUUID();
    const { data, error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
    if (error) throw error;
    const anonyme = createClient(statut.API_URL, statut.ANON_KEY, { auth: { persistSession: false } });
    const session = await anonyme.auth.signInWithPassword({ email, password: motDePasse });
    if (session.error) throw session.error;
    const u = { id: data.user.id, jeton: session.data.session.access_token };
    utilisateurs.push(u);
    return u;
  }

  beforeAll(async () => {
    statut = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    if (!statut.API_URL.includes("127.0.0.1") && !statut.API_URL.includes("localhost")) {
      throw new Error("Ce test ne tourne que sur la base locale.");
    }
    admin = createClient(statut.API_URL, statut.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const proprietaire = await creerUtilisateur();
    await creerUtilisateur();

    // Sans `.select()` : historique. Depuis la migration cultiplan_socle, insert().select() fonctionne aussi
    // (voir src/core/__tests__/exploitation-base-locale.test.ts).
    exploitationId = randomUUID();
    const { error } = await clientDe(proprietaire.jeton)
      .from("cultisos")
      .insert({ id: exploitationId, user_id: proprietaire.id, name: "Ferme test de Tsévié", domain: "maraichage", surface_area: 2, surface_unit: "ha", location: "Tsévié" });
    if (error) throw error;
    const op = await clientDe(proprietaire.jeton)
      .from("transactions")
      .insert({ cultiso_id: exploitationId, amount: 72000, type: "expense", category: "Engrais", date: "2026-11-10" });
    if (op.error) throw op.error;
  }, 300000);

  afterAll(async () => {
    for (const u of utilisateurs) await admin.auth.admin.deleteUser(u.id);
    await admin.from("cultisia_knowledge").delete().like("file_name", "Test %");
  });

  it("lit les prix sans tenir compte des accents, avec la source", async () => {
    const donnees = new DonneesSupabase(clientDe(utilisateurs[0].jeton), embeddeurFixe(null));
    for (const terme of ["mais", "maïs", "MAÏS"]) {
      // Seulement les prix du seed : d'autres relevés (annonces importées) peuvent exister en local.
      const lignes = (await donnees.chercherPrix(terme)).filter((l) => l.source === "Donnée de test locale");
      expect(lignes.map((l) => l.lieu)).toEqual(["Lomé, Adawlato", "Kara"]);
      expect(lignes[0]).toMatchObject({ produit: "Maïs grain", prix: 350, unite: "kg", date: "2026-11-20", source: "Donnée de test locale" });
    }
  });

  it("lit l'exploitation du propriétaire, et rien pour un autre utilisateur (RLS)", async () => {
    const proprietaire = new DonneesSupabase(clientDe(utilisateurs[0].jeton), embeddeurFixe(null));
    const resume = await proprietaire.lireExploitation(exploitationId);
    expect(resume).toMatchObject({ nom: "Ferme test de Tsévié", surface: 2, uniteSurface: "ha" });
    expect(resume?.operations).toEqual([{ date: "2026-11-10", type: "expense", categorie: "Engrais", montant: 72000, description: null }]);

    const autre = new DonneesSupabase(clientDe(utilisateurs[1].jeton), embeddeurFixe(null));
    expect(await autre.lireExploitation(exploitationId)).toBeNull();
  });

  it("outils de calcul : référentiel, ateliers de l'exploitation, plan calculé par les moteurs", async () => {
    const donnees = new DonneesSupabase(clientDe(utilisateurs[0].jeton), embeddeurFixe(null));
    const catalogue = await donnees.listerSpeculations();
    // Données de départ importées en local (npm run referentiel:importer).
    expect(catalogue.map((s) => s.code)).toEqual(expect.arrayContaining(["tomate", "poulet_chair"]));
    const entree = await donnees.preparerBudget({ ateliers: [{ id: "a1", speculationCode: "tomate", taille: 1 }], contexte: {} });
    expect(entree.modelesCharges.length).toBeGreaterThan(0);

    expect(await donnees.lireAteliersEtContexte(exploitationId)).toEqual({ ateliers: [], contexte: {} });
    const autre = new DonneesSupabase(clientDe(utilisateurs[1].jeton), embeddeurFixe(null));
    expect(await autre.lireAteliersEtContexte(exploitationId)).toBeNull();

    const r = await calculerPlan.executer!({ ateliers: [{ speculation: "tomate", taille: 1 }] }, { module: "cultiplan", utilisateurId: utilisateurs[0].id, donnees });
    expect(r.contenu).toContain("Plan calculé pour Tomate : 1 ha");
    expect(r.contenu).toContain("estimations");
  });

  it("lit le référentiel : cultures, sols, zones", async () => {
    const donnees = new DonneesSupabase(clientDe(utilisateurs[0].jeton), embeddeurFixe(null));
    expect((await donnees.chercherCultures("cassava")).map((c) => c.slug)).toEqual(expect.arrayContaining(["cassava"]));
    expect((await donnees.chercherSols("sandy loam")).map((s) => s.slug)).toEqual(["sandyloam"]);
    expect(await donnees.listerZones()).toHaveLength(5);
  });

  it("ne renvoie que les documents dont la licence est autorisée", async () => {
    const insertion = await admin.from("cultisia_knowledge").insert([
      { file_name: "Test guide autorisé", file_hash: "a", chunk_index: 0, content: "Extrait autorisé", metadata: { licence: "autorisee" }, embedding: vecteur(1) },
      { file_name: "Test guide non trié", file_hash: "b", chunk_index: 0, content: "Extrait non trié", metadata: {}, embedding: vecteur(1) },
    ]);
    expect(insertion.error).toBeNull();
    const donnees = new DonneesSupabase(clientDe(utilisateurs[0].jeton), embeddeurFixe(vecteur(1)));
    expect((await donnees.chercherSavoir("question")).map((x) => x.document)).toEqual(["Test guide autorisé"]);
    const sansEmbeddings = new DonneesSupabase(clientDe(utilisateurs[0].jeton), embeddeurFixe(null));
    expect(await sansEmbeddings.chercherSavoir("question")).toEqual([]);
  });

  it("débite les crédits : 20 000 offerts une fois, débit atomique, pas de recharge", async () => {
    const u = utilisateurs[1];
    const credits = new CreditsSupabase(admin);
    expect(await credits.solde(u.id)).toBe(20000);
    expect(await credits.debiter(u.id, 120)).toBe(19880);
    expect(await credits.solde(u.id)).toBe(19880);
    expect(await credits.debiter(u.id, 19880)).toBe(0);
    expect(await credits.solde(u.id)).toBe(0);
  });

  it("réserve debiter_credits au serveur et supprime deduct_tokens", async () => {
    const u = utilisateurs[0];
    const parUtilisateur = await clientDe(u.jeton).rpc("debiter_credits", { p_user_id: u.id, p_montant: -1000 });
    expect(parUtilisateur.error?.message).toMatch(/permission denied/);
    const ancienne = await clientDe(u.jeton).rpc("deduct_tokens", { deduction_amount: 1 });
    expect(ancienne.error).not.toBeNull();
    const negatif = await admin.rpc("debiter_credits", { p_user_id: u.id, p_montant: -5 });
    expect(negatif.error?.message).toMatch(/invalide/);
  });

  it("de bout en bout : route réelle, Supabase local, faux modèle (aucune dépense)", async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: statut.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: statut.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: statut.SERVICE_ROLE_KEY,
      CULTISIA_FOURNISSEUR: "openrouter",
      OPENROUTER_API_KEY: "cle-factice-jamais-appelee",
    });
    const reelle = fabriqueSupabase();
    const avecFauxModele = (tours: TourScripte[]): FabriqueCultisia => ({
      ...reelle,
      dependances: (jeton) => ({ ...reelle.dependances(jeton), modele: new FauxModele(tours) }),
    });
    const u = await creerUtilisateur();
    const { data: session } = await clientDe(u.jeton).from("chat_sessions").insert({ user_id: u.id, title: "E2E" }).select("id").single();
    const appeler = (fabrique: FabriqueCultisia, corps: Record<string, unknown>) =>
      traiterCultisia(
        new Request("http://localhost/api/cultisia", {
          method: "POST",
          headers: { Authorization: `Bearer ${u.jeton}`, "Content-Type": "application/json" },
          body: JSON.stringify(corps),
        }),
        (b) => b,
        { fabrique },
      );

    const reponse = await appeler(
      avecFauxModele([[appel("lire_prix", { produits: ["maïs"], lieu: "Lomé" }), usage(300)], [texte("350 FCFA/kg à Lomé."), usage(200)]]),
      { module: "cultisia", sessionId: session!.id, messages: [{ role: "user", content: "Prix du maïs à Lomé ?" }] },
    );
    expect(reponse.status).toBe(200);
    const evenements = await lireSSE(reponse.body!);
    expect(evenements[0]).toMatchObject({ type: "sources" });
    expect(evenements[0].sources).toEqual(
      expect.arrayContaining([expect.objectContaining({ file_name: "Cours des prix Cultiso : Maïs grain (2026-11-20)" })]),
    );
    expect(evenements.at(-1)).toEqual({ type: "done", jetons: 500, solde: 19500 });

    const { data: rattachee } = await clientDe(u.jeton).from("chat_sessions").select("module").eq("id", session!.id).single();
    expect(rattachee).toEqual({ module: "cultisia" });

    await new CreditsSupabase(admin).debiter(u.id, 19500);
    const refus = await appeler(avecFauxModele([]), { module: "cultisia", messages: [{ role: "user", content: "Encore ?" }] });
    expect(refus.status).toBe(402);
  });

  it("rattache une conversation à l'exploitation et au module, et refuse un module inconnu", async () => {
    const u = utilisateurs[0];
    const client = clientDe(u.jeton);
    const { data: session, error } = await client.from("chat_sessions").insert({ user_id: u.id, title: "Test" }).select("id").single();
    expect(error).toBeNull();
    const maj = await client.from("chat_sessions").update({ exploitation_id: exploitationId, module: "cultima" }).eq("id", session!.id);
    expect(maj.error).toBeNull();
    const mauvais = await client.from("chat_sessions").update({ module: "cultishop" }).eq("id", session!.id);
    expect(mauvais.error?.message).toMatch(/chat_sessions_module_check/);
  });
});
