-- Données de test pour la base LOCALE uniquement (supabase db reset). Jamais appliqué sur la base en ligne.
-- Prix fictifs, marqués comme tels dans la source.

INSERT INTO public.products (id, name, category, default_unit) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Maïs grain', 'Céréales', 'kg'),
  ('00000000-0000-4000-8000-000000000002', 'Tomate', 'Légumes', 'panier'),
  ('00000000-0000-4000-8000-000000000003', 'Gari', 'Produits transformés', 'bol')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.price_records (product_id, price, currency, unit, location, record_date, source) VALUES
  ('00000000-0000-4000-8000-000000000001', 350, 'FCFA', 'kg', 'Lomé, Adawlato', '2026-11-20', 'Donnée de test locale'),
  ('00000000-0000-4000-8000-000000000001', 300, 'FCFA', 'kg', 'Kara', '2026-11-18', 'Donnée de test locale'),
  ('00000000-0000-4000-8000-000000000002', 12000, 'FCFA', 'panier', 'Lomé, Hédzranawoé', '2026-11-21', 'Donnée de test locale'),
  ('00000000-0000-4000-8000-000000000003', 400, 'FCFA', 'bol', 'Tsévié', '2026-11-19', 'Donnée de test locale');
