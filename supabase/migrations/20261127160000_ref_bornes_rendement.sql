-- Chantier Cultiplan, R10 : bornes de rendement par modèle de revenu (schéma ref).
-- Testée sur la base locale seulement. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
--
-- Une ligne = les bornes de production d'un modèle de revenu, pour 1 unité d'échelle de la spéculation,
-- dans l'unité et la période (base) de ref.modeles_revenus.quantite_*. Le moteur les met à la taille de l'atelier
-- et les compare à la production prévue (contrôle RENDEMENT_HORS_BORNES).
-- Zéro valeur codée en dur dans le code : minimum, valeur typique et maximum sont des données.
-- Source ET date de la source sont obligatoires, même en brouillon. Une borne vide veut dire « inconnue ».
-- Même cycle de vie que le reste du référentiel : brouillon_ia, a_valider, validee.
-- Lecture : tout utilisateur connecté ; visiteurs : bornes validées seulement. Écriture : serveur seulement.

CREATE TABLE ref.bornes_rendement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modele_revenu_id UUID NOT NULL UNIQUE REFERENCES ref.modeles_revenus(id) ON UPDATE CASCADE ON DELETE CASCADE,
  -- Pour 1 unité d'échelle, même unité et même période que le modèle de revenu.
  min_par_unite NUMERIC CHECK (min_par_unite >= 0),
  typique_par_unite NUMERIC CHECK (typique_par_unite >= 0),
  max_par_unite NUMERIC CHECK (max_par_unite >= 0),
  -- Document et page d'où viennent les bornes ; date du document, ou de sa lecture si elle est inconnue.
  source TEXT NOT NULL CHECK (length(source) >= 5),
  date_source DATE NOT NULL,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (min_par_unite IS NOT NULL OR max_par_unite IS NOT NULL),
  CHECK (min_par_unite IS NULL OR max_par_unite IS NULL OR min_par_unite <= max_par_unite),
  CHECK (typique_par_unite IS NULL OR min_par_unite IS NULL OR typique_par_unite >= min_par_unite),
  CHECK (typique_par_unite IS NULL OR max_par_unite IS NULL OR typique_par_unite <= max_par_unite),
  CHECK (statut <> 'validee' OR valide_le IS NOT NULL)
);

CREATE TRIGGER update_bornes_rendement_modtime BEFORE UPDATE ON ref.bornes_rendement
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE ref.bornes_rendement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.bornes_rendement FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.bornes_rendement FOR SELECT TO anon USING (statut = 'validee');
GRANT SELECT ON ref.bornes_rendement TO anon, authenticated;
GRANT ALL ON ref.bornes_rendement TO service_role;
