// Génère les scripts SQL d'application EN LIGNE de R9 (profil du porteur) et S3 (entretien de cadrage).
// NE S'EXÉCUTE PAS lui-même et n'écrit nulle part en ligne : il produit des fichiers à relire, puis à lancer avec le feu vert de Remyaga.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generer-sql-profil-entretien.mjs
// Produit dans supabase/en-ligne/ :
//   20261127_profil_porteur.sql                    schéma R9 (migrations locales 140000 et 165000), une transaction, garde « déjà appliqué »
//   20261127_ref_entretien_cadrage.sql             schéma S3 (migration locale 150000), une transaction, garde « déjà appliqué »
//   20261127_ref_entretien_donnees.sql             questions de terrain et données de l'entretien, rejouable (upsert, les lignes relues ne sont jamais écrasées)
//   20261127_profil_entretien_retour_arriere.sql   retour arrière (supprime les six tables ; ne touche pas ref.questions_terrain)
// Procédure : supabase/en-ligne/PROCEDURE-PROFIL-ENTRETIEN.md.
import { readFileSync, writeFileSync } from "node:fs";
import { deplier, deplierEntretien } from "../src/referentiel/donnees-depart.ts";

const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8");
const ecrire = (chemin, texte) => writeFileSync(new URL(chemin, import.meta.url), texte);
const sansCr = (t) => t.replace(/\r\n/g, "\n").trim();

const migration = (nom) => sansCr(lire(`../supabase/migrations/${nom}`));

/** Garde : refuse de rejouer un schéma déjà en place (un schéma se pose une seule fois ; ses données sont rejouables à part). */
const garde = (table, fichier) => `DO $garde$
BEGIN
  IF to_regclass('${table}') IS NOT NULL THEN
    RAISE EXCEPTION 'Schéma déjà appliqué (${table} existe) : ne rien faire. Voir ${fichier}.';
  END IF;
END
$garde$;`;

const entete = (titre, prerequis, lancement) => `-- Application EN LIGNE de ${titre}, projet redtuedpnhbqziqmyyjc.
-- GÉNÉRÉ par scripts/generer-sql-profil-entretien.mjs le 2026-11-27 à partir des migrations locales et des fichiers de données.
-- NE PAS EXÉCUTER sans le feu vert explicite de Remyaga. Lire d'abord supabase/en-ligne/PROCEDURE-PROFIL-ENTRETIEN.md.
-- NE PAS utiliser \`supabase db push\` (la base en ligne n'a pas d'historique de migrations).
-- Exécution : npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/${lancement}
-- Une seule transaction : en cas d'erreur, rien n'est appliqué.
-- Prérequis : ${prerequis}
`;

// 1. Schéma R9
const profil = `${entete(
  "R9 : profil du porteur et de son existant (public.profil_porteur, profil_existant, profil_credits)",
  "public.cultisos, public.mes_exploitations(), public.peut_modifier() et public.update_modified_column() existent en ligne (migration locale 20261126130000, socle Cultiplan).",
  "20261127_profil_porteur.sql",
)}
BEGIN;

${garde("public.profil_porteur", "la procédure, étape 1")}

${migration("20261127140000_cultiplan_profil_porteur.sql")}

${migration("20261127165000_profil_eau_debit.sql")}

COMMIT;
`;

// 2. Schéma S3
const entretienSchema = `${entete(
  "S3 : entretien de cadrage (ref.entretien_temps, entretien_dimensions, entretien_questions)",
  "le schéma ref, ref.questions_terrain et public.update_modified_column() existent en ligne (migration locale 20261126140000, référentiel Cultiplan).",
  "20261127_ref_entretien_cadrage.sql",
)}
BEGIN;

${garde("ref.entretien_questions", "la procédure, étape 1")}

${migration("20261127150000_ref_entretien_cadrage.sql")}

COMMIT;
`;

// 3. Données (rejouables)
const texte = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const json = (v) => (v === null || v === undefined ? "NULL" : `${texte(JSON.stringify(v))}::jsonb`);
const tableau = (liste) => `ARRAY[${liste.map(texte).join(", ")}]::text[]`;
const nombre = (v) => String(Number(v));
const booleen = (v) => (v ? "true" : "false");

const donneesDepart = JSON.parse(lire("../supabase/donnees/referentiel-depart.json"));
const questionsTerrain = deplier(donneesDepart).questions;
const e = deplierEntretien(JSON.parse(lire("../supabase/donnees/entretien-cadrage.json")));

