-- Application EN LIGNE de R9 : profil du porteur et de son existant (public.profil_porteur, profil_existant, profil_credits), projet redtuedpnhbqziqmyyjc.
-- GÉNÉRÉ par scripts/generer-sql-profil-entretien.mjs le 2026-11-27 à partir des migrations locales et des fichiers de données.
-- NE PAS EXÉCUTER sans le feu vert explicite de Remyaga. Lire d'abord supabase/en-ligne/PROCEDURE-PROFIL-ENTRETIEN.md.
-- NE PAS utiliser `supabase db push` (la base en ligne n'a pas d'historique de migrations).
-- Exécution : npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_profil_porteur.sql
-- Une seule transaction : en cas d'erreur, rien n'est appliqué.
-- Prérequis : public.cultisos, public.mes_exploitations(), public.peut_modifier() et public.update_modified_column() existent en ligne (migration locale 20261126130000, socle Cultiplan).

BEGIN;

DO $garde$
BEGIN
  IF to_regclass('public.profil_porteur') IS NOT NULL THEN
    RAISE EXCEPTION 'Schéma déjà appliqué (public.profil_porteur existe) : ne rien faire. Voir la procédure, étape 1.';
  END IF;
END
$garde$;

-- Cultiplan R9 : profil du porteur et de son existant (terre, eau, argent, temps, main d'oeuvre, savoir-faire, ménage, finalité, avancement).
-- Testée sur la base locale. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
-- Règle de lecture : une colonne NULL veut dire « pas encore répondu » OU « je ne sais pas » ; la liste `inconnus`
-- distingue le second cas (le porteur a répondu « je ne sais pas »). Rien n'est jamais inventé pour combler un trou.

-- 1. Profil : une ligne par exploitation (un seul porteur par projet en V1).
CREATE TABLE public.profil_porteur (
  cultiso_id UUID PRIMARY KEY REFERENCES public.cultisos(id) ON DELETE CASCADE,

  -- Terre
  terre_surface_ha NUMERIC CHECK (terre_surface_ha >= 0),
  terre_statut TEXT CHECK (terre_statut IN ('propriete', 'heritage_familial', 'location', 'metayage', 'pret', 'concession_communautaire', 'aucun')),
  terre_piece TEXT CHECK (terre_piece IN ('titre_foncier', 'attestation_villageoise', 'contrat_ecrit', 'accord_verbal', 'aucune')),
  terre_duree_annees NUMERIC CHECK (terre_duree_annees >= 0),
  terre_sol TEXT CHECK (terre_sol IN ('sableux', 'argileux', 'limoneux', 'gravillonnaire', 'bas_fond', 'autre')),
  terre_pente TEXT CHECK (terre_pente IN ('plat', 'faible', 'forte')),
  terre_jachere BOOLEAN,
  terre_extension_possible BOOLEAN,
  terre_extension_ha NUMERIC CHECK (terre_extension_ha >= 0),

  -- Eau
  eau_source TEXT CHECK (eau_source IN ('aucune', 'pluie', 'puits', 'forage', 'cours_eau', 'retenue', 'reseau')),
  eau_saison TEXT CHECK (eau_saison IN ('toute_annee', 'saison_pluies', 'irreguliere')),

  -- Argent (FCFA). Les crédits en cours sont dans public.profil_credits.
  epargne_fcfa NUMERIC CHECK (epargne_fcfa >= 0),
  apport_especes_fcfa NUMERIC CHECK (apport_especes_fcfa >= 0),
  apport_nature_fcfa NUMERIC CHECK (apport_nature_fcfa >= 0),

  -- Temps
  temps_engagement TEXT CHECK (temps_engagement IN ('plein', 'partiel')),
  temps_autre_activite TEXT CHECK (length(temps_autre_activite) <= 200),
  temps_heures_semaine NUMERIC CHECK (temps_heures_semaine >= 0 AND temps_heures_semaine <= 112),

  -- Main d'oeuvre familiale
  famille_actifs INTEGER CHECK (famille_actifs >= 0),
  famille_heures_semaine NUMERIC CHECK (famille_heures_semaine >= 0),

  -- Savoir-faire
  competence_technique TEXT CHECK (competence_technique IN ('aucune', 'debutant', 'moyen', 'solide')),
  competence_gestion TEXT CHECK (competence_gestion IN ('aucune', 'debutant', 'moyen', 'solide')),
  competence_vente TEXT CHECK (competence_vente IN ('aucune', 'debutant', 'moyen', 'solide')),

  -- Ménage
  menage_personnes INTEGER CHECK (menage_personnes >= 1),
  menage_bouches INTEGER CHECK (menage_bouches >= 1),
  menage_cout_vie_annuel_fcfa NUMERIC CHECK (menage_cout_vie_annuel_fcfa >= 0),
  menage_revenus_exterieurs_annuels_fcfa NUMERIC CHECK (menage_revenus_exterieurs_annuels_fcfa >= 0),

  -- Finalité : une ou plusieurs.
  finalites TEXT[] CHECK (finalites <@ ARRAY['revenu', 'qualite_de_vie', 'transmission', 'securite', 'interet_personnel']::text[]),

  -- Avancement
  avancement TEXT CHECK (avancement IN ('idee', 'reflexion', 'preparation', 'demarre', 'en_production')),

  -- L'existant et les crédits ont été déclarés « aucun » : sans ces drapeaux, une liste vide veut dire « pas encore demandé ».
  sans_existant BOOLEAN NOT NULL DEFAULT false,
  sans_credit BOOLEAN NOT NULL DEFAULT false,

  -- Champs où le porteur a répondu « je ne sais pas » (noms des colonnes, ou « existant », « credits »).
  inconnus TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (menage_bouches IS NULL OR menage_personnes IS NULL OR menage_bouches <= menage_personnes)
);
CREATE TRIGGER update_profil_porteur_modtime
  BEFORE UPDATE ON public.profil_porteur
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- 2. Existant : matériel, bâtiments, animaux et plants déjà possédés.
CREATE TABLE public.profil_existant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultiso_id UUID NOT NULL REFERENCES public.cultisos(id) ON DELETE CASCADE,
  categorie TEXT NOT NULL CHECK (categorie IN ('materiel', 'batiment', 'animaux', 'plants')),
  libelle TEXT NOT NULL CHECK (length(libelle) BETWEEN 2 AND 120),
  quantite NUMERIC CHECK (quantite > 0),
  etat TEXT CHECK (etat IN ('neuf', 'bon', 'moyen', 'mauvais')),
  annee INTEGER CHECK (annee BETWEEN 1950 AND 2100),
  -- Valeur estimée par le porteur : un apport en nature s'appuie dessus, jamais sur une valeur inventée.
  valeur_estimee_fcfa NUMERIC CHECK (valeur_estimee_fcfa >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profil_existant_cultiso_id ON public.profil_existant(cultiso_id);
CREATE TRIGGER update_profil_existant_modtime
  BEFORE UPDATE ON public.profil_existant
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- 3. Crédits en cours du porteur.
CREATE TABLE public.profil_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cultiso_id UUID NOT NULL REFERENCES public.cultisos(id) ON DELETE CASCADE,
  creancier TEXT CHECK (length(creancier) <= 120),
  capital_restant_fcfa NUMERIC CHECK (capital_restant_fcfa >= 0),
  mensualite_fcfa NUMERIC NOT NULL CHECK (mensualite_fcfa >= 0),
  mois_restants INTEGER CHECK (mois_restants >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profil_credits_cultiso_id ON public.profil_credits(cultiso_id);
CREATE TRIGGER update_profil_credits_modtime
  BEFORE UPDATE ON public.profil_credits
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

-- 4. RLS : lecture par les membres, écriture par propriétaire et collaborateurs (même modèle que les ateliers).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profil_porteur', 'profil_existant', 'profil_credits'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Les membres voient %1$s" ON public.%1$I FOR SELECT USING (cultiso_id IN (SELECT public.mes_exploitations()))', t);
    EXECUTE format('CREATE POLICY "Écriture %1$s : ajout" ON public.%1$I FOR INSERT WITH CHECK (public.peut_modifier(cultiso_id))', t);
    EXECUTE format('CREATE POLICY "Écriture %1$s : modification" ON public.%1$I FOR UPDATE USING (public.peut_modifier(cultiso_id)) WITH CHECK (public.peut_modifier(cultiso_id))', t);
    EXECUTE format('CREATE POLICY "Écriture %1$s : suppression" ON public.%1$I FOR DELETE USING (public.peut_modifier(cultiso_id))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Cultiplan R9, suite : débit de l'eau du porteur (facultatif, « je ne sais pas » possible via la liste `inconnus`).
-- Testée sur la base locale. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
-- Mètres cubes par jour que la source peut fournir en saison de besoin ; NULL = pas répondu ou « je ne sais pas ».
ALTER TABLE public.profil_porteur
  ADD COLUMN eau_debit_m3_jour NUMERIC CHECK (eau_debit_m3_jour >= 0);

COMMIT;
