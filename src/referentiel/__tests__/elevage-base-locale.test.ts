/**
 * @jest-environment node
 *
 * Test d'intégration de ref.courbes_age et ref.parametres_elevage (M14) sur la base Supabase LOCALE.
 * Lancement : `npm run db:start` puis `npm run test:base-locale`. Ignoré dans `npm test`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import type { Database } from "@/types/supabase";
import type { ClientBase } from "@/core/exploitation";
import { simulerAtelierAnimal } from "@/modules/cultiplan/atelier-animal";
import { lireVariantesElevage } from "../elevage";

jest.setTimeout(60000);
const actif = process.env.CULTISIA_BASE_LOCALE === "1";
const decrire = actif ? describe : describe.skip;

decrire("base locale : courbes par âge (M14)", () => {
  let admin: SupabaseClient<Database>;
  let visiteur: ClientBase;

  beforeAll(() => {
    const statut = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
    if (!statut.API_URL.includes("127.0.0.1") && !statut.API_URL.includes("localhost")) throw new Error("Ce test ne tourne que sur la base locale.");
    admin = createClient<Database>(statut.API_URL, statut.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    visiteur = createClient<Database>(statut.API_URL, statut.ANON_KEY, { auth: { persistSession: false } }) as unknown as ClientBase;
  });

  it("la poule pondeuse a trois courbes de 19 mois en brouillon, avec source ; le poulet de chair n'a qu'un point de poids", async () => {
    const [poule] = await lireVariantesElevage(admin as unknown as ClientBase, "poule_pondeuse").then((v) => v.filter((x) => x.variante === "burkina_doc00686"));
    expect(poule.courbes.mortalite).toHaveLength(19);
    expect(poule.courbes.consommation).toHaveLength(19);
    expect(poule.courbes.production).toHaveLength(19);
    expect(poule.statut).toBe("brouillon_ia");
    expect(poule.sources.join(" ")).toContain("DOC-00686");
    expect(poule.parametres.jours_par_mois?.valeur).toBe(30);
    const chair = await lireVariantesElevage(admin as unknown as ClientBase, "poulet_chair");
    expect(chair[0].courbes.mortalite).toEqual([]);
    expect(chair[0].courbes.poids).toEqual([{ age: 2, valeur: 1.8 }]);
  });

  it("les visiteurs ne voient rien tant que rien n'est validé ; la base refuse une valeur sans source ou hors limites", async () => {
    expect(await lireVariantesElevage(visiteur, "poule_pondeuse")).toEqual([]);
    const sansSource = await admin.schema("ref").from("courbes_age").insert({ speculation_code: "poule_pondeuse", variante: "test", grandeur: "mortalite", age_mois: 1, valeur: 0.1, unite: "part", source: "", date_source: "2026-11-27" });
    expect(sansSource.error).not.toBeNull();
    const horsLimite = await admin.schema("ref").from("courbes_age").insert({ speculation_code: "poule_pondeuse", variante: "test", grandeur: "mortalite", age_mois: 1, valeur: 1.5, unite: "part", source: "Document d'essai", date_source: "2026-11-27" });
    expect(horsLimite.error).not.toBeNull();
    const nonValidee = await admin.schema("ref").from("courbes_age").insert({ speculation_code: "poule_pondeuse", variante: "test", grandeur: "poids", age_mois: 1, valeur: 1, unite: "kg", source: "Document d'essai", date_source: "2026-11-27", statut: "validee" });
    expect(nonValidee.error).not.toBeNull();
  });

  it("l'atelier de la poule pondeuse se calcule avec les vraies courbes et dit qu'elles sont à valider", async () => {
    const variantes = await lireVariantesElevage(admin as unknown as ClientBase, "poule_pondeuse");
    const r = simulerAtelierAnimal({
      speculation: "Poule pondeuse",
      variantes,
      parametres: { variante: "burkina_doc00686", bandes: [{ debutMois: 1, effectif: 1000 }], prix: { animal: 700, aliment: 210, produit: 2000 / 30, reforme: 2250 } },
    });
    expect(r.statut).toBe("calculee");
    expect(r.donneesNonValidees).toBe(true);
    expect(r.resultat?.coutAnimalPretAProduire?.moisImproductifs).toBe(5);
  });
});
