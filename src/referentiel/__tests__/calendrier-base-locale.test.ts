/**
 * @jest-environment node
 *
 * Test d'intégration de R1 (itinéraires calendaires) et R4 (profil pluriannuel) sur la base Supabase LOCALE.
 * Lancement : `npm run db:start` puis `CULTISIA_BASE_LOCALE=1 npx jest src/referentiel/__tests__/calendrier-base-locale`. Ignoré dans `npm test`.
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import type { Database } from "@/types/supabase";
import type { ClientBase } from "@/core/exploitation";
import { lireFichesTechniques, lireItinerairesMensuels, lireProfilsPluriannuels } from "../calendrier";

jest.setTimeout(60000);
const actif = process.env.CULTISIA_BASE_LOCALE === "1";
const decrire = actif ? describe : describe.skip;

decrire("base locale : itinéraires calendaires et profil pluriannuel (R1, R4)", () => {
  let admin: ClientBase;
  let visiteur: ClientBase;

  beforeAll(() => {
    const statut = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
    if (!statut.API_URL.includes("127.0.0.1") && !statut.API_URL.includes("localhost")) throw new Error("Ce test ne tourne que sur la base locale.");
    admin = createClient<Database>(statut.API_URL, statut.SERVICE_ROLE_KEY, { auth: { persistSession: false } }) as unknown as ClientBase;
    visiteur = createClient<Database>(statut.API_URL, statut.ANON_KEY, { auth: { persistSession: false } }) as unknown as ClientBase;
  });

  it("la fiche de l'oignon donne densité, eau, fumure datée et conservation, tout en brouillon avec source", async () => {
    const [fiche] = await lireFichesTechniques(admin, "oignon");
    expect(fiche.variante).toBe("senegal_doc00015");
    expect(fiche.statut).toBe("brouillon_ia");
    const v = (code: string) => fiche.valeurs.filter((x) => x.code === code);
    expect(v("densite")[0]).toMatchObject({ min: 66600, unite: "pieds par ha" });
    expect(v("duree_conservation")[0]).toMatchObject({ min: 4, max: 8 });
    expect(v("eau_apport")).toHaveLength(9);
    expect(v("eau_total").find((x) => x.systeme === "goutte_a_goutte")?.min).toBe(3600);
    expect(v("fumure_couverture").map((x) => x.joursApresRepere).sort()).toEqual([20, 20, 40, 40, 60, 60]);
    expect(fiche.sources.join(" ")).toContain("DOC-00015");
  });

  it("aucun profil mensuel n'est saisi (le lot n'en donne pas) ; les autres spéculations n'ont pas de fiche", async () => {
    expect(await lireItinerairesMensuels(admin, "oignon")).toEqual([]);
    expect(await lireFichesTechniques(admin, "tomate")).toEqual([]);
  });

  it("la pondeuse est un cheptel à déclaration obligatoire, l'oignon une annuelle, sans coefficient par année", async () => {
    const [poule] = await lireProfilsPluriannuels(admin, "poule_pondeuse");
    expect(poule).toMatchObject({ type: "cheptel", moisImproductifs: 6, declarationObligatoire: true, coefficientRendement: {} });
    const [oignon] = await lireProfilsPluriannuels(admin, "oignon");
    expect(oignon).toMatchObject({ type: "annuelle", declarationObligatoire: false });
    expect(await lireProfilsPluriannuels(admin, "tomate")).toEqual([]);
  });

  it("un visiteur ne lit rien tant que rien n'est validé", async () => {
    expect(await lireFichesTechniques(visiteur, "oignon")).toEqual([]);
    expect(await lireProfilsPluriannuels(visiteur, "poule_pondeuse")).toEqual([]);
  });

  it("la base refuse un profil dont la part dépasse 1 et une fumure de couverture sans date", async () => {
    const ref = (admin as unknown as { schema(s: string): { from(t: string): { insert(v: object): PromiseLike<{ error: { message: string } | null }> } } }).schema("ref");
    const mensuel = await ref.from("itineraire_mensuel").insert({ speculation_code: "oignon", variante: "test", mois_cycle: 1, grandeur: "part_recolte", valeur: 1.5, unite: "part", source: "Test refusé", date_source: "2026-11-27" });
    expect(mensuel.error).not.toBeNull();
    const fiche = await ref.from("fiche_technique").insert({ speculation_code: "oignon", variante: "test", code: "fumure_couverture", intrant: "x", valeur_min: 1, unite: "kg", source: "Test refusé", date_source: "2026-11-27" });
    expect(fiche.error).not.toBeNull();
  });
});
