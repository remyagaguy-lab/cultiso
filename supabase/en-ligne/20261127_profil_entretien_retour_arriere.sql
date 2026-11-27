-- RETOUR ARRIÈRE de R9 et S3 en ligne : supprime les trois tables du profil du porteur et les trois tables de l'entretien.
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
