-- Application EN LIGNE du socle Cultiplan (27/11/2026), projet redtuedpnhbqziqmyyjc. Assemblé à partir des migrations locales 20261126130000, 20261126140000, 20261127100000, 20261127160000, 20261127170000. Feu vert de Remyaga donné le 27/11/2026.
-- NE PAS utiliser supabase db push. Une seule transaction.
BEGIN;

-- ===== 20261126130000_cultiplan_socle =====
-- Chantier 2 Cultiplan, étape 4 : socle de l'exploitation (statuts, ateliers, contexte terrain).
-- Testée sur la base locale. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
-- Zéro colonne métier : un atelier ne connaît qu'un code de spéculation, une taille et une unité ;
-- le contexte terrain est une liste de réponses clé et valeur.

-- 1. Statuts de l'exploitation, renommés en français (décision du 26/11) : projet, active, archivee.
ALTER TABLE public.cultisos DROP CONSTRAINT IF EXISTS cultisos_status_check;
UPDATE public.cultisos SET status = CASE
  WHEN status IN ('active') THEN 'active'
  WHEN status IN ('archived', 'archivee') THEN 'archivee'
  ELSE 'projet'
END;
ALTER TABLE public.cultisos ALTER COLUMN status SET DEFAULT 'projet';
ALTER TABLE public.cultisos ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.cultisos ADD CONSTRAINT cultisos_status_check CHECK (status IN ('projet', 'active', 'archivee'));

-- 2. Correctif : insert().select() échouait, car la ligne de membre naît dans un déclencheur AFTER INSERT,
-- après le contrôle RLS du RETURNING. Le créateur voit désormais toujours sa ligne.
DROP POLICY IF EXISTS "Users can view cultisos they are members of" ON public.cultisos;
CREATE POLICY "Users can view cultisos they are members of"
  ON public.cultisos FOR SELECT
  USING (user_id = auth.uid() OR id IN (SELECT public.mes_exploitations()));

-- 3. Droit d'écriture : propriétaire ou collaborateur (sans RLS, donc sans récursion).
CREATE OR REPLACE FUNCTION public.peut_modifier(p_cultiso_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cultiso_members
    WHERE cultiso_id = p_cultiso_id AND user_id = auth.uid() AND role IN ('owner', 'collaborator')
  );
