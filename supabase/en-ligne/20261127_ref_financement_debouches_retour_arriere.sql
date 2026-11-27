-- RETOUR ARRIÈRE de M6 et R3 en ligne : supprime ref.baremes_credit_campagne et ref.circuits_commercialisation.
-- À n'utiliser que si l'application de 20261127_ref_financement_debouches.sql pose problème. Les lignes relues par un expert seraient PERDUES :
-- les sauvegarder avant (voir la procédure, étape 2). Aucune autre table ne dépend de celles-ci.
BEGIN;
DROP TABLE IF EXISTS ref.baremes_credit_campagne;
DROP TABLE IF EXISTS ref.circuits_commercialisation;
COMMIT;
