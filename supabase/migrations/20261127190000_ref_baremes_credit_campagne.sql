-- Chantier Cultiplan, M6 : barème du crédit de campagne par spéculation (schéma ref).
-- Testée sur la base locale seulement. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
--
-- Une ligne = le plafond qu'un financeur accorde en crédit de campagne pour 1 unité d'échelle d'une spéculation
-- (par exemple FCFA par hectare). Le moteur de financement multiplie ce plafond par la taille de l'atelier.
-- Zéro valeur codée en dur dans le code : le plafond, la durée et le taux sont des données ; une colonne vide veut dire « inconnu ».
-- Source ET date de la source sont obligatoires, même en brouillon. Aucune ligne n'est fournie par cette migration :
-- le lot de documents ne donne aucun barème chiffré par spéculation, il faut le demander au financeur.
-- Même cycle de vie que le reste du référentiel : brouillon_ia, a_valider, validee.
-- Lecture : tout utilisateur connecté ; visiteurs : barèmes validés seulement. Écriture : serveur seulement.

CREATE TABLE ref.baremes_credit_campagne (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speculation_code TEXT NOT NULL REFERENCES ref.speculations(code) ON UPDATE CASCADE ON DELETE CASCADE,
  -- Organisme et produit du financeur (comme ref.regles_financeurs) ; vide : barème général.
  organisme TEXT CHECK (organisme IS NULL OR length(organisme) BETWEEN 2 AND 80),
  produit TEXT CHECK (produit IS NULL OR produit ~ '^[a-z0-9_]+$'),
  -- Plafond en FCFA pour 1 unité d'échelle de la spéculation (ref.speculations.unite_echelle).
  plafond_par_unite NUMERIC NOT NULL CHECK (plafond_par_unite >= 0),
  duree_max_mois INTEGER CHECK (duree_max_mois > 0),
  taux_indicatif NUMERIC CHECK (taux_indicatif >= 0 AND taux_indicatif <= 1),
  source TEXT NOT NULL CHECK (length(source) >= 5),
  date_source DATE NOT NULL,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (statut <> 'validee' OR valide_le IS NOT NULL)
);
CREATE UNIQUE INDEX idx_baremes_campagne_unique ON ref.baremes_credit_campagne (speculation_code, COALESCE(organisme, ''), COALESCE(produit, ''));

CREATE TRIGGER update_baremes_credit_campagne_modtime BEFORE UPDATE ON ref.baremes_credit_campagne
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE ref.baremes_credit_campagne ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.baremes_credit_campagne FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.baremes_credit_campagne FOR SELECT TO anon USING (statut = 'validee');
GRANT SELECT ON ref.baremes_credit_campagne TO anon, authenticated;
GRANT ALL ON ref.baremes_credit_campagne TO service_role;
