-- Chantier Cultiplan, M14 : courbes mensuelles par âge et paramètres des ateliers animaux (schéma ref).
-- Testée sur la base locale seulement. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
--
-- ref.courbes_age : une ligne = une valeur d'une grandeur à un âge (en mois) pour une spéculation et une variante (une source).
--   mortalite     : part de l'effectif présent en début de mois qui meurt dans le mois (0,04 = 4 %).
--   consommation  : aliment, en grammes par sujet et par jour.
--   production    : taux de production par jour, en part (0,75 = 0,75 œuf par poule et par jour, soit 75 % de ponte).
--   poids         : poids vif en kg à la fin du mois d'âge.
-- ref.parametres_elevage : durées et conventions d'une variante (phase improductive, durée de ponte, âge de réforme, jours par mois...).
-- Zéro valeur codée en dur dans le code : tout est donnée, avec SOURCE et DATE de la source obligatoires, statut brouillon_ia
-- tant qu'un expert togolais ne l'a pas validée. Une courbe ou un paramètre absent veut dire « inconnu » : le moteur ne le devine pas.
-- Lecture : tout utilisateur connecté ; visiteurs : données validées seulement. Écriture : serveur seulement.

CREATE TABLE ref.courbes_age (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speculation_code TEXT NOT NULL REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  -- Une variante = une source et une conduite (souche, pays). Plusieurs variantes peuvent exister pour une spéculation.
  variante TEXT NOT NULL CHECK (variante ~ '^[a-z0-9_]+$'),
  grandeur TEXT NOT NULL CHECK (grandeur IN ('mortalite', 'consommation', 'production', 'poids')),
  -- Âge du sujet en mois révolus : 1 = premier mois de vie.
  age_mois INTEGER NOT NULL CHECK (age_mois >= 1),
  valeur NUMERIC NOT NULL CHECK (valeur >= 0),
  unite TEXT NOT NULL CHECK (length(unite) >= 1),
  -- Document, page ou feuille d'où vient la valeur ; date du document, ou de sa lecture si elle est inconnue.
  source TEXT NOT NULL CHECK (length(source) >= 5),
  date_source DATE NOT NULL,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (speculation_code, variante, grandeur, age_mois),
  CHECK (grandeur <> 'mortalite' OR valeur <= 1),
  CHECK (grandeur <> 'production' OR valeur <= 1),
  CHECK (statut <> 'validee' OR valide_le IS NOT NULL)
);
CREATE INDEX idx_courbes_age_speculation ON ref.courbes_age(speculation_code, variante);

CREATE TABLE ref.parametres_elevage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speculation_code TEXT NOT NULL REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  variante TEXT NOT NULL CHECK (variante ~ '^[a-z0-9_]+$'),
  code TEXT NOT NULL CHECK (code IN (
    'duree_cycle_mois',                -- durée d'une bande, de la mise en place à la réforme ou à la vente
    'duree_phase_improductive_mois',   -- mois d'élevage avant le début de la production
    'duree_production_mois',           -- mois de production avant la réforme
    'age_reforme_mois',                -- âge auquel la bande est réformée et vendue
    'jours_par_mois',                  -- convention de calcul du modèle source (jours comptés par mois)
    'poids_vente_kg',
    'consommation_moyenne_g_sujet_jour'
  )),
  valeur NUMERIC NOT NULL CHECK (valeur > 0),
  unite TEXT NOT NULL CHECK (length(unite) >= 1),
  source TEXT NOT NULL CHECK (length(source) >= 5),
  date_source DATE NOT NULL,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (speculation_code, variante, code),
  CHECK (statut <> 'validee' OR valide_le IS NOT NULL)
);
CREATE INDEX idx_parametres_elevage_speculation ON ref.parametres_elevage(speculation_code, variante);

CREATE TRIGGER update_courbes_age_modtime BEFORE UPDATE ON ref.courbes_age
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_parametres_elevage_modtime BEFORE UPDATE ON ref.parametres_elevage
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE ref.courbes_age ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref.parametres_elevage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.courbes_age FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.courbes_age FOR SELECT TO anon USING (statut = 'validee');
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.parametres_elevage FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.parametres_elevage FOR SELECT TO anon USING (statut = 'validee');
GRANT SELECT ON ref.courbes_age, ref.parametres_elevage TO anon, authenticated;
GRANT ALL ON ref.courbes_age, ref.parametres_elevage TO service_role;

