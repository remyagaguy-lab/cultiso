-- RETOUR ARRIÈRE de M14 en ligne : supprime ref.courbes_age et ref.parametres_elevage.
-- Les courbes relues ou corrigées par un expert seraient PERDUES : les sauvegarder avant (voir la procédure, étape 2).
-- Aucune autre table ne dépend de celles-ci ; le code lit ces tables seulement pour l'atelier animal à bandes.
BEGIN;
DROP TABLE IF EXISTS ref.parametres_elevage;
DROP TABLE IF EXISTS ref.courbes_age;
COMMIT;
