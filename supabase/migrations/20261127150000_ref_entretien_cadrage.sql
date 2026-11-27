-- Cultiplan S3 : entretien de cadrage (la consultation en six temps) dans le référentiel.
-- Testée sur la base locale. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
-- Les questions, leur ordre, les conditions et les phrases de lecture sont des DONNÉES (pas du code) :
-- même cycle de vie que le reste du référentiel (brouillon_ia, a_valider, validee, avec une source).
-- Lecture : tout utilisateur connecté ; visiteurs : lignes validées seulement. Écriture : serveur seulement.

-- 1. Les six temps de la consultation.
CREATE TABLE ref.entretien_temps (
  cle TEXT PRIMARY KEY CHECK (cle ~ '^[a-z0-9_]+$'),
  ordre INTEGER NOT NULL,
  titre TEXT NOT NULL CHECK (length(titre) BETWEEN 2 AND 120),
  intro TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Les sept dimensions de faisabilité, avec leurs règles de lecture (feu et phrase).
-- regles : tableau de { "si": condition, "feu": "vert|orange|rouge", "phrase": "..." }.
CREATE TABLE ref.entretien_dimensions (
  cle TEXT PRIMARY KEY CHECK (cle ~ '^[a-z0-9_]+$'),
  ordre INTEGER NOT NULL,
  libelle TEXT NOT NULL CHECK (length(libelle) BETWEEN 2 AND 120),
  phrase_sans_alerte TEXT NOT NULL,
  regles JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(regles) = 'array'),
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Les questions. Soit une question propre à l'entretien (libellé, type, champ rempli),
-- soit le placement d'une question de terrain existante (question_terrain) : son libellé et ses réponses
-- restent dans ref.questions_terrain, la réponse va dans le contexte terrain.
CREATE TABLE ref.entretien_questions (
  cle TEXT PRIMARY KEY CHECK (cle ~ '^[a-z0-9_]+$'),
  temps TEXT NOT NULL REFERENCES ref.entretien_temps(cle) ON UPDATE CASCADE,
  ordre INTEGER NOT NULL,
  question_terrain TEXT REFERENCES ref.questions_terrain(cle) ON UPDATE CASCADE ON DELETE CASCADE,
  libelle TEXT CHECK (libelle IS NULL OR length(libelle) BETWEEN 2 AND 300),
  aide TEXT,
  type TEXT CHECK (type IN ('choix', 'choix_multiple', 'nombre', 'montant', 'oui_non', 'texte', 'liste')),
  unite TEXT,
  -- Tableau de { "valeur": "...", "libelle": "..." }.
  reponses JSONB CHECK (reponses IS NULL OR jsonb_typeof(reponses) = 'array'),
  -- { "cible": "profil|contexte|existant|credits", "champ": "...", "aussi": {...} } : où va la réponse.
  remplit JSONB CHECK (remplit IS NULL OR jsonb_typeof(remplit) = 'object'),
  -- Condition d'affichage ; vide = toujours posée.
  condition JSONB CHECK (condition IS NULL OR jsonb_typeof(condition) = 'object'),
  dimension TEXT REFERENCES ref.entretien_dimensions(cle) ON UPDATE CASCADE ON DELETE SET NULL,
  essentielle BOOLEAN NOT NULL DEFAULT false,
  -- Courte description pour les phrases de manque : « il te manque encore : ta source d'eau ».
  court TEXT NOT NULL CHECK (length(court) BETWEEN 2 AND 120),
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (question_terrain IS NOT NULL OR (libelle IS NOT NULL AND type IS NOT NULL AND remplit IS NOT NULL))
);
CREATE INDEX idx_entretien_questions_temps ON ref.entretien_questions(temps, ordre);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['entretien_temps', 'entretien_dimensions', 'entretien_questions'] LOOP
    EXECUTE format('CREATE TRIGGER update_%1$s_modtime BEFORE UPDATE ON ref.%1$I FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column()', t);
    EXECUTE format('ALTER TABLE ref.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.%I FOR SELECT TO anon USING (statut = ''validee'')', t);
    EXECUTE format('GRANT SELECT ON ref.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON ref.%I TO service_role', t);
  END LOOP;
END $$;