-- ---------------------------------------------------------------------------------------------
-- Données de départ : uniquement ce que les documents du lot donnent noir sur blanc. Tout est brouillon_ia.
-- Date de la source : date de lecture (27/11/2026), les dates de parution des documents n'étant pas connues.
-- ---------------------------------------------------------------------------------------------

-- Poule pondeuse, variante « burkina_doc00686 » : modèle de simulation d'une bande (Excel, Burkina Faso),
-- feuille « Parametre », première bande (1 000 poussins), mois d'âge 1 à 19 (ligne 22 : numéro du mois).
INSERT INTO ref.courbes_age (speculation_code, variante, grandeur, age_mois, valeur, unite, source, date_source, notes)
SELECT 'poule_pondeuse', 'burkina_doc00686', 'mortalite', t.age, t.v, 'part de l''effectif en début de mois',
  'DOC-00686 (modèle de simulation technico-économique d''une bande de pondeuses, Excel, Burkina Faso), feuille « Parametre », ligne 24 (mortalité de la première bande) : 4 % le 1er mois, 1 % les 2e et 3e, 0,2 % ensuite. Brouillon IA : à faire valider par un expert togolais.',
  DATE '2026-11-27',
  'Pourcentage appliqué à l''effectif présent en début du mois (convention du modèle source). Modèle burkinabè non daté, à confirmer pour le Togo.'
FROM unnest(ARRAY[0.04, 0.01, 0.01, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002, 0.002]) WITH ORDINALITY AS t(v, age);

INSERT INTO ref.courbes_age (speculation_code, variante, grandeur, age_mois, valeur, unite, source, date_source, notes)
SELECT 'poule_pondeuse', 'burkina_doc00686', 'consommation', t.age, t.v, 'g par sujet et par jour',
  'DOC-00686 (modèle de simulation technico-économique d''une bande de pondeuses, Excel, Burkina Faso), feuille « Parametre », ligne 26 (aliments de la première bande) : 20, 40, 60, 65, 80, 85 puis 100 g par sujet et par jour. Brouillon IA : à faire valider par un expert togolais.',
  DATE '2026-11-27',
  'Du 7e au 19e mois, la valeur de 100 g est reprise du 7e mois par le modèle source (cellules égales à la précédente). Modèle burkinabè non daté, à confirmer pour le Togo.'
FROM unnest(ARRAY[20, 40, 60, 65, 80, 85, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]) WITH ORDINALITY AS t(v, age);

INSERT INTO ref.courbes_age (speculation_code, variante, grandeur, age_mois, valeur, unite, source, date_source, notes)
SELECT 'poule_pondeuse', 'burkina_doc00686', 'production', t.age, t.v, 'œuf par poule et par jour (part)',
  'DOC-00686 (modèle de simulation technico-économique d''une bande de pondeuses, Excel, Burkina Faso), feuille « Parametre », ligne 28 (taux de ponte de la première bande) : nul jusqu''au 5e mois, puis 40, 75, 80, 75, 75, 75, 75, 73, 73, 70, 65, 70, 65, 65 % du 6e au 19e mois. Brouillon IA : à faire valider par un expert togolais.',
  DATE '2026-11-27',
  'Valeurs saisies à la main dans le modèle source (elles écrasent une formule par paliers 20 / 60 / 65 %). Le taux compte les œufs pondus par poule présente en début de mois. Modèle burkinabè non daté, à confirmer pour le Togo.'
FROM unnest(ARRAY[0, 0, 0, 0, 0, 0.40, 0.75, 0.80, 0.75, 0.75, 0.75, 0.75, 0.73, 0.73, 0.70, 0.65, 0.70, 0.65, 0.65]) WITH ORDINALITY AS t(v, age);

