// Génère le SQL d'application EN LIGNE des données de départ du référentiel (spéculations, modèles de charges et de revenus,
// règles d'ajustement, bornes de rendement) à partir de supabase/donnees/referentiel-depart.json.
// Les questions de terrain, les règles des financeurs et l'entretien ont leurs propres scripts (supabase/en-ligne/).
// Même règle que l'import local : upsert, une ligne déjà relue (statut autre que brouillon_ia) n'est jamais écrasée.
// Lancement : node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generer-sql-referentiel.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { deplier } from "../src/referentiel/donnees-depart.ts";

const donnees = JSON.parse(readFileSync(new URL("../supabase/donnees/referentiel-depart.json", import.meta.url), "utf8"));
const d = deplier(donnees);
const jeux = [
  ["speculations", "code", d.speculations],
  ["modeles_charges", "id", d.modelesCharges],
  ["modeles_revenus", "id", d.modelesRevenus],
  ["regles_ajustement", "id", d.regles],
  ["bornes_rendement", "id", d.bornesRendement],
];

let sql = `-- Application EN LIGNE des données de départ du référentiel Cultiplan (version ${donnees.version}), projet redtuedpnhbqziqmyyjc.
-- GÉNÉRÉ par scripts/generer-sql-referentiel.mjs à partir de supabase/donnees/referentiel-depart.json. Toutes les lignes sont en brouillon_ia.
-- Une transaction. Rejouable : une ligne déjà relue (statut autre que brouillon_ia) n'est jamais écrasée.
-- Prérequis : schéma ref complet, et questions de terrain (20261127_ref_entretien_donnees.sql) appliqués avant.
BEGIN;
`;
for (const [table, cle, lignes] of jeux) {
  const colonnes = [...new Set(lignes.flatMap((l) => Object.keys(l)))];
  const liste = colonnes.map((c) => `"${c}"`).join(", ");
  const maj = colonnes.filter((c) => c !== cle).map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
  sql += `
-- ${table} : ${lignes.length} ligne(s)
INSERT INTO ref.${table} (${liste})
SELECT ${liste} FROM jsonb_populate_recordset(NULL::ref.${table}, $donnees$${JSON.stringify(lignes)}$donnees$::jsonb)
ON CONFLICT ("${cle}") DO UPDATE SET ${maj}
WHERE ref.${table}.statut = 'brouillon_ia';
`;
}
sql += `\nCOMMIT;\n`;
writeFileSync(new URL("../supabase/en-ligne/20261127_ref_donnees_referentiel.sql", import.meta.url), sql);
console.log(jeux.map(([t, , l]) => `${t} : ${l.length}`).join("\n"));
