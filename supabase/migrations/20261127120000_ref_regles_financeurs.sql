-- Chantier Cultiplan, R11 : règles des financeurs (schéma ref).
-- Testée sur la base locale seulement. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
--
-- Une ligne = les règles d'un produit de financement d'un organisme (ANPGF, banque, IMF, crédit de campagne...).
-- Zéro valeur codée en dur dans le code : l'apport minimum, la durée, le différé, le taux, les taxes,
-- les pièces et le format du dossier sont des données. Une colonne vide veut dire « règle inconnue », pas « aucune règle ».
-- Même cycle de vie que le reste du référentiel : brouillon_ia, a_valider, validee, avec une source.
-- Lecture : tout utilisateur connecté ; visiteurs : règles validées seulement. Écriture : serveur seulement.

CREATE TABLE ref.regles_financeurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisme TEXT NOT NULL CHECK (length(organisme) BETWEEN 2 AND 80),
  produit TEXT NOT NULL CHECK (produit ~ '^[a-z0-9_]+$'),
  libelle TEXT NOT NULL CHECK (length(libelle) BETWEEN 2 AND 160),
  pays TEXT CHECK (pays IS NULL OR pays ~ '^[A-Z]{2}$'),
  -- Part minimale de l'apport dans le coût du projet (0,2 = 20 %).
  apport_minimum NUMERIC CHECK (apport_minimum >= 0 AND apport_minimum <= 1),
  -- Durée maximale du financement, en mois. Comprend le différé si duree_inclut_differe vaut vrai (lecture prudente).
  duree_max_mois INTEGER CHECK (duree_max_mois > 0),
  duree_inclut_differe BOOLEAN NOT NULL DEFAULT true,
  differe_max_mois INTEGER CHECK (differe_max_mois >= 0),
  -- Taux annuel indicatif (0,24 = 24 %). Indicatif : le taux réel est fixé par le financeur.
  taux_indicatif NUMERIC CHECK (taux_indicatif >= 0 AND taux_indicatif <= 1),
  -- Tableau de { "nom": "...", "description": "..." }.
  taxes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(taxes) = 'array'),
  pieces_exigees TEXT[] NOT NULL DEFAULT '{}',
  format_dossier TEXT,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisme, produit),
  CHECK (differe_max_mois IS NULL OR duree_max_mois IS NULL OR differe_max_mois <= duree_max_mois),
  CHECK (statut <> 'validee' OR (source IS NOT NULL AND valide_le IS NOT NULL))
);

CREATE TRIGGER update_regles_financeurs_modtime BEFORE UPDATE ON ref.regles_financeurs
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE ref.regles_financeurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.regles_financeurs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.regles_financeurs FOR SELECT TO anon USING (statut = 'validee');
GRANT SELECT ON ref.regles_financeurs TO anon, authenticated;
GRANT ALL ON ref.regles_financeurs TO service_role;