$$;
REVOKE ALL ON FUNCTION public.peut_modifier(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peut_modifier(UUID) TO authenticated, service_role;

-- 4. Ateliers : une spéculation × une taille dans son unité (2 ha de tomate, 500 poulets).
-- speculation_code renvoie à ref.speculations (clé étrangère ajoutée avec le référentiel, étape 5).
CREATE TABLE public.ateliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultiso_id UUID NOT NULL REFERENCES public.cultisos(id) ON DELETE CASCADE,
  speculation_code TEXT NOT NULL CHECK (speculation_code ~ '^[a-z0-9_]+$'),
  taille NUMERIC NOT NULL CHECK (taille > 0),
  unite TEXT NOT NULL CHECK (length(unite) BETWEEN 1 AND 30),
  date_demarrage DATE,
  libelle TEXT CHECK (libelle IS NULL OR length(libelle) <= 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ateliers_cultiso_id ON public.ateliers(cultiso_id);
CREATE TRIGGER update_ateliers_modtime
  BEFORE UPDATE ON public.ateliers
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE public.ateliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Les membres voient les ateliers"
  ON public.ateliers FOR SELECT USING (cultiso_id IN (SELECT public.mes_exploitations()));
CREATE POLICY "Propriétaires et collaborateurs ajoutent des ateliers"
  ON public.ateliers FOR INSERT WITH CHECK (public.peut_modifier(cultiso_id));
CREATE POLICY "Propriétaires et collaborateurs modifient les ateliers"
  ON public.ateliers FOR UPDATE USING (public.peut_modifier(cultiso_id)) WITH CHECK (public.peut_modifier(cultiso_id));
CREATE POLICY "Propriétaires et collaborateurs suppriment des ateliers"
  ON public.ateliers FOR DELETE USING (public.peut_modifier(cultiso_id));

-- 5. Contexte terrain : une réponse par question (clé de ref.questions_terrain), saisie une seule fois par exploitation.
CREATE TABLE public.contexte_terrain (
  cultiso_id UUID NOT NULL REFERENCES public.cultisos(id) ON DELETE CASCADE,
  cle TEXT NOT NULL CHECK (cle ~ '^[a-z0-9_]+$'),
  valeur TEXT NOT NULL CHECK (length(valeur) BETWEEN 1 AND 200),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cultiso_id, cle)
);
CREATE TRIGGER update_contexte_terrain_modtime
  BEFORE UPDATE ON public.contexte_terrain
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE public.contexte_terrain ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Les membres voient le contexte terrain"
  ON public.contexte_terrain FOR SELECT USING (cultiso_id IN (SELECT public.mes_exploitations()));
CREATE POLICY "Propriétaires et collaborateurs répondent au terrain"
  ON public.contexte_terrain FOR INSERT WITH CHECK (public.peut_modifier(cultiso_id));
CREATE POLICY "Propriétaires et collaborateurs modifient le terrain"
  ON public.contexte_terrain FOR UPDATE USING (public.peut_modifier(cultiso_id)) WITH CHECK (public.peut_modifier(cultiso_id));
CREATE POLICY "Propriétaires et collaborateurs effacent une réponse"
  ON public.contexte_terrain FOR DELETE USING (public.peut_modifier(cultiso_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ateliers, public.contexte_terrain TO authenticated;
GRANT ALL ON public.ateliers, public.contexte_terrain TO service_role;

-- ===== 20261126140000_cultiplan_referentiel =====
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

-- ===== 20261127100000_cultiplan_plans =====
-- Chantier 2 Cultiplan, étape 7 : plan persistant (plans, lignes avec origine, variantes « Et si ? »).
-- Testée sur la base locale. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
--
-- Un plan appartient à une exploitation. Ses lignes de charges et de revenus gardent leur origine
-- (référence, estimation, ajustée au terrain, prix du marché, utilisateur, Cultisia) et la trace du modèle
-- du référentiel et des règles appliquées. Les résultats (jsonb) sont TOUJOURS la sortie du moteur,
-- jamais une saisie ; version_moteur dit avec quelle version des moteurs ils ont été calculés.
-- Un plan « lance » ou « archive » est figé : ses lignes ne bougent plus et il n'est plus recalculé.

-- 1. Plans.
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultiso_id UUID NOT NULL REFERENCES public.cultisos(id) ON DELETE CASCADE,
  titre TEXT NOT NULL CHECK (length(titre) BETWEEN 2 AND 120),
  -- Numéro de calcul : 1 à la génération, +1 à chaque recalcul.
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  -- Variante « Et si ? » : le plan dont celui-ci est la copie.
  variante_de UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'lance', 'archive')),
  -- Horizon, taux d'actualisation, hausses annuelles des charges et des prix.
  hypotheses JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(hypotheses) = 'object'),
  -- Apport et crédit (entrée du moteur de crédit).
  financement JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(financement) = 'object'),
  -- Sortie du moteur financier ; null tant que le plan n'est pas calculé.
  resultats JSONB,
  -- Ateliers sans modèle et prix du marché retenus à la génération.
  generation JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(generation) = 'object'),
  version_moteur TEXT,
  calcule_le TIMESTAMPTZ,
  cree_par UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((resultats IS NULL) = (version_moteur IS NULL))
);
CREATE INDEX idx_plans_cultiso_id ON public.plans(cultiso_id);
CREATE INDEX idx_plans_variante_de ON public.plans(variante_de);
CREATE TRIGGER update_plans_modtime
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- 2. Lignes du plan : une charge ou un revenu, au format des moteurs.
CREATE TABLE public.plan_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  atelier_id UUID REFERENCES public.ateliers(id) ON DELETE SET NULL,
  sens TEXT NOT NULL CHECK (sens IN ('charge', 'revenu')),
  -- Type de charge (7 types du référentiel) ou de revenu (4 types).
  type TEXT NOT NULL CHECK (type IN
    ('intrants', 'main_oeuvre', 'energie', 'infrastructures', 'sanitaire', 'logistique', 'frais_financiers',
     'principal', 'coproduit', 'sous_produit', 'service')),
  libelle TEXT NOT NULL CHECK (length(libelle) BETWEEN 2 AND 120),
  unite TEXT NOT NULL CHECK (length(unite) BETWEEN 1 AND 30),
  -- Charge : une quantité ; revenu : trois quantités (scénarios).
  quantite NUMERIC CHECK (quantite >= 0),
  quantite_pessimiste NUMERIC CHECK (quantite_pessimiste >= 0),
  quantite_realiste NUMERIC CHECK (quantite_realiste >= 0),
  quantite_optimiste NUMERIC CHECK (quantite_optimiste >= 0),
  prix_unitaire NUMERIC NOT NULL CHECK (prix_unitaire >= 0),
  frequence NUMERIC NOT NULL DEFAULT 1 CHECK (frequence >= 0),
  base TEXT NOT NULL DEFAULT 'cycle' CHECK (base IN ('cycle', 'an')),
  cycles_par_an NUMERIC NOT NULL DEFAULT 1 CHECK (cycles_par_an > 0),
  nature TEXT CHECK (nature IN ('fixe', 'variable')),
  classe TEXT CHECK (classe IN ('investissement', 'exploitation')),
  duree_vie_ans NUMERIC CHECK (duree_vie_ans > 0),
  -- Mois de décaissement (charge) ou de vente (revenu), 1 à 12.
  mois INTEGER[] CHECK (mois IS NULL OR (mois <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12] AND cardinality(mois) > 0)),
  pertes NUMERIC NOT NULL DEFAULT 0 CHECK (pertes >= 0 AND pertes <= 1),
  origine TEXT NOT NULL CHECK (origine IN
    ('reference', 'estimation', 'ajustee_terrain', 'prix_marche', 'utilisateur', 'cultisia')),
  -- Trace vers le référentiel (sans clé étrangère : le plan survit à la révision du référentiel).
  modele_id UUID,
  -- Règles du terrain appliquées à la génération : [{ regleId, effet, coefficient }].
  ajustements JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ajustements) = 'array'),
  -- Prix du marché retenu : { source, date } ; null sinon.
  source_prix JSONB,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sens <> 'charge' OR (quantite IS NOT NULL AND nature IS NOT NULL AND classe IS NOT NULL
         AND type IN ('intrants', 'main_oeuvre', 'energie', 'infrastructures', 'sanitaire', 'logistique', 'frais_financiers'))),
  CHECK (sens <> 'revenu' OR (quantite_pessimiste IS NOT NULL AND quantite_realiste IS NOT NULL AND quantite_optimiste IS NOT NULL
         AND type IN ('principal', 'coproduit', 'sous_produit', 'service'))),
  CHECK (classe IS DISTINCT FROM 'investissement' OR duree_vie_ans IS NOT NULL)
);
CREATE INDEX idx_plan_lignes_plan_id ON public.plan_lignes(plan_id);
CREATE INDEX idx_plan_lignes_atelier_id ON public.plan_lignes(atelier_id);
CREATE TRIGGER update_plan_lignes_modtime
  BEFORE UPDATE ON public.plan_lignes
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- 3. Droit de modifier les lignes : plan en brouillon, propriétaire ou collaborateur de l'exploitation.
CREATE OR REPLACE FUNCTION public.peut_modifier_plan(p_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plans p
    WHERE p.id = p_plan_id AND p.statut = 'brouillon' AND public.peut_modifier(p.cultiso_id)
  );
