// Importe les données de départ du référentiel (supabase/donnees/referentiel-depart.json) dans la base LOCALE.
// Lancement : `npm run db:start` puis `npm run referentiel:importer`.
// Rejouable : identifiants déterministes, upsert. Une donnée déjà passée « à valider » ou « validée » n'est jamais écrasée.
// Aucune écriture en ligne : l'application en ligne se fera par script SQL, avec le feu vert de Remyaga.
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { deplier } from "../src/referentiel/donnees-depart.ts";

// Les tests passent l'adresse et la clé locales pour éviter un second `supabase status` (lent).
const statut = process.env.REFERENTIEL_API_URL
  ? { API_URL: process.env.REFERENTIEL_API_URL, SERVICE_ROLE_KEY: process.env.REFERENTIEL_CLE_SERVICE }
  : JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
if (!/127\.0\.0\.1|localhost/.test(statut.API_URL)) {
  console.error("Refus : ce script n'écrit que dans la base locale.");
  process.exit(1);
}
const ref = createClient(statut.API_URL, statut.SERVICE_ROLE_KEY, { auth: { persistSession: false } }).schema("ref");

const donnees = JSON.parse(readFileSync(new URL("../supabase/donnees/referentiel-depart.json", import.meta.url), "utf8"));
const d = deplier(donnees);

/** Retire les lignes dont la version en base n'est plus un brouillon (relue ou validée par un expert). */
async function sansDonneesRelues(table, cle, lignes) {
  const { data, error } = await ref.from(table).select(`${cle}, statut`).in(cle, lignes.map((l) => l[cle]));
  if (error) throw new Error(`${table} : ${error.message}`);
  const protegees = new Set(data.filter((x) => x.statut !== "brouillon_ia").map((x) => x[cle]));
  if (protegees.size > 0) console.log(`  ${table} : ${protegees.size} ligne(s) déjà relue(s), laissée(s) telle(s) quelle(s)`);
  return lignes.filter((l) => !protegees.has(l[cle]));
}

async function ecrire(table, cle, lignes) {
  const aEcrire = await sansDonneesRelues(table, cle, lignes);
  if (aEcrire.length === 0) return;
  const { error } = await ref.from(table).upsert(aEcrire, { onConflict: cle });
  if (error) throw new Error(`${table} : ${error.message}`);
  console.log(`  ${table} : ${aEcrire.length} ligne(s)`);
}

/** Supprime les brouillons de ces spéculations qui ont disparu du fichier. */
async function retirerObsoletes(table, ids, codes) {
  const { data, error } = await ref
    .from(table)
    .delete()
    .in("speculation_code", codes)
    .eq("statut", "brouillon_ia")
    .not("id", "in", `(${ids.join(",")})`)
    .select("id");
  if (error) throw new Error(`${table} : ${error.message}`);
  if (data.length > 0) console.log(`  ${table} : ${data.length} brouillon(s) obsolète(s) retiré(s)`);
}

console.log(`Import du référentiel de départ (version ${donnees.version}) dans la base locale :`);
const codes = d.speculations.map((s) => s.code);
await ecrire("speculations", "code", d.speculations);
await ecrire("questions_terrain", "cle", d.questions);
await ecrire("modeles_charges", "id", d.modelesCharges);
await ecrire("modeles_revenus", "id", d.modelesRevenus);
await ecrire("regles_ajustement", "id", d.regles);
await ecrire("regles_financeurs", "id", d.financeurs);
await retirerObsoletes("modeles_charges", d.modelesCharges.map((c) => c.id), codes);
await retirerObsoletes("modeles_revenus", d.modelesRevenus.map((r) => r.id), codes);
console.log("Terminé.");
