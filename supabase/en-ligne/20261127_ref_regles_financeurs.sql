-- Application EN LIGNE de R11 : règles des financeurs (ref.regles_financeurs), projet redtuedpnhbqziqmyyjc.
-- GÉNÉRÉ par scripts/generer-sql-financeurs.mjs le 2026-11-27 à partir de la migration locale 20261127120000 et de supabase/donnees/referentiel-depart.json.
-- NE PAS EXÉCUTER sans le feu vert explicite de Remyaga. Lire d'abord supabase/en-ligne/PROCEDURE-REGLES-FINANCEURS.md.
-- NE PAS utiliser `supabase db push` (la base en ligne n'a pas d'historique de migrations).
-- Exécution : npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_regles_financeurs.sql
-- Une seule transaction : en cas d'erreur, rien n'est appliqué. Rejouable : les règles déjà relues (statut autre que brouillon_ia) ne sont jamais écrasées.
-- Prérequis : le schéma ref et la fonction public.update_modified_column() existent en ligne (voir la procédure, étape 1).

BEGIN;

-- Chantier Cultiplan, R11 : règles des financeurs (schéma ref).
-- Testée sur la base locale seulement. À appliquer en ligne UNIQUEMENT avec le feu vert de Remyaga.
--
-- Une ligne = les règles d'un produit de financement d'un organisme (ANPGF, banque, IMF, crédit de campagne...).
-- Zéro valeur codée en dur dans le code : l'apport minimum, la durée, le différé, le taux, les taxes,
-- les pièces et le format du dossier sont des données. Une colonne vide veut dire « règle inconnue », pas « aucune règle ».
-- Même cycle de vie que le reste du référentiel : brouillon_ia, a_valider, validee, avec une source.
-- Lecture : tout utilisateur connecté ; visiteurs : règles validées seulement. Écriture : serveur seulement.

CREATE TABLE IF NOT EXISTS ref.regles_financeurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisme TEXT NOT NULL CHECK (length(organisme) BETWEEN 2 AND 80),
  produit TEXT NOT NULL CHECK (produit ~ '^[a-z0-9_]+$'),
  libelle TEXT NOT NULL CHECK (length(libelle) BETWEEN 2 AND 160),
  pays TEXT CHECK (pays IS NULL OR pays ~ '^[A-Z]{2}$'),
  -- Part minimale de l'apport dans le coût du projet (0,2 = 20 %).
  apport_minimum NUMERIC CHECK (apport_minimum >= 0 AND apport_minimum <= 1),
  -- Durée maximale du financement, en mois. Comprend le différé si duree_inclut_differe vaut vrai (lecture prudente).
  duree_max_mois INTEGER CHECK (duree_max_mois > 0),
  duree_inclut_differe BOOLEAN NOT NULL DEFAULT true,
  differe_max_mois INTEGER CHECK (differe_max_mois >= 0),
  -- Taux annuel indicatif (0,24 = 24 %). Indicatif : le taux réel est fixé par le financeur.
  taux_indicatif NUMERIC CHECK (taux_indicatif >= 0 AND taux_indicatif <= 1),
  -- Tableau de { "nom": "...", "description": "..." }.
  taxes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(taxes) = 'array'),
  pieces_exigees TEXT[] NOT NULL DEFAULT '{}',
  format_dossier TEXT,
  notes TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon_ia' CHECK (statut IN ('brouillon_ia', 'a_valider', 'validee')),
  source TEXT,
  valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisme, produit),
  CHECK (differe_max_mois IS NULL OR duree_max_mois IS NULL OR differe_max_mois <= duree_max_mois),
  CHECK (statut <> 'validee' OR (source IS NOT NULL AND valide_le IS NOT NULL))
);

DROP TRIGGER IF EXISTS update_regles_financeurs_modtime ON ref.regles_financeurs;
CREATE TRIGGER update_regles_financeurs_modtime BEFORE UPDATE ON ref.regles_financeurs
  FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();

ALTER TABLE ref.regles_financeurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture par les utilisateurs connectés" ON ref.regles_financeurs;
CREATE POLICY "Lecture par les utilisateurs connectés" ON ref.regles_financeurs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Lecture des données validées par les visiteurs" ON ref.regles_financeurs;
CREATE POLICY "Lecture des données validées par les visiteurs" ON ref.regles_financeurs FOR SELECT TO anon USING (statut = 'validee');
GRANT SELECT ON ref.regles_financeurs TO anon, authenticated;
GRANT ALL ON ref.regles_financeurs TO service_role;

