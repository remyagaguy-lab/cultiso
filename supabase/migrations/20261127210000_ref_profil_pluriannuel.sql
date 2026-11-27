-- Chantier Cultiplan, R4 : profil pluriannuel par spéculation (schéma ref).
-- Testée sur la base locale seulement. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
--
-- ref.profils_speculation : le TYPE de profil d'une spéculation (annuelle, pérenne, cheptel). Une spéculation pérenne ou de cheptel
--   a une période improductive ou une constitution du cheptel : le plan doit alors la déclarer (contrôle PERIODE_IMPRODUCTIVE) ;
--   sans cette déclaration, le moteur refuse de dire que le plan est rentable.
-- ref.profil_pluriannuel : pour une spéculation et une variante, le coefficient de rendement et le taux d'utilisation de la capacité
--   de l'an 1 à l'an N (1 = plein régime). L'année absente n'est pas devinée : le moteur la laisse à la valeur de l'appelant.
-- Zéro valeur codée en dur : SOURCE et DATE de la source obligatoires, statut brouillon_ia tant qu'un expert ne l'a pas validé.
-- Lecture : tout utilisateur connecté ; visiteurs : données validées seulement. Écriture : serveur seulement.

CREATE TABLE ref.profils_speculation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speculation_code TEXT NOT NULL REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  variante TEXT NOT NULL CHECK (variante ~ '^[a-z0-9_]+$'),
  -- annuelle : produit dès le premier cycle ; perenne : plantation avec période improductive ; cheptel : bête à constituer avant de produire.
  type_profil TEXT NOT NULL CHECK (type_profil IN ('annuelle', 'perenne', 'cheptel')),
  -- Mois avant la première production, quand la source le donne ; vide = inconnu.
  mois_improductifs NUMERIC CHECK (mois_improductifs IS NULL OR mois_improductifs >= 0),
  -- Années avant le plein régime, quand la source le donne ; vide = inconnu.
  annees_plein_regime INTEGER CHECK (annees_plein_regime IS NULL OR annees_plein_regime >= 1),
  source TEXT NOT NULL CHECK (length(source) >= 5),
  date_source DATE NOT NULL,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (speculation_code, variante),
  CHECK (statut <> 'validee' OR valide_le IS NOT NULL)
);
CREATE INDEX idx_profils_speculation_code ON ref.profils_speculation(speculation_code);

CREATE TABLE ref.profil_pluriannuel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speculation_code TEXT NOT NULL REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  variante TEXT NOT NULL CHECK (variante ~ '^[a-z0-9_]+$'),
  -- Année du plan : 1 = première année.
  annee INTEGER NOT NULL CHECK (annee BETWEEN 1 AND 30),
  grandeur TEXT NOT NULL CHECK (grandeur IN (
    'coefficient_rendement',   -- part du rendement de plein régime obtenue cette année-là (0 = rien, 1 = plein régime)
    'taux_utilisation'         -- part de la capacité utilisée cette année-là (0 à 1)
  )),
  valeur NUMERIC NOT NULL CHECK (valeur >= 0),
  source TEXT NOT NULL CHECK (length(source) >= 5),
  date_source DATE NOT NULL,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (speculation_code, variante, grandeur, annee),
  CHECK (grandeur <> 'taux_utilisation' OR valeur <= 1),
  CHECK (statut <> 'validee' OR valide_le IS NOT NULL)
);
CREATE INDEX idx_profil_pluriannuel_speculation ON ref.profil_pluriannuel(speculation_code, variante);

CREATE TRIGGER update_profils_speculation_modtime BEFORE UPDATE ON ref.profils_speculation
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_profil_pluriannuel_modtime BEFORE UPDATE ON ref.profil_pluriannuel
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE ref.profils_speculation ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref.profil_pluriannuel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.profils_speculation FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.profils_speculation FOR SELECT TO anon USING (statut = 'validee');
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.profil_pluriannuel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.profil_pluriannuel FOR SELECT TO anon USING (statut = 'validee');
GRANT SELECT ON ref.profils_speculation, ref.profil_pluriannuel TO anon, authenticated;
GRANT ALL ON ref.profils_speculation, ref.profil_pluriannuel TO service_role;

-- ---------------------------------------------------------------------------------------------
-- Données de départ : uniquement ce que le lot donne noir sur blanc. Tout est brouillon_ia.
-- ---------------------------------------------------------------------------------------------

-- Poule pondeuse : un cheptel à constituer. DOC-00136 (complexe avicole intégré, Koulikoro, Mali, 2014), p. 3 : cycle de 18 mois dont
-- 6 de phase improductive ; DOC-00686 (modèle burkinabè) : 5 mois sans ponte. Seul le DOC-00136 est retenu ici (variante mali_doc00136),
-- comme dans ref.parametres_elevage.
INSERT INTO ref.profils_speculation (speculation_code, variante, type_profil, mois_improductifs, source, date_source, notes)
SELECT 'poule_pondeuse', 'mali_doc00136', 'cheptel', 6,
  'DOC-00136 (profil d''investissement, complexe avicole intégré, Koulikoro, Mali, 2014), p. 3 : cycle de la pondeuse de 18 mois, dont 6 de phase improductive. Brouillon IA : à faire valider par un expert togolais.',
  DATE '2026-11-27',
  'Le DOC-00686 (Burkina Faso) donne 5 mois sans ponte (variante burkina_doc00686 de ref.courbes_age) ; l''écart est à faire trancher par un expert. Aucun coefficient par année : le lot n''en donne pas.'
WHERE EXISTS (SELECT 1 FROM ref.speculations WHERE code = 'poule_pondeuse');

-- Oignon : culture annuelle (cycle de 120 jours selon ref.speculations ; DOC-00015 : une récolte par cycle, jusqu'à 4 cultures possibles par an).
INSERT INTO ref.profils_speculation (speculation_code, variante, type_profil, source, date_source, notes)
SELECT 'oignon', 'senegal_doc00015', 'annuelle',
  'DOC-00015 (plan d''affaires CIRC, Sénégal), fiche technique de l''oignon, calendrier cultural : culture à cycle court (semis, repiquage, récolte dans la même saison). Brouillon IA : à faire valider par un expert togolais.',
  DATE '2026-11-27',
  'Aucune période improductive ni montée en production donnée par le document ; coefficient du débutant non chiffré dans le lot (DOC-00006 p. 23-24 le recommande sans valeur).'
WHERE EXISTS (SELECT 1 FROM ref.speculations WHERE code = 'oignon');

-- Aucune ligne dans ref.profil_pluriannuel : le lot ne donne aucun coefficient de rendement ni taux d'utilisation par année
-- (DOC-00010 p. 22 et 137, DOC-00006 p. 23-24 en parlent sans chiffre). Les autres spéculations ne sont pas classées : le plan les
-- traite comme « profil non renseigné » (contrôle PERIODE_IMPRODUCTIVE en info), jamais comme annuelles par défaut.
