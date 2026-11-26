-- Correctif : récursion infinie dans les politiques de cultiso_members (migration 20260917174000).
-- La politique SELECT de cultiso_members interrogeait cultiso_members elle-même ; toute lecture de cultisos,
-- transactions ou business_plans échouait avec « infinite recursion detected in policy ».
-- Constaté sur la base locale le 26/11/2026. État de la base en ligne : à vérifier avant d'appliquer.
-- À appliquer sur la base en ligne UNIQUEMENT avec le feu vert de Remyaga.

-- Fonctions d'appartenance, exécutées avec les droits du propriétaire (pas de RLS, donc pas de récursion).
CREATE OR REPLACE FUNCTION public.mes_exploitations()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cultiso_id FROM public.cultiso_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.est_proprietaire(p_cultiso_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cultiso_members
    WHERE cultiso_id = p_cultiso_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.mes_exploitations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.est_proprietaire(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_exploitations() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.est_proprietaire(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view members of their cultisos" ON public.cultiso_members;
CREATE POLICY "Users can view members of their cultisos"
  ON public.cultiso_members FOR SELECT
  USING (user_id = auth.uid() OR cultiso_id IN (SELECT public.mes_exploitations()));

DROP POLICY IF EXISTS "Owners can add members" ON public.cultiso_members;
CREATE POLICY "Owners can add members"
  ON public.cultiso_members FOR INSERT
  WITH CHECK (public.est_proprietaire(cultiso_id));
