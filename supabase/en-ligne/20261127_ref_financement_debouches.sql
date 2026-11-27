-- Application EN LIGNE de M6 et R3 : barème du crédit de campagne (ref.baremes_credit_campagne) et circuits de commercialisation (ref.circuits_commercialisation), projet redtuedpnhbqziqmyyjc.
-- ASSEMBLÉ le 2026-11-27 à partir des migrations locales 20261127190000 et 20261127191000.
-- NE PAS EXÉCUTER sans le feu vert explicite de Remyaga. Lire d'abord supabase/en-ligne/PROCEDURE-FINANCEMENT-DEBOUCHES.md.
-- NE PAS utiliser `supabase db push` (la base en ligne n'a pas d'historique de migrations).
-- Exécution : npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_financement_debouches.sql
-- Une seule transaction : en cas d'erreur, rien n'est appliqué. NON rejouable telle quelle (les tables sont créées sans IF NOT EXISTS) : vérifier d'abord qu'elles n'existent pas.
-- Prérequis : le schéma ref, la table ref.speculations et la fonction public.update_modified_column() existent en ligne (voir la procédure, étape 1).

BEGIN;

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

-- Chantier Cultiplan, R3 : circuits de commercialisation (schéma ref).
-- Testée sur la base locale seulement. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
--
-- Une ligne = un circuit par lequel un produit se vend (bord champ, marché local, grossiste, transformateur, export, contrat).
-- C'est la LISTE des circuits, pas des prix : les prix, les parts de volume et les contrats viennent du porteur, de l'étude de marché
-- ou d'un contrat, avec leur source. Aucune valeur chiffrée n'est écrite ici.
-- Un circuit « contractuel » est celui où le prix et le volume sont fixés d'avance (agriculture contractuelle).
-- Même cycle de vie que le reste du référentiel : brouillon_ia, a_valider, validee.
-- Lecture : tout utilisateur connecté ; visiteurs : circuits validés seulement. Écriture : serveur seulement.

CREATE TABLE ref.circuits_commercialisation (
  code TEXT PRIMARY KEY CHECK (code ~ '^[a-z0-9_]+$'),
  libelle TEXT NOT NULL CHECK (length(libelle) BETWEEN 2 AND 80),
  description TEXT,
  contractuel BOOLEAN NOT NULL DEFAULT false,
  ordre INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (length(source) >= 5),
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (statut <> 'validee' OR valide_le IS NOT NULL)
);

CREATE TRIGGER update_circuits_commercialisation_modtime BEFORE UPDATE ON ref.circuits_commercialisation
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE ref.circuits_commercialisation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.circuits_commercialisation FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.circuits_commercialisation FOR SELECT TO anon USING (statut = 'validee');
GRANT SELECT ON ref.circuits_commercialisation TO anon, authenticated;
GRANT ALL ON ref.circuits_commercialisation TO service_role;

-- Les six circuits demandés par le chantier R3 (ANALYSE-BASE-RESSOURCES §4.1 ; DOC-00163 p. 16-23, 87 ; DOC-00009 p. 28 ; DOC-00106 p. 32-35).
INSERT INTO ref.circuits_commercialisation (code, libelle, description, contractuel, ordre, source) VALUES
  ('bord_champ', 'Vente au bord du champ', 'Un acheteur vient chercher la récolte sur la parcelle.', false, 1, 'ANALYSE-BASE-RESSOURCES §4.1, R3 (liste des circuits)'),
  ('marche_local', 'Marché local', 'Vente directe aux consommateurs ou aux revendeurs du marché.', false, 2, 'ANALYSE-BASE-RESSOURCES §4.1, R3 (liste des circuits)'),
  ('grossiste', 'Grossiste', 'Vente à un commerçant qui revend en gros.', false, 3, 'ANALYSE-BASE-RESSOURCES §4.1, R3 (liste des circuits)'),
  ('transformateur', 'Transformateur', 'Vente à une unité qui transforme la récolte (huile, farine, conserve).', false, 4, 'ANALYSE-BASE-RESSOURCES §4.1, R3 (liste des circuits)'),
  ('export', 'Export', 'Vente à un exportateur ou directement à l''étranger.', false, 5, 'ANALYSE-BASE-RESSOURCES §4.1, R3 (liste des circuits)'),
  ('contrat', 'Contrat avec un acheteur', 'Prix et volume fixés d''avance avec un acheteur, souvent avec des services intégrés déduits du paiement.', true, 6, 'ANALYSE-BASE-RESSOURCES §4.1, R3 ; DOC-00163 p. 16-23, 87')
ON CONFLICT (code) DO NOTHING;

COMMIT;
