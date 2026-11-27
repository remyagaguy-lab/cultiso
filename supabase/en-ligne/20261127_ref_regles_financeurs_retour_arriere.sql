-- RETOUR ARRIÈRE de R11 en ligne : supprime la table ref.regles_financeurs et ses règles.
-- À n'utiliser que si l'application de 20261127_ref_regles_financeurs.sql pose problème. Les règles validées par un expert seraient PERDUES :
-- les sauvegarder avant (voir la procédure, étape 6). Aucune autre table ne dépend de celle-ci (les plans gardent leur règle copiée dans plans.financement).
BEGIN;
DROP TABLE IF EXISTS ref.regles_financeurs;
COMMIT;
