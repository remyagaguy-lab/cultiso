// Génère le script SQL d'application EN LIGNE de R11 (table ref.regles_financeurs + règles de départ).
// NE S'EXÉCUTE PAS lui-même et n'écrit nulle part en ligne : il produit un fichier à relire, puis à lancer avec le feu vert de Remyaga.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generer-sql-financeurs.mjs
// Produit supabase/en-ligne/20261127_ref_regles_financeurs.sql (migration rejouable + données) et
// supabase/en-ligne/20261127_ref_regles_financeurs_retour_arriere.sql (retour arrière). Procédure : supabase/en-ligne/PROCEDURE-REGLES-FINANCEURS.md.
import { readFileSync, writeFileSync } from "node:fs";
import { deplier } from "../src/referentiel/donnees-depart.ts";

const migration = readFileSync(new URL("../supabase/migrations/20261127120000_ref_regles_financeurs.sql", import.meta.url), "utf8");
const donnees = JSON.parse(readFileSync(new URL("../supabase/donnees/referentiel-depart.json", import.meta.url), "utf8"));
const { financeurs } = deplier(donnees);

// Rejouable : CREATE ... IF NOT EXISTS, et DROP avant chaque trigger et politique.
const rejouable = migration
  .replace("CREATE TABLE ref.regles_financeurs", "CREATE TABLE IF NOT EXISTS ref.regles_financeurs")
  .replace(/^CREATE TRIGGER (\S+) BEFORE UPDATE ON (\S+)/m, "DROP TRIGGER IF EXISTS $1 ON $2;\nCREATE TRIGGER $1 BEFORE UPDATE ON $2")
  .replace(/^CREATE POLICY ("[^"]+") ON (\S+)/gm, "DROP POLICY IF EXISTS $1 ON $2;\nCREATE POLICY $1 ON $2");

const texte = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const nombre = (v) => (v === null || v === undefined ? "NULL" : String(Number(v)));
const tableau = (liste) => `ARRAY[${liste.map(texte).join(", ")}]::text[]`;

const lignes = financeurs.map(
  (f) =>
    `(${[
      texte(f.id), texte(f.organisme), texte(f.produit), texte(f.libelle), texte(f.pays), nombre(f.apport_minimum), nombre(f.duree_max_mois),
      f.duree_inclut_differe ? "true" : "false", nombre(f.differe_max_mois), nombre(f.taux_indicatif), `${texte(JSON.stringify(f.taxes))}::jsonb`,
      tableau(f.pieces_exigees), texte(f.format_dossier), texte(f.notes), texte(f.statut), texte(f.source),
    ].join(", ")})`,
);

const colonnes =
  "id, organisme, produit, libelle, pays, apport_minimum, duree_max_mois, duree_inclut_differe, differe_max_mois, taux_indicatif, taxes, pieces_exigees, format_dossier, notes, statut, source";
const miseAJour = ["libelle", "pays", "apport_minimum", "duree_max_mois", "duree_inclut_differe", "differe_max_mois", "taux_indicatif", "taxes", "pieces_exigees", "format_dossier", "notes", "source"]
  .map((c) => `${c} = EXCLUDED.${c}`)
  .join(",\n  ");

const sql = `-- Application EN LIGNE de R11 : règles des financeurs (ref.regles_financeurs), projet redtuedpnhbqziqmyyjc.
-- GÉNÉRÉ par scripts/generer-sql-financeurs.mjs le 2026-11-27 à partir de la migration locale 20261127120000 et de supabase/donnees/referentiel-depart.json.
-- NE PAS EXÉCUTER sans le feu vert explicite de Remyaga. Lire d'abord supabase/en-ligne/PROCEDURE-REGLES-FINANCEURS.md.
-- NE PAS utiliser \`supabase db push\` (la base en ligne n'a pas d'historique de migrations).
-- Exécution : npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_regles_financeurs.sql
-- Une seule transaction : en cas d'erreur, rien n'est appliqué. Rejouable : les règles déjà relues (statut autre que brouillon_ia) ne sont jamais écrasées.
-- Prérequis : le schéma ref et la fonction public.update_modified_column() existent en ligne (voir la procédure, étape 1).

BEGIN;

${rejouable.trim()}

-- Règles de départ, toutes en brouillon_ia avec leur source.
INSERT INTO ref.regles_financeurs (${colonnes})
VALUES
${lignes.join(",\n")}
ON CONFLICT (organisme, produit) DO UPDATE SET
  ${miseAJour}
WHERE ref.regles_financeurs.statut = 'brouillon_ia';

COMMIT;
`;

const retour = `-- RETOUR ARRIÈRE de R11 en ligne : supprime la table ref.regles_financeurs et ses règles.
-- À n'utiliser que si l'application de 20261127_ref_regles_financeurs.sql pose problème. Les règles validées par un expert seraient PERDUES :
-- les sauvegarder avant (voir la procédure, étape 6). Aucune autre table ne dépend de celle-ci (les plans gardent leur règle copiée dans plans.financement).
BEGIN;
DROP TABLE IF EXISTS ref.regles_financeurs;
COMMIT;
`;

writeFileSync(new URL("../supabase/en-ligne/20261127_ref_regles_financeurs.sql", import.meta.url), sql);
writeFileSync(new URL("../supabase/en-ligne/20261127_ref_regles_financeurs_retour_arriere.sql", import.meta.url), retour);
console.log(`Généré : ${financeurs.length} règle(s) de départ. Aucune écriture en ligne.`);