$$;
REVOKE ALL ON FUNCTION public.peut_modifier_plan(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peut_modifier_plan(UUID) TO authenticated, service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Les membres voient les plans"
  ON public.plans FOR SELECT USING (cultiso_id IN (SELECT public.mes_exploitations()));
CREATE POLICY "Propriétaires et collaborateurs créent des plans"
  ON public.plans FOR INSERT WITH CHECK (public.peut_modifier(cultiso_id));
CREATE POLICY "Propriétaires et collaborateurs modifient les plans"
  ON public.plans FOR UPDATE USING (public.peut_modifier(cultiso_id)) WITH CHECK (public.peut_modifier(cultiso_id));
CREATE POLICY "Le propriétaire supprime un plan"
  ON public.plans FOR DELETE USING (public.est_proprietaire(cultiso_id));

ALTER TABLE public.plan_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Les membres voient les lignes des plans"
  ON public.plan_lignes FOR SELECT
  USING (plan_id IN (SELECT id FROM public.plans WHERE cultiso_id IN (SELECT public.mes_exploitations())));
CREATE POLICY "Lignes ajoutées à un plan en brouillon"
  ON public.plan_lignes FOR INSERT WITH CHECK (public.peut_modifier_plan(plan_id));
CREATE POLICY "Lignes modifiées dans un plan en brouillon"
  ON public.plan_lignes FOR UPDATE USING (public.peut_modifier_plan(plan_id)) WITH CHECK (public.peut_modifier_plan(plan_id));
CREATE POLICY "Lignes supprimées d'un plan en brouillon"
  ON public.plan_lignes FOR DELETE USING (public.peut_modifier_plan(plan_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans, public.plan_lignes TO authenticated;
GRANT ALL ON public.plans, public.plan_lignes TO service_role;

-- 4. Prix du marché pour le générateur de budget : dernier relevé de chaque produit, par unité,
--    depuis une date donnée (les relevés trop anciens ne remplacent pas la référence).
--    Le nom du produit (products.name) est comparé sans accents ni majuscules à modeles_*.produit_prix.
CREATE OR REPLACE FUNCTION public.derniers_prix_produits(p_produits TEXT[], p_depuis DATE)
RETURNS TABLE (produit TEXT, prix NUMERIC, unite TEXT, lieu TEXT, date_releve DATE, source TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (cle, lower(u))
    x.produit, x.prix, x.u, x.lieu, x.date_releve, x.source
  FROM (
    SELECT
      translate(lower(p.name), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') AS cle,
      d.demande AS produit,
      pr.price AS prix,
      COALESCE(pr.unit, p.default_unit) AS u,
      pr.location AS lieu,
      pr.record_date AS date_releve,
      pr.source,
      pr.created_at
    FROM public.products p
    JOIN public.price_records pr ON pr.product_id = p.id
    JOIN unnest(p_produits) AS d(demande)
      ON translate(lower(d.demande), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc')
       = translate(lower(p.name), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc')
    WHERE pr.record_date >= p_depuis AND pr.price > 0
  ) x
  ORDER BY cle, lower(u), x.date_releve DESC, x.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.derniers_prix_produits(TEXT[], DATE) TO authenticated, service_role;

-- ===== 20261127160000_ref_bornes_rendement =====
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

-- ===== 20261127170000_plan_lignes_champs_controles =====
-- Champs optionnels des lignes de plan que lisent les contrôles du §3.6 du moteur financier.
-- Un seul groupe JSONB, validé par zod côté application (src/modules/cultiplan/lignes.ts) :
--   charge : fournisseur, referenceItineraire, couverture, emploi ;
--   revenu : bornesQuantite, client, perenne, debouche.
-- Vide par défaut : une ligne sans ces champs reste calculée comme avant.
ALTER TABLE public.plan_lignes
  ADD COLUMN IF NOT EXISTS champs_controle JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(champs_controle) = 'object');

COMMENT ON COLUMN public.plan_lignes.champs_controle IS
  'Champs optionnels lus par les contrôles du moteur (bornesQuantite, referenceItineraire, couverture, emploi, perenne, debouche, client, fournisseur).';

COMMIT;
