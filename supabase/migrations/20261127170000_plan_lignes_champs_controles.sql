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