INSERT INTO ref.parametres_elevage (speculation_code, variante, code, valeur, unite, source, date_source, notes) VALUES
  ('poule_pondeuse', 'burkina_doc00686', 'jours_par_mois', 30, 'jours',
   'DOC-00686 (modèle de simulation d''une bande de pondeuses, Burkina Faso), feuille « Parametre », ligne 27 : consommation mensuelle = effectif × g par jour × 30 / 1 000. Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Convention de comptage du modèle source : 30 jours par mois, pour la consommation et la ponte.'),
  ('poule_pondeuse', 'burkina_doc00686', 'age_reforme_mois', 19, 'mois',
   'DOC-00686 (modèle de simulation d''une bande de pondeuses, Burkina Faso), feuilles « Parametre » (mois 1 à 19) et « Feuil2 » (ligne « Vente de poulets » au 19e mois : effectif × prix de la poule). Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Horizon de 19 mois du modèle source, pas une norme d''élevage : le document malien DOC-00136 retient 18 mois (variante mali_doc00136).'),
  ('poule_pondeuse', 'burkina_doc00686', 'duree_phase_improductive_mois', 5, 'mois',
   'DOC-00686 (modèle de simulation d''une bande de pondeuses, Burkina Faso), feuille « Parametre », ligne 28 : taux de ponte nul jusqu''au 5e mois, première ponte au 6e mois. Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Déduit de la courbe de ponte de la même variante (cinq mois sans œuf).'),
  ('poule_pondeuse', 'mali_doc00136', 'duree_cycle_mois', 18, 'mois',
   'DOC-00136 (profil d''investissement, complexe avicole intégré, Koulikoro, Mali, 2014), p. 3 : « le cycle d''exploitation de poules pondeuses dure 18 mois ». Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Document malien de 2014 qui contient des erreurs de chiffres ailleurs (voir l''analyse de la base de ressources) : la durée du cycle est reprise, pas ses montants.'),
  ('poule_pondeuse', 'mali_doc00136', 'duree_phase_improductive_mois', 6, 'mois',
   'DOC-00136 (profil d''investissement, Koulikoro, Mali, 2014), p. 3 : poulailler de pondeuses constitué « au bout de 6 mois d''engraissement ». Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Le document dit « engraissement » pour la phase d''élevage avant la ponte.'),
  ('poule_pondeuse', 'mali_doc00136', 'duree_production_mois', 12, 'mois',
   'DOC-00136 (profil d''investissement, Koulikoro, Mali, 2014), p. 3 : « 12 mois de ponte avant d''être mises en réforme ». Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', NULL),
  ('poulet_chair', 'mali_doc00136', 'duree_cycle_mois', 2, 'mois',
   'DOC-00136 (profil d''investissement, Koulikoro, Mali, 2014), p. 3 : « le cycle d''exploitation de poulets de chair dure deux (2) mois ». Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Le référentiel de départ retient 45 jours pour le poulet de chair : écart à faire arbitrer par un expert.'),
  ('poulet_chair', 'mali_doc00136', 'poids_vente_kg', 1.8, 'kg',
   'DOC-00136 (profil d''investissement, Koulikoro, Mali, 2014), p. 3 : poids moyen de 1,80 kg au bout de deux mois. Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', NULL),
  ('poulet_chair', 'mali_doc00136', 'consommation_moyenne_g_sujet_jour', 81.67, 'g par sujet et par jour',
   'DOC-00136 (profil d''investissement, Koulikoro, Mali, 2014), p. 3 : ration journalière « établie à une moyenne de 81,67 grammes d''aliment volaille » par sujet. Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Moyenne sur le cycle, pas une courbe par âge : elle ne peut pas alimenter la consommation mois par mois.');

INSERT INTO ref.courbes_age (speculation_code, variante, grandeur, age_mois, valeur, unite, source, date_source, notes) VALUES
  ('poulet_chair', 'mali_doc00136', 'poids', 2, 1.8, 'kg',
   'DOC-00136 (profil d''investissement, Koulikoro, Mali, 2014), p. 3 : poids moyen de 1,80 kg au bout de deux mois. Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Un seul point de la courbe de poids : le poids aux autres âges est inconnu.');
