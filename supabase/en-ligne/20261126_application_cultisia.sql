-- Application en ligne du chantier Cultisia (26/11/2026), projet redtuedpnhbqziqmyyjc.
-- NE PAS utiliser `supabase db push` : la base en ligne n'a pas d'historique de migrations.
-- Exécution (depuis le dossier cultiso.com) :
--   npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261126_application_cultisia.sql
-- Tout passe dans une seule transaction : en cas d'erreur, rien n'est appliqué.
-- État en ligne vérifié le 26/11/2026 (lecture seule) : table cultiplan_zae_togo absente,
-- price_records.unit absente, deduct_tokens présente, récursion RLS présente sur cultiso_members
-- (et politique INSERT « Owners can add members » qui compare cultiso_id à lui-même).

BEGIN;

-- ===== 1/3 : supabase/migrations/20260926120000_zae_togo.sql (+ DROP POLICY IF EXISTS pour rester rejouable) =====
-- Create Table for Agro-Ecological Zones (Togo)
CREATE TABLE IF NOT EXISTS public.cultiplan_zae_togo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id TEXT UNIQUE NOT NULL, -- e.g., 'ZONE_1', 'ZONE_2'
    name TEXT NOT NULL, -- e.g., 'Région des Savanes'
    description TEXT,
    rainfall_min_mm INTEGER,
    rainfall_max_mm INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- RLS Policies
ALTER TABLE public.cultiplan_zae_togo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to zae_togo" ON public.cultiplan_zae_togo;
CREATE POLICY "Allow public read access to zae_togo"
    ON public.cultiplan_zae_togo FOR SELECT
    USING (true);

-- Insert Data for the 5 zones of Togo
INSERT INTO public.cultiplan_zae_togo (zone_id, name, description, rainfall_min_mm, rainfall_max_mm)
VALUES 
    ('ZONE_1', 'Zone I (Savanes)', 'Nord du Togo, plaines. Climat soudanais.', 900, 1100),
    ('ZONE_2', 'Zone II (Kara)', 'Région septentrionale, massifs montagneux.', 1200, 1300),
    ('ZONE_3', 'Zone III (Centrale)', 'Plaine centrale, climat de transition.', 1200, 1500),
    ('ZONE_4', 'Zone IV (Plateaux)', 'Sud-ouest, montagnes et forêts, zone café-cacao.', 1400, 1600),
    ('ZONE_5', 'Zone V (Maritime)', 'Sud du pays, côte et basse plaine.', 800, 1200)
ON CONFLICT (zone_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    description = EXCLUDED.description, 
    rainfall_min_mm = EXCLUDED.rainfall_min_mm, 
    rainfall_max_mm = EXCLUDED.rainfall_max_mm;

-- ===== 2/3 : supabase/migrations/20261126120000_cultisia_noyau.sql =====
-- Migration : noyau de Cultisia (chantier 1 de la refonte, 26/11/2026)
-- Testée sur la base locale. À appliquer sur la base en ligne UNIQUEMENT avec le feu vert de Remyaga.
-- Idempotente : peut être rejouée sans erreur.

-- 1. Rattrapage (comparaison avec les types de la base en ligne, 26/11/2026) :
--    - `country` existe en ligne (ajoutée à la main), absente des migrations ;
--    - `unit` est lue par search_market_prices mais n'existe PAS en ligne : la fonction y échoue.
ALTER TABLE public.price_records ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.price_records ADD COLUMN IF NOT EXISTS unit TEXT;

-- 2. Mémoire : rattacher une conversation à l'exploitation et au module.
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS exploitation_id UUID REFERENCES public.cultisos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS module TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_module_check') THEN
    ALTER TABLE public.chat_sessions
      ADD CONSTRAINT chat_sessions_module_check
      CHECK (module IS NULL OR module IN ('cultisia', 'cultiplan', 'cultima', 'cultiseil', 'cours-des-prix'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_exploitation ON public.chat_sessions(exploitation_id);

-- 3. Crédits : débit atomique, appelable seulement par le serveur (clé de service).
--    Solde absent = 20 000 jetons offerts une seule fois ; aucune recharge.
CREATE OR REPLACE FUNCTION public.debiter_credits(p_user_id UUID, p_montant INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadonnees JSONB;
  solde INT;
BEGIN
  IF p_montant IS NULL OR p_montant < 0 THEN
    RAISE EXCEPTION 'Montant de débit invalide : %', p_montant;
  END IF;

  SELECT raw_app_meta_data INTO metadonnees
  FROM auth.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable : %', p_user_id;
  END IF;

  solde := COALESCE((metadonnees->>'tokens_balance')::INT, 20000) - p_montant;

  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(COALESCE(metadonnees, '{}'::jsonb), '{tokens_balance}', to_jsonb(solde))
  WHERE id = p_user_id;

  RETURN solde;
END;
$$;

REVOKE ALL ON FUNCTION public.debiter_credits(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debiter_credits(UUID, INT) TO service_role;

-- L'ancienne fonction (paramètre ignoré, auth.uid() vide avec la clé de service) ne débitait jamais.
DROP FUNCTION IF EXISTS public.deduct_tokens(INT);

-- 4. Prix : lecture tolérante aux accents, avec la source du relevé.
CREATE OR REPLACE FUNCTION public.lire_prix_marche(p_terme TEXT)
RETURNS TABLE (
  product_name TEXT,
  price NUMERIC,
  currency TEXT,
  unit TEXT,
  location TEXT,
  record_date DATE,
  source TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p.name,
    pr.price,
    pr.currency,
    COALESCE(pr.unit, p.default_unit),
    pr.location,
    pr.record_date,
    pr.source
  FROM public.products p
  JOIN public.price_records pr ON pr.product_id = p.id
  WHERE translate(lower(p.name), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc')
        LIKE '%' || translate(lower(p_terme), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') || '%'
  ORDER BY pr.record_date DESC, p.name
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.lire_prix_marche(TEXT) TO anon, authenticated, service_role;

-- 5. Recherche documentaire : seulement les documents dont la licence est marquée autorisée.
--    Tant que le tri des licences n'est pas fait, aucun document ne l'est : la recherche renvoie vide.
CREATE OR REPLACE FUNCTION public.chercher_savoir_autorise(
  p_embedding vector(384),
  p_seuil FLOAT,
  p_nombre INT
)
RETURNS TABLE (file_name TEXT, content TEXT, similarity FLOAT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT k.file_name, k.content, 1 - (k.embedding <=> p_embedding) AS similarity
  FROM public.cultisia_knowledge k
  WHERE k.metadata->>'licence' = 'autorisee'
    AND 1 - (k.embedding <=> p_embedding) > p_seuil
  ORDER BY k.embedding <=> p_embedding
  LIMIT LEAST(GREATEST(p_nombre, 1), 10);
$$;

GRANT EXECUTE ON FUNCTION public.chercher_savoir_autorise(vector, FLOAT, INT) TO anon, authenticated, service_role;

-- ===== 3/3 : supabase/migrations/20261126120100_correctif_rls_membres.sql =====
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

COMMIT;