/** Upsert d'une table : les lignes déjà relues (statut autre que brouillon_ia) ne sont jamais écrasées. */
function upsert(table, cle, colonnes, lignes, majSauf = [cle]) {
  const maj = colonnes.filter((c) => !majSauf.includes(c) && c !== "statut").map((c) => `${c} = EXCLUDED.${c}`).join(",\n  ");
  return `INSERT INTO ${table} (${colonnes.join(", ")})
VALUES
${lignes.map((l) => `(${l.join(", ")})`).join(",\n")}
ON CONFLICT (${cle}) DO UPDATE SET
  ${maj}
WHERE ${table}.statut = 'brouillon_ia';`;
}

const donnees = `${entete(
  "S3 : données de l'entretien de cadrage (questions de terrain, temps, dimensions et questions)",
  "le schéma de S3 est en place (20261127_ref_entretien_cadrage.sql) ; les questions de terrain sont incluses ici car l'entretien les référence.",
  "20261127_ref_entretien_donnees.sql",
)}-- Rejouable : upsert, et une ligne déjà relue (statut autre que brouillon_ia) n'est jamais écrasée.
BEGIN;

-- Questions de terrain (mêmes lignes que npm run referentiel:importer en local).
${upsert(
  "ref.questions_terrain",
  "cle",
  ["cle", "libelle", "sous_titre", "reponses", "secteurs", "ordre", "statut", "source"],
  questionsTerrain.map((q) => [texte(q.cle), texte(q.libelle), texte(q.sous_titre), json(q.reponses), tableau(q.secteurs), nombre(q.ordre), texte(q.statut), texte(q.source)]),
)}

-- Les six temps de la consultation.
${upsert("ref.entretien_temps", "cle", ["cle", "ordre", "titre", "intro", "statut", "source"], e.temps.map((t) => [texte(t.cle), nombre(t.ordre), texte(t.titre), texte(t.intro), texte(t.statut), texte(t.source)]))}

-- Les sept dimensions de faisabilité et leurs règles de lecture.
${upsert(
  "ref.entretien_dimensions",
  "cle",
  ["cle", "ordre", "libelle", "phrase_sans_alerte", "regles", "statut", "source"],
  e.dimensions.map((d) => [texte(d.cle), nombre(d.ordre), texte(d.libelle), texte(d.phrase_sans_alerte), json(d.regles), texte(d.statut), texte(d.source)]),
)}

-- Les questions.
${upsert(
  "ref.entretien_questions",
  "cle",
  ["cle", "temps", "ordre", "question_terrain", "libelle", "aide", "type", "unite", "reponses", "remplit", "condition", "dimension", "essentielle", "court", "statut", "source"],
  e.questions.map((q) => [
    texte(q.cle), texte(q.temps), nombre(q.ordre), texte(q.question_terrain), texte(q.libelle), texte(q.aide), texte(q.type), texte(q.unite),
    json(q.reponses), json(q.remplit), json(q.condition), texte(q.dimension), booleen(q.essentielle), texte(q.court), texte(q.statut), texte(q.source),
  ]),
)}

COMMIT;
`;

const retour = `-- RETOUR ARRIÈRE de R9 et S3 en ligne : supprime les trois tables du profil du porteur et les trois tables de l'entretien.
-- À n'utiliser que si l'application pose problème. Les réponses des porteurs (profil, existant, crédits) et les lignes de l'entretien relues par
-- un expert seraient PERDUES : les sauvegarder avant (voir la procédure, étape 2). ref.questions_terrain n'est pas touchée.
-- Aucune autre table ne dépend de celles-ci ; les plans gardent l'apport et les hypothèses copiés dans plans.hypotheses et plans.financement.
BEGIN;
DROP TABLE IF EXISTS ref.entretien_questions;
DROP TABLE IF EXISTS ref.entretien_dimensions;
DROP TABLE IF EXISTS ref.entretien_temps;
DROP TABLE IF EXISTS public.profil_credits;
DROP TABLE IF EXISTS public.profil_existant;
DROP TABLE IF EXISTS public.profil_porteur;
COMMIT;
`;

ecrire("../supabase/en-ligne/20261127_profil_porteur.sql", profil);
ecrire("../supabase/en-ligne/20261127_ref_entretien_cadrage.sql", entretienSchema);
ecrire("../supabase/en-ligne/20261127_ref_entretien_donnees.sql", donnees);
ecrire("../supabase/en-ligne/20261127_profil_entretien_retour_arriere.sql", retour);
console.log(`Généré : schéma R9, schéma S3, ${questionsTerrain.length} questions de terrain, ${e.temps.length} temps, ${e.dimensions.length} dimensions, ${e.questions.length} questions. Aucune écriture en ligne.`);
