-- Chantier Cultiplan, R1 : itinéraires techniques calendaires (schéma ref).
-- Testée sur la base locale seulement. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
--
-- Deux tables :
--   ref.fiche_technique    : la fiche technique d'une spéculation au format du plan CIRC (DOC-00015 p. 15-21) : densité, eau par phase
--                            et par système, fumure datée, pertes après récolte, durée de conservation, délais de repiquage et de récolte.
--                            Une ligne = une valeur (ou une fourchette) avec sa source et sa date.
--   ref.itineraire_mensuel : le profil mensuel d'un cycle : pour chaque mois de cycle (1 = mois du démarrage), la part des coûts
--                            (par type de charge), les heures de travail par unité d'échelle, la part de la récolte. Le moteur cale ce
--                            profil sur la date de démarrage de l'atelier ; il remplacera à terme mois_decaissement et mois_vente.
-- Zéro valeur codée en dur : tout est donnée, avec SOURCE et DATE de la source obligatoires, statut brouillon_ia tant qu'un expert
-- togolais ne l'a pas validée. Une valeur absente veut dire « inconnue » : le moteur ne la devine pas, il garde l'ancien calendrier
-- (mois_decaissement, mois_vente) pour la spéculation concernée.
-- Lecture : tout utilisateur connecté ; visiteurs : données validées seulement. Écriture : serveur seulement.

