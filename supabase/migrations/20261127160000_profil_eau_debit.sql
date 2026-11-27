-- Cultiplan R9, suite : débit de l'eau du porteur (facultatif, « je ne sais pas » possible via la liste `inconnus`).
-- Testée sur la base locale. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
-- Mètres cubes par jour que la source peut fournir en saison de besoin ; NULL = pas répondu ou « je ne sais pas ».
ALTER TABLE public.profil_porteur
  ADD COLUMN eau_debit_m3_jour NUMERIC CHECK (eau_debit_m3_jour >= 0);
