-- Chantier 2 Cultiplan, étape 5 : référentiel agricole (schéma ref).
-- Testée sur la base locale. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga ;
-- en ligne, ajouter aussi « ref » aux schémas exposés de l'API (tableau de bord Supabase, Settings > API).
--
-- Zéro colonne métier : la base ne connaît que des spéculations, des lignes de charges et de revenus types,
-- des questions de terrain et des règles d'ajustement. Ajouter une filière = saisir des données.
-- Chaque donnée a un statut (brouillon_ia, a_valider, validee) et une source. Seules les données validées
-- sont des « références » ; les autres sont montrées comme estimations.
-- Lecture : tout utilisateur connecté ; visiteurs : données validées seulement (futur explorateur public).
-- Écriture : serveur seulement (plus tard, rôle expert).

CREATE SCHEMA IF NOT EXISTS ref;
GRANT USAGE ON SCHEMA ref TO anon, authenticated, service_role;

-- 1. Spéculations.
CREATE TABLE ref.speculations (
  code TEXT PRIMARY KEY CHECK (code ~ '^[a-z0-9_]+$'),
  nom TEXT NOT NULL CHECK (length(nom) BETWEEN 2 AND 120),
  secteur TEXT NOT NULL CHECK (secteur IN ('vegetal', 'animal', 'halieutique', 'transformation', 'services')),
  sous_secteur TEXT,
  unite_echelle TEXT NOT NULL CHECK (length(unite_echelle) BETWEEN 1 AND 30),
  duree_cycle_jours INTEGER CHECK (duree_cycle_jours > 0),
  cycles_par_an NUMERIC NOT NULL DEFAULT 1 CHECK (cycles_par_an > 0),
  zones TEXT[] NOT NULL DEFAULT '{}',
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (statut <> 'validee' OR (source IS NOT NULL AND valide_le IS NOT NULL))
);

-- 2. Modèles de charges, pour 1 unité d'échelle de la spéculation.
CREATE TABLE ref.modeles_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speculation_code TEXT NOT NULL REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  type_charge TEXT NOT NULL CHECK (type_charge IN
    ('intrants', 'main_oeuvre', 'energie', 'infrastructures', 'sanitaire', 'logistique', 'frais_financiers')),
  libelle TEXT NOT NULL CHECK (length(libelle) BETWEEN 2 AND 120),
  unite TEXT NOT NULL CHECK (length(unite) BETWEEN 1 AND 30),
  quantite NUMERIC NOT NULL CHECK (quantite >= 0),
  prix_reference NUMERIC NOT NULL CHECK (prix_reference >= 0),
  produit_prix TEXT,
  frequence NUMERIC NOT NULL DEFAULT 1 CHECK (frequence >= 0),
  base TEXT NOT NULL DEFAULT 'cycle' CHECK (base IN ('cycle', 'an')),
  nature TEXT NOT NULL CHECK (nature IN ('fixe', 'variable')),
  classe TEXT NOT NULL CHECK (classe IN ('investissement', 'exploitation')),
  duree_vie_ans NUMERIC CHECK (duree_vie_ans > 0),
  mois_decaissement INTEGER[] CHECK (mois_decaissement IS NULL OR (mois_decaissement <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12] AND cardinality(mois_decaissement) > 0)),
  ordre INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (classe <> 'investissement' OR duree_vie_ans IS NOT NULL)
);
CREATE INDEX idx_modeles_charges_speculation ON ref.modeles_charges(speculation_code);