CREATE TABLE ref.fiche_technique (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speculation_code TEXT NOT NULL REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  -- Une variante = une source et une conduite (zone, variété). Plusieurs variantes peuvent exister pour une spéculation.
  variante TEXT NOT NULL CHECK (variante ~ '^[a-z0-9_]+$'),
  code TEXT NOT NULL CHECK (code IN (
    'densite',               -- peuplement (pieds, plants ou sujets par unité d'échelle)
    'eau_apport',            -- apport d'eau par phase, en mm par jour (phase et système renseignés)
    'eau_total',             -- apport d'eau total du cycle par système, en m3 par unité d'échelle
    'fumure_fond',           -- fumure de fond (intrant renseigné, dose par unité d'échelle)
    'fumure_couverture',     -- fumure de couverture datée (intrant et jour renseignés)
    'perte_apres_recolte',   -- part de la récolte perdue après la récolte (0,3 = 30 %)
    'duree_conservation',    -- durée de conservation, en mois
    'delai_repiquage',       -- jours entre le semis et le repiquage
    'delai_recolte'          -- jours entre le repère (repiquage ou semis) et la récolte
  )),
  -- Phase de culture (mois_1, mois_2...), système d'irrigation (surface, aspersion, goutte_a_goutte), intrant : selon le code.
  phase TEXT,
  systeme TEXT,
  intrant TEXT,
  valeur_min NUMERIC NOT NULL CHECK (valeur_min >= 0),
  -- Valeur haute quand la source donne une fourchette ; vide quand la valeur est unique.
  valeur_max NUMERIC CHECK (valeur_max IS NULL OR valeur_max >= valeur_min),
  unite TEXT NOT NULL CHECK (length(unite) >= 1),
  -- Pour une opération datée : repère (semis, repiquage) et nombre de jours après ce repère.
  repere TEXT CHECK (repere IS NULL OR repere IN ('semis', 'repiquage')),
  jours_apres_repere INTEGER CHECK (jours_apres_repere IS NULL OR jours_apres_repere >= 0),
  -- Document, page ou feuille d'où vient la valeur ; date du document, ou de sa lecture si elle est inconnue.
  source TEXT NOT NULL CHECK (length(source) >= 5),
  date_source DATE NOT NULL,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (code <> 'perte_apres_recolte' OR (valeur_min <= 1 AND (valeur_max IS NULL OR valeur_max <= 1))),
  CHECK (code <> 'eau_apport' OR (phase IS NOT NULL AND systeme IS NOT NULL)),
  CHECK (code <> 'eau_total' OR systeme IS NOT NULL),
  CHECK (code NOT IN ('fumure_fond', 'fumure_couverture') OR intrant IS NOT NULL),
  CHECK (code <> 'fumure_couverture' OR (repere IS NOT NULL AND jours_apres_repere IS NOT NULL)),
  CHECK (statut <> 'validee' OR valide_le IS NOT NULL)
);
CREATE UNIQUE INDEX uq_fiche_technique ON ref.fiche_technique
  (speculation_code, variante, code, COALESCE(phase, ''), COALESCE(systeme, ''), COALESCE(intrant, ''), COALESCE(jours_apres_repere, -1));
CREATE INDEX idx_fiche_technique_speculation ON ref.fiche_technique(speculation_code, variante);

CREATE TABLE ref.itineraire_mensuel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speculation_code TEXT NOT NULL REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  variante TEXT NOT NULL CHECK (variante ~ '^[a-z0-9_]+$'),
  -- Mois du cycle : 1 = mois du démarrage de l'atelier.
  mois_cycle INTEGER NOT NULL CHECK (mois_cycle BETWEEN 1 AND 120),
  grandeur TEXT NOT NULL CHECK (grandeur IN (
    'part_couts',          -- part (0 à 1) des coûts du cycle décaissée ce mois-là ; la somme sur le cycle doit valoir 1
    'heures_par_unite',    -- heures de travail par unité d'échelle ce mois-là
    'part_recolte'         -- part (0 à 1) de la récolte du cycle vendue ce mois-là ; la somme sur le cycle doit valoir 1
  )),
  -- Pour part_couts : type de charge visé (intrants, main_oeuvre...) ; vide = toutes les charges d'exploitation.
  type_charge TEXT CHECK (type_charge IS NULL OR type_charge IN
    ('intrants', 'main_oeuvre', 'energie', 'infrastructures', 'sanitaire', 'logistique', 'frais_financiers')),
  valeur NUMERIC NOT NULL CHECK (valeur >= 0),
  unite TEXT NOT NULL CHECK (length(unite) >= 1),
  source TEXT NOT NULL CHECK (length(source) >= 5),
  date_source DATE NOT NULL,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (grandeur NOT IN ('part_couts', 'part_recolte') OR valeur <= 1),
  CHECK (grandeur = 'part_couts' OR type_charge IS NULL),
  CHECK (statut <> 'validee' OR valide_le IS NOT NULL)
);
CREATE UNIQUE INDEX uq_itineraire_mensuel ON ref.itineraire_mensuel
  (speculation_code, variante, grandeur, COALESCE(type_charge, ''), mois_cycle);
CREATE INDEX idx_itineraire_mensuel_speculation ON ref.itineraire_mensuel(speculation_code, variante);

CREATE TRIGGER update_fiche_technique_modtime BEFORE UPDATE ON ref.fiche_technique
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_itineraire_mensuel_modtime BEFORE UPDATE ON ref.itineraire_mensuel
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE ref.fiche_technique ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref.itineraire_mensuel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.fiche_technique FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.fiche_technique FOR SELECT TO anon USING (statut = 'validee');
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.itineraire_mensuel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.itineraire_mensuel FOR SELECT TO anon USING (statut = 'validee');
GRANT SELECT ON ref.fiche_technique, ref.itineraire_mensuel TO anon, authenticated;
GRANT ALL ON ref.fiche_technique, ref.itineraire_mensuel TO service_role;

-- ---------------------------------------------------------------------------------------------
-- Données de départ : uniquement ce que le document donne noir sur blanc. Tout est brouillon_ia.
-- Source : plan d'affaires CIRC (Sénégal, DOC-00015), fiche technique de l'oignon (source citée : CGERV, Niayes), p. 15-21.
-- Document SÉNÉGALAIS : à confirmer pour le Togo (ITRA, ICAT). Date de la source : date de lecture (27/11/2026), la date de parution
-- du document n'étant pas connue.
-- AUCUNE ligne dans ref.itineraire_mensuel : le lot ne donne aucune part de coûts, d'heures ni de récolte par mois de cycle.
-- Le profil mensuel reste vide (le moteur garde mois_decaissement et mois_vente) tant qu'un expert ne l'a pas fourni.
-- ---------------------------------------------------------------------------------------------

INSERT INTO ref.fiche_technique (speculation_code, variante, code, phase, systeme, intrant, valeur_min, valeur_max, unite, repere, jours_apres_repere, source, date_source, notes) VALUES
  ('oignon', 'senegal_doc00015', 'densite', NULL, NULL, NULL, 66600, NULL, 'pieds par ha', NULL, NULL,
   'DOC-00015 (plan d''affaires d''une exploitation maraîchère, CIRC, Sénégal), fiche technique de l''oignon, repiquage et densité : 10 à 20 cm entre les lignes et entre les plants, « peuplement : 66 600 pieds par ha ». Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Document sénégalais (zone des Niayes et vallée du fleuve). À confirmer pour le Togo.'),
  ('oignon', 'senegal_doc00015', 'delai_repiquage', NULL, NULL, NULL, 45, 50, 'jours', 'semis', NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, repiquage : « repiquage entre 45 et 50 jours après semis ». Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Pour le semis en pépinière. À confirmer pour le Togo.'),
  ('oignon', 'senegal_doc00015', 'delai_recolte', NULL, NULL, NULL, 90, 105, 'jours', 'repiquage', NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, récolte : « récolter entre 90 et 105 jours après le repiquage » ; arrêter l''irrigation 10 à 15 jours avant. Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Cumulé au repiquage (45 à 50 jours après semis), la récolte tombe 135 à 155 jours après le semis, au-delà des 120 jours de duree_cycle_jours de ref.speculations pour l''oignon : écart à faire trancher par un expert.'),
  ('oignon', 'senegal_doc00015', 'duree_conservation', NULL, NULL, NULL, 4, 8, 'mois', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, conservation : « durée de conservation : 4 à 8 mois selon les variétés (5 à 6 mois en conservation artisanale) ». Brouillon IA : à faire valider par un expert togolais.',
   DATE '2026-11-27', 'Local sec, aéré, couches superposées. À confirmer pour le Togo.'),
  -- Apport d'eau par phase (mm par jour), 3 systèmes d'irrigation.
  ('oignon', 'senegal_doc00015', 'eau_apport', 'mois_1', 'surface', NULL, 6, NULL, 'mm par jour', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'eau_apport', 'mois_2', 'surface', NULL, 9, NULL, 'mm par jour', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'eau_apport', 'mois_3', 'surface', NULL, 11, NULL, 'mm par jour', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'eau_apport', 'mois_1', 'aspersion', NULL, 4.5, NULL, 'mm par jour', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'eau_apport', 'mois_2', 'aspersion', NULL, 6.5, NULL, 'mm par jour', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'eau_apport', 'mois_3', 'aspersion', NULL, 8.5, NULL, 'mm par jour', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'eau_apport', 'mois_1', 'goutte_a_goutte', NULL, 3, NULL, 'mm par jour', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'eau_apport', 'mois_2', 'goutte_a_goutte', NULL, 4, NULL, 'mm par jour', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'eau_apport', 'mois_3', 'goutte_a_goutte', NULL, 5, NULL, 'mm par jour', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'eau_total', NULL, 'surface', NULL, 7830, NULL, 'm3 par ha', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation : apport total, irrigation de surface. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27',
   'Le document écrit « 7,830 » (séparateur de milliers) : lu comme 7 830 m3 par ha.'),
  ('oignon', 'senegal_doc00015', 'eau_total', NULL, 'aspersion', NULL, 5850, NULL, 'm3 par ha', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation : apport total, aspersion. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27',
   'Le document écrit « 5,850 » : lu comme 5 850 m3 par ha.'),
  ('oignon', 'senegal_doc00015', 'eau_total', NULL, 'goutte_a_goutte', NULL, 3600, NULL, 'm3 par ha', NULL, NULL,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, tableau irrigation et fertilisation : apport total, goutte-à-goutte. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27',
   'Le document écrit « 3,600 » : lu comme 3 600 m3 par ha.');

-- Fumure de fond (kg par ha ; la matière organique est en tonnes par ha).
INSERT INTO ref.fiche_technique (speculation_code, variante, code, intrant, valeur_min, valeur_max, unite, source, date_source, notes) VALUES
  ('oignon', 'senegal_doc00015', 'fumure_fond', 'matiere_organique_decomposee', 20, 30, 't par ha',
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, fertilisation, fumure de fond : 20 à 30 t/ha de matière organique décomposée. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'fumure_fond', 'phosphogypse', 500, NULL, 'kg par ha',
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, fertilisation, fumure de fond : 500 kg/ha de phosphogypse. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'fumure_fond', 'npk_10_10_20', 300, NULL, 'kg par ha',
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, fertilisation, fumure de fond : 300 kg/ha de 10-10-20. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL);

-- Fumure de couverture datée (jours après le repiquage).
INSERT INTO ref.fiche_technique (speculation_code, variante, code, intrant, valeur_min, unite, repere, jours_apres_repere, source, date_source, notes) VALUES
  ('oignon', 'senegal_doc00015', 'fumure_couverture', 'npk_10_10_20', 300, 'kg par ha', 'repiquage', 20,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, fumure de couverture : repiquage + 20 jours, 300 kg/ha de 10-10-20 et 50 kg/ha d''urée 46-0-0. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'fumure_couverture', 'uree_46_0_0', 50, 'kg par ha', 'repiquage', 20,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, fumure de couverture : repiquage + 20 jours, 300 kg/ha de 10-10-20 et 50 kg/ha d''urée 46-0-0. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'fumure_couverture', 'dap_18_46_0', 150, 'kg par ha', 'repiquage', 40,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, fumure de couverture : repiquage + 40 jours, 150 kg/ha de DAP 18-46-0 et 100 kg/ha de sulfate de potasse 0-0-48. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'fumure_couverture', 'sulfate_potasse_0_0_48', 100, 'kg par ha', 'repiquage', 40,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, fumure de couverture : repiquage + 40 jours, 150 kg/ha de DAP 18-46-0 et 100 kg/ha de sulfate de potasse 0-0-48. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'fumure_couverture', 'dap_18_46_0', 150, 'kg par ha', 'repiquage', 60,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, fumure de couverture : repiquage + 60 jours, 150 kg/ha de DAP 18-46-0 et 100 kg/ha de sulfate de potasse 0-0-48. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL),
  ('oignon', 'senegal_doc00015', 'fumure_couverture', 'sulfate_potasse_0_0_48', 100, 'kg par ha', 'repiquage', 60,
   'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, fumure de couverture : repiquage + 60 jours, 150 kg/ha de DAP 18-46-0 et 100 kg/ha de sulfate de potasse 0-0-48. Brouillon IA : à faire valider par un expert togolais.', DATE '2026-11-27', NULL);
