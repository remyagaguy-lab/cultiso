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
