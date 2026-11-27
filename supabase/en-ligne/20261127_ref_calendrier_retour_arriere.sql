-- RETOUR ARRIÈRE de R1 et R4 en ligne : supprime les quatre tables du référentiel calendaire.
-- Les profils relus ou corrigés par un expert seraient PERDUS : les sauvegarder avant (voir la procédure, étape 2).
-- Aucune autre table ne dépend de celles-ci ; le code (src/referentiel/calendrier.ts) les lit seulement à la génération d'un plan,
-- et tolère leur absence (le plan garde alors l'ancien calendrier).
BEGIN;
DROP TABLE IF EXISTS ref.profil_pluriannuel;
DROP TABLE IF EXISTS ref.profils_speculation;
DROP TABLE IF EXISTS ref.itineraire_mensuel;
DROP TABLE IF EXISTS ref.fiche_technique;
COMMIT;
