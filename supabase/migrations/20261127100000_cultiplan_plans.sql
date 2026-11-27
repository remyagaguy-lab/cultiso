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
