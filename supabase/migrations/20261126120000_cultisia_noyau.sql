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