-- 3. Modèles de revenus, pour 1 unité d'échelle, en trois scénarios.
CREATE TABLE ref.modeles_revenus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speculation_code TEXT NOT NULL REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  type_revenu TEXT NOT NULL CHECK (type_revenu IN ('principal', 'coproduit', 'sous_produit', 'service')),
  libelle TEXT NOT NULL CHECK (length(libelle) BETWEEN 2 AND 120),
  unite TEXT NOT NULL CHECK (length(unite) BETWEEN 1 AND 30),
  quantite_pessimiste NUMERIC NOT NULL CHECK (quantite_pessimiste >= 0),
  quantite_realiste NUMERIC NOT NULL CHECK (quantite_realiste >= 0),
  quantite_optimiste NUMERIC NOT NULL CHECK (quantite_optimiste >= 0),
  pertes NUMERIC NOT NULL DEFAULT 0 CHECK (pertes >= 0 AND pertes <= 1),
  prix_reference NUMERIC NOT NULL CHECK (prix_reference >= 0),
  produit_prix TEXT,
  base TEXT NOT NULL DEFAULT 'cycle' CHECK (base IN ('cycle', 'an')),
  mois_vente INTEGER[] CHECK (mois_vente IS NULL OR (mois_vente <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12] AND cardinality(mois_vente) > 0)),
  ordre INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantite_pessimiste <= quantite_realiste AND quantite_realiste <= quantite_optimiste)
);
CREATE INDEX idx_modeles_revenus_speculation ON ref.modeles_revenus(speculation_code);

-- 4. Questions de terrain (posées une à la fois par Cultisia), avec leurs réponses possibles.
CREATE TABLE ref.questions_terrain (
  cle TEXT PRIMARY KEY CHECK (cle ~ '^[a-z0-9_]+$'),
  libelle TEXT NOT NULL CHECK (length(libelle) BETWEEN 2 AND 200),
  sous_titre TEXT,
  -- Tableau de { "valeur": "motopompe", "libelle": "Motopompe" }.
  reponses JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reponses) = 'array'),
  -- Secteurs concernés ; vide = tous.
  secteurs TEXT[] NOT NULL DEFAULT '{}',
  ordre INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Règles d'ajustement : si la réponse à une question vaut X, alors un effet sur le budget.
CREATE TABLE ref.regles_ajustement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cle_question TEXT NOT NULL REFERENCES ref.questions_terrain(cle) ON UPDATE CASCADE ON DELETE CASCADE,
  valeur TEXT NOT NULL,
  -- Limite la règle à une spéculation ; toutes si vide.
  speculation_code TEXT REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  effet TEXT NOT NULL CHECK (effet IN ('multiplier', 'ajouter_ligne')),
  cible_sens TEXT CHECK (cible_sens IN ('charge', 'revenu')),
  cible_type TEXT,
  cible_modele_id UUID,
  coefficient NUMERIC CHECK (coefficient > 0),
  -- Ligne de charge ajoutée, pour 1 unité d'échelle (mêmes champs qu'un modèle de charge).
  ligne JSONB CHECK (ligne IS NULL OR jsonb_typeof(ligne) = 'object'),
  description TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effet <> 'multiplier' OR (cible_sens IS NOT NULL AND coefficient IS NOT NULL)),
  CHECK (effet <> 'ajouter_ligne' OR ligne IS NOT NULL)
);
CREATE INDEX idx_regles_question ON ref.regles_ajustement(cle_question);

-- 6. Mise à jour automatique de updated_at.
CREATE TRIGGER update_speculations_modtime BEFORE UPDATE ON ref.speculations
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_modeles_charges_modtime BEFORE UPDATE ON ref.modeles_charges
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_modeles_revenus_modtime BEFORE UPDATE ON ref.modeles_revenus
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_questions_terrain_modtime BEFORE UPDATE ON ref.questions_terrain
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_regles_ajustement_modtime BEFORE UPDATE ON ref.regles_ajustement
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- 7. Droits : lecture seule pour les utilisateurs, données validées seulement pour les visiteurs.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['speculations', 'modeles_charges', 'modeles_revenus', 'questions_terrain', 'regles_ajustement'] LOOP
    EXECUTE format('ALTER TABLE ref.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.%I FOR SELECT TO anon USING (statut = %L)', t, 'validee');
    EXECUTE format('GRANT SELECT ON ref.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON ref.%I TO service_role', t);
  END LOOP;
END $$;

-- 8. Un atelier renvoie désormais à une spéculation du référentiel.
ALTER TABLE public.ateliers
  ADD CONSTRAINT ateliers_speculation_code_fkey
  FOREIGN KEY (speculation_code) REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE RESTRICT;
