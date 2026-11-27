/**
 * @jest-environment node
 *
 * Test d'intégration de ref.regles_financeurs (R11) sur la base Supabase LOCALE.
 * Lancement : `npm run db:start` puis `npm run test:base-locale`. Ignoré dans `npm test`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Database } from "@/types/supabase";
import type { ClientBase } from "@/core/exploitation";
import { lireReglesFinanceurs, trouverRegleFinanceur, versRegleMoteur } from "..";

jest.setTimeout(60000);
const actif = process.env.CULTISIA_BASE_LOCALE === "1";
const decrire = actif ? describe : describe.skip;

const ORGANISME = "Test Financeur";
const BROUILLON = "test_brouillon";
const VALIDE = "test_valide";

decrire("base locale : ref.regles_financeurs", () => {
  let admin: SupabaseClient<Database>;
  let utilisateur: ClientBase;
  let visiteur: ClientBase;
  let userId: string;

  beforeAll(async () => {
    const statut = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) as {
      API_URL: string;
      ANON_KEY: string;
      SERVICE_ROLE_KEY: string;
    };
    if (!statut.API_URL.includes("127.0.0.1") && !statut.API_URL.includes("localhost")) {
      throw new Error("Ce test ne tourne que sur la base locale.");
    }
    admin = createClient<Database>(statut.API_URL, statut.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    visiteur = createClient<Database>(statut.API_URL, statut.ANON_KEY, { auth: { persistSession: false } });
    // Nettoie d'éventuels restes d'une exécution interrompue.
    await admin.schema("ref").from("regles_financeurs").delete().eq("organisme", ORGANISME);
    const email = `test-${randomUUID()}@cultiso.test`;
    const motDePasse = randomUUID();
    const cree = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
    if (cree.error) throw cree.error;
    userId = cree.data.user.id;
    utilisateur = createClient<Database>(statut.API_URL, statut.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await utilisateur.auth.signInWithPassword({ email, password: motDePasse });
    if (session.error) throw session.error;

    const ecriture = await admin.schema("ref").from("regles_financeurs").insert(
      [
        { organisme: ORGANISME, produit: BROUILLON, libelle: "Produit en brouillon", apport_minimum: 0.1, duree_max_mois: 24, differe_max_mois: 6 },
        {
          organisme: ORGANISME, produit: VALIDE, libelle: "Produit validé", pays: "TG", apport_minimum: 0.3, duree_max_mois: 36, differe_max_mois: 12,
          taux_indicatif: 0.12, statut: "validee", source: "Test", valide_le: "2026-11-27T00:00:00Z",
        },
      ],
      { defaultToNull: false },
    );
    if (ecriture.error) throw ecriture.error;
  }, 120000);

  afterAll(async () => {
    await admin.schema("ref").from("regles_financeurs").delete().eq("organisme", ORGANISME);
    await admin.auth.admin.deleteUser(userId);
  });

  it("un utilisateur connecté lit les brouillons et les règles validées, avec leur statut", async () => {
    const regles = await lireReglesFinanceurs(utilisateur, { organisme: ORGANISME });
    expect(regles.map((r) => [r.produit, r.statut, r.apportMinimum, r.dureeMaxMois])).toEqual([
      [BROUILLON, "brouillon_ia", 0.1, 24],
      [VALIDE, "validee", 0.3, 36],
    ]);
    const trouvee = await trouverRegleFinanceur(utilisateur, ORGANISME, VALIDE);
    expect(trouvee && versRegleMoteur(trouvee)).toMatchObject({ apportMinimum: 0.3, dureeMaxMois: 36, differeMaxMois: 12 });
  });

  it("un visiteur anonyme ne voit que les règles validées", async () => {
    const regles = await lireReglesFinanceurs(visiteur, { organisme: ORGANISME });
    expect(regles.map((r) => r.produit)).toEqual([VALIDE]);
    expect(await trouverRegleFinanceur(visiteur, ORGANISME, BROUILLON)).toBeNull();
  });

  it("personne, hors serveur, ne peut écrire ni modifier", async () => {
    const insertion = await utilisateur.schema("ref").from("regles_financeurs").insert({ organisme: ORGANISME, produit: "pirate", libelle: "Pirate" });
    expect(insertion.error).not.toBeNull();
    const maj = await utilisateur.schema("ref").from("regles_financeurs").update({ apport_minimum: 0 }).eq("organisme", ORGANISME).select("id");
    expect(maj.data ?? []).toEqual([]);
    const suppression = await utilisateur.schema("ref").from("regles_financeurs").delete().eq("organisme", ORGANISME).select("id");
    expect(suppression.data ?? []).toEqual([]);
    const anonyme = await visiteur.schema("ref").from("regles_financeurs").insert({ organisme: ORGANISME, produit: "pirate2", libelle: "Pirate" });
    expect(anonyme.error).not.toBeNull();
  });

  it("la base refuse une règle incohérente (contraintes CHECK)", async () => {
    const r = admin.schema("ref").from("regles_financeurs");
    const base = { organisme: ORGANISME, libelle: "Incohérent" };
    const code = async (ligne: Record<string, unknown>) => (await r.insert({ ...base, ...ligne } as never)).error?.code;

    expect(await code({ produit: "apport_trop_grand", apport_minimum: 1.5 })).toBe("23514");
    expect(await code({ produit: "apport_negatif", apport_minimum: -0.1 })).toBe("23514");
    expect(await code({ produit: "duree_nulle", duree_max_mois: 0 })).toBe("23514");
    expect(await code({ produit: "differe_trop_long", duree_max_mois: 12, differe_max_mois: 24 })).toBe("23514");
    expect(await code({ produit: "taux_trop_grand", taux_indicatif: 2 })).toBe("23514");
    expect(await code({ produit: "Produit Majuscule" })).toBe("23514");
    expect(await code({ produit: "pays_minuscule", pays: "tg" })).toBe("23514");
    expect(await code({ produit: "statut_inconnu", statut: "valide" })).toBe("23514");
    expect(await code({ produit: "taxes_pas_un_tableau", taxes: { nom: "x" } })).toBe("23514");
    // Une règle validée doit avoir une source et une date de validation.
    expect(await code({ produit: "validee_sans_source", statut: "validee" })).toBe("23514");
    // Unicité (organisme, produit).
    expect(await code({ produit: VALIDE })).toBe("23505");
  });

  it("l'import de départ a posé ANPGF en brouillon IA, avec sa source", async () => {
    const [anpgf] = await lireReglesFinanceurs(utilisateur, { organisme: "ANPGF" });
    expect(anpgf).toMatchObject({ produit: "projet_demarrage", statut: "brouillon_ia", apportMinimum: 0.2, dureeMaxMois: 48, tauxIndicatif: null });
    expect(anpgf.source).toBeTruthy();
  });
});