-- Règles de départ, toutes en brouillon_ia avec leur source.
INSERT INTO ref.regles_financeurs (id, organisme, produit, libelle, pays, apport_minimum, duree_max_mois, duree_inclut_differe, differe_max_mois, taux_indicatif, taxes, pieces_exigees, format_dossier, notes, statut, source)
VALUES
('6e509b6d-fd6c-54cd-8b54-a73877950c6c', 'ANPGF', 'projet_demarrage', 'Financement d''un projet en démarrage (canevas de plan d''affaires, mai 2022)', 'TG', 0.2, 48, true, 12, NULL, '[{"nom":"Taxe sur l''échéance","description":"Le tableau d''amortissement du canevas porte une colonne « Taxe » à côté des intérêts. Nature et taux non précisés : à confirmer auprès de l''ANPGF."}]'::jsonb, ARRAY['Plan d''affaires rédigé selon le canevas ANPGF (annexes 1 à 3 : coût et financement, amortissement, états financiers prévisionnels)', 'Sûretés proposées pour garantir le remboursement (section 9 du canevas)']::text[], 'Canevas ANPGF de mai 2022 : dossier physique (Lomé, Tsévié, Kara) ou plan d''affaires envoyé par courriel ; états au format SYSCOHADA.', 'Apport du promoteur en nature ou en numéraire (§10.1). Remboursement en quatre ans, différé d''au plus un an (§10.3) : le canevas ne dit pas si les quatre ans comptent le différé, on prend la lecture prudente (différé compris). Aucun taux indicatif dans le canevas. La liste des pièces est celle que le canevas impose ; les pièces administratives (identité, statut, justificatifs fonciers) sont à demander à l''ANPGF.', 'brouillon_ia', 'Canevas de plan d''affaires ANPGF (Togo, mai 2022) §10.1, §10.3, §9 et informations utiles. Brouillon IA : à faire valider par l''ANPGF ou un expert.'),
('7d11b41e-ca46-57b7-83bd-724f10aca9c1', 'BNA (Banque Nationale Agricole, Tunisie)', 'credit_campagne', 'Crédit de campagne agricole à court terme', 'TN', NULL, 12, true, NULL, NULL, '[]'::jsonb, ARRAY['Justificatif d''exploitation de la terre (propriété, location ou métayage)', 'Justificatif de l''expérience et des qualifications', 'Justificatif de capacité de remboursement', 'Être en situation régulière avec la banque']::text[], NULL, 'Crédit à court terme (moins d''un an), renouvelable chaque année, pour couvrir une partie des dépenses (céréales, arbres fruitiers, maraîchage, engraissement, aliments du bétail, élevage avicole, exploitations à plusieurs activités). Le montant et l''échéance sont fixés par spéculation dans un barème de crédits de campagne que le guide ne reproduit pas : on ne les connaît donc pas. Durée maximale : « inférieur à une année », saisie à 12 mois par prudence. Règle d''un pays voisin du Togo seulement par le type de produit : sert de modèle de lecture, pas de règle applicable à un porteur togolais.', 'brouillon_ia', 'Guide de l''entrepreneuriat agricole et agroalimentaire (Tunisie, APIA, DOC-00010) p. 95-96. Brouillon IA : à faire valider par un expert.'),
('e5c9e16f-db3f-5755-b191-64bca32da70e', 'BNA (Banque Nationale Agricole, Tunisie)', 'investissement_equipements', 'Crédit d''investissement pour équipements agricoles et hydrauliques', 'TN', NULL, 84, true, 12, NULL, '[]'::jsonb, ARRAY['Exploitant d''une terre en propriété ou en location de longue durée (au moins la durée du crédit)', 'Justificatif de l''expérience et des qualifications', 'Justificatif de capacité de remboursement', 'Garanties demandées par la banque', 'Autofinancement exigé', 'Dossier instruit par les services techniques régionaux (CRDA)']::text[], NULL, 'Remboursement de 3 à 7 ans avec une période de grâce d''un an. Apport : le guide donne un schéma par catégorie d''opération (catégorie A : autofinancement 10 %, prime d''investissement 50 %, prêt 40 % ; catégorie B : 30 %, 30 %, 20 %, ces trois parts de la catégorie B ne font que 80 % dans le document, anomalie à vérifier à la source). L''apport minimum est laissé vide car il dépend de la catégorie et d''une prime publique qui n''existe pas dans notre modèle. Le guide ne dit pas si la période de grâce compte dans les 7 ans : lecture prudente (comprise).', 'brouillon_ia', 'Guide de l''entrepreneuriat agricole et agroalimentaire (Tunisie, APIA, DOC-00010) p. 97-98. Brouillon IA : à faire valider par un expert.'),
('a7f2bf9d-66c7-56db-91a9-885aa1e192dd', 'BNA (Banque Nationale Agricole, Tunisie)', 'chaine_de_valeur', 'Financement des chaînes de valeur : crédit tripartite et crédit interface', 'TN', NULL, NULL, true, NULL, NULL, '[]'::jsonb, ARRAY['Convention ou contrat d''approvisionnement et de financement entre la banque, l''acheteur agro-industriel et les agriculteurs (crédit tripartite)', 'Engagement de vendre toute la production à l''acheteur']::text[], NULL, 'Deux formes. Crédit tripartite : la banque finance le cycle de production ou d''investissement de petits agriculteurs, avec la caution de l''acheteur ; le déblocage se fait au profit de l''acheteur, qui fournit les intrants, achète toute la production et rembourse la banque par retenue sur ce qu''il leur paie. Crédit interface : la banque finance l''acheteur pour couvrir les besoins d''exploitation des petits agriculteurs. Aucune durée, aucun taux, aucun apport chiffrés dans le guide : tout reste vide. Le même mécanisme (la banque préfinance, l''acheteur rembourse sur le paiement) est décrit dans le manuel d''agriculture contractuelle DOC-00163 (p. 50-55, 76), analysé dans ANALYSE-BASE-RESSOURCES §2.3.4 (document scanné, non relu ligne à ligne pour cette entrée).', 'brouillon_ia', 'Guide de l''entrepreneuriat agricole et agroalimentaire (Tunisie, APIA, DOC-00010) p. 99. Brouillon IA : à faire valider par un expert.'),
('74910dfb-8a1b-5475-b15b-e47538f9d9ab', 'BTS (Banque Tunisienne de Solidarité)', 'agri_invest', 'Crédit Agri-Invest (investissement des jeunes promoteurs)', 'TN', NULL, 84, true, 12, NULL, '[{"nom":"Contribution de garantie","description":"1 % au profit du Fonds National de Garantie (FNG). Assiette non précisée dans le guide : à confirmer."},{"nom":"Commission d''étude","description":"2 %. Assiette non précisée dans le guide : à confirmer."}]'::jsonb, ARRAY['Nationalité tunisienne, âge de 18 à 59 ans', 'Qualification professionnelle justifiée (diplôme, formation ou autre justificatif)', 'Engagement à gérer le projet personnellement et à plein temps', 'Forme d''entreprise individuelle ou société unipersonnelle (SUARL)', 'Dossier complet déposé au CRDA (projets de catégorie A), à l''APIA (catégorie B) ou directement à la BTS']::text[], NULL, 'Coût total du projet, fonds de roulement compris, au plus 150 000 dinars pour un diplômé de l''enseignement supérieur et 100 000 dinars sinon (plafond en monnaie tunisienne, non repris dans une colonne). Remboursement jusqu''à 7 ans, grâce de 3 à 12 mois selon l''activité. Taux d''intérêt annuel « préférentiel » non chiffré pour ce produit : laissé vide (le guide cite par ailleurs un taux de 5 % au plus pour les crédits de la BTS en général, p. 99, ce n''est pas un taux indicatif). Étude technique gratuite par les services régionaux. Assurance du cheptel exigée (25 %) et prise en charge par le crédit. Le produit Agri-saison est annoncé dans le même tableau mais son contenu n''est pas lu : non saisi.', 'brouillon_ia', 'Guide de l''entrepreneuriat agricole et agroalimentaire (Tunisie, APIA, DOC-00010) p. 99-100. Brouillon IA : à faire valider par un expert.')
ON CONFLICT (organisme, produit) DO UPDATE SET
  libelle = EXCLUDED.libelle,
  pays = EXCLUDED.pays,
  apport_minimum = EXCLUDED.apport_minimum,
  duree_max_mois = EXCLUDED.duree_max_mois,
  duree_inclut_differe = EXCLUDED.duree_inclut_differe,
  differe_max_mois = EXCLUDED.differe_max_mois,
  taux_indicatif = EXCLUDED.taux_indicatif,
  taxes = EXCLUDED.taxes,
  pieces_exigees = EXCLUDED.pieces_exigees,
  format_dossier = EXCLUDED.format_dossier,
  notes = EXCLUDED.notes,
  source = EXCLUDED.source
WHERE ref.regles_financeurs.statut = 'brouillon_ia';

COMMIT;
