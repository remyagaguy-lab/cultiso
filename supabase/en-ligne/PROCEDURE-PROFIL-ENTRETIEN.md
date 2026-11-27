# Procédure : appliquer R9 (profil du porteur) et S3 (entretien de cadrage) sur la base en ligne

Préparée le 27/11/2026. **Rien de ce qui suit n'a été exécuté en ligne.** Chaque étape qui touche la base en ligne attend le feu vert explicite de Remyaga (règle 02 du dépôt). Projet : `redtuedpnhbqziqmyyjc`.

Fichiers prêts (générés par `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generer-sql-profil-entretien.mjs`, à relancer si une migration ou `entretien-cadrage.json` change) :

| Fichier | Rôle |
|---|---|
| `20261127_profil_porteur.sql` | Schéma R9 : tables `public.profil_porteur`, `profil_existant`, `profil_credits` (migrations locales 140000 et 165000, débit de l'eau compris), règles de sécurité. Une transaction. **Refuse de se rejouer** (garde « déjà appliqué »). |
| `20261127_ref_entretien_cadrage.sql` | Schéma S3 : tables `ref.entretien_temps`, `entretien_dimensions`, `entretien_questions` (migration locale 150000). Une transaction, même garde. |
| `20261127_ref_entretien_donnees.sql` | Données : les 16 questions de terrain, les 6 temps, les 7 dimensions et les 53 questions de l'entretien, toutes `brouillon_ia`. **Rejouable** : upsert, une ligne déjà relue (statut autre que `brouillon_ia`) n'est jamais écrasée. |
| `20261127_profil_entretien_retour_arriere.sql` | Supprime les six tables (retour arrière). Ne touche pas `ref.questions_terrain`. |

La base en ligne n'a pas d'historique de migrations : ne jamais lancer `supabase db push`.

Vérifié sur la base locale le 27/11/2026 (aucune écriture durable) : le fichier de données passe en une transaction annulée (16 + 6 + 7 + 53 lignes) ; les deux fichiers de schéma s'arrêtent sur leur garde puisque les tables existent déjà en local, et leur texte est celui des migrations locales appliquées ; le retour arrière s'exécute sans erreur. Le schéma n'a donc pas été rejoué de zéro dans une base vide : il se vérifie en ligne par l'étape 5.

## 0. Ce qui doit exister avant (dépendances)

- R9 a besoin du socle Cultiplan : `public.cultisos`, `public.mes_exploitations()`, `public.peut_modifier()`, `public.update_modified_column()` (migration locale `20261126130000_cultiplan_socle.sql`).
- S3 a besoin du référentiel Cultiplan : schéma `ref`, table `ref.questions_terrain` (migration locale `20261126140000_cultiplan_referentiel.sql`).
- **Si ces deux migrations ne sont pas en ligne, R9 et S3 ne peuvent pas y aller seuls** : il faut d'abord appliquer, dans l'ordre, 20261126130000 (socle), 20261126140000 (référentiel), 20261127100000 (plans), puis les suivantes (bornes de rendement, champs des contrôles), chacune assemblée en un fichier d'une transaction, comme `20261126_application_cultisia.sql` et comme R11 (`PROCEDURE-REGLES-FINANCEURS.md`, étape 0). Ce point décide du chantier : le vérifier d'abord (étape 1).
- Le code qui lit le profil et l'entretien est déjà tolérant : sans les tables, la génération du plan et les outils de calcul continuent à marcher sans profil (lecture « tolérante »), et l'écran de consultation affiche une erreur lisible.

## 1. Vérifier l'état en ligne (lecture seule)

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select to_regclass('public.cultisos') as exploitations, to_regclass('public.peut_modifier') as droit, to_regclass('ref.questions_terrain') as questions, to_regclass('public.profil_porteur') as profil, to_regclass('ref.entretien_questions') as entretien, exists(select 1 from pg_proc where proname = 'update_modified_column') as fonction"
```

Attendu avant l'application : `exploitations`, `questions` non nuls, `fonction` vrai, `profil` et `entretien` nuls. Si `profil` ou `entretien` n'est pas nul, les tables existent déjà : ne rien appliquer et regarder leur contenu d'abord. Si `exploitations` ou `questions` est nul, voir l'étape 0.

## 2. Sauvegarder

Les tables sont nouvelles : il n'y a rien à sauvegarder avant la première application. Pour les rejeux de données ou avant un retour arrière, exporter ce qui a été relu ou saisi :

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select * from ref.entretien_questions" -o json > sauvegarde-entretien-questions.json
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select * from public.profil_porteur" -o json > sauvegarde-profil-porteur.json
```

(à ne pas committer : à ranger hors du dépôt ; le profil contient des données personnelles de porteurs).

## 3. Appliquer, dans cet ordre

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_profil_porteur.sql
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_entretien_cadrage.sql
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_entretien_donnees.sql
```

Chaque fichier est une transaction : en cas d'erreur, rien de ce fichier n'est appliqué. S'arrêter à la première erreur et ne pas enchaîner.

## 4. Exposer le schéma `ref` à l'API (seulement s'il ne l'est pas déjà)

Voir l'étape 4 de `PROCEDURE-REGLES-FINANCEURS.md` (Project Settings > Data API > Exposed schemas : `ref`). Puis recharger le cache de l'API :

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "notify pgrst, 'reload schema'"
```

## 5. Vérifier

1. Comptes : `select count(*) from ref.entretien_questions` donne 53 ; `ref.entretien_temps` 6 ; `ref.entretien_dimensions` 7 ; `ref.questions_terrain` au moins 16. Tout est `brouillon_ia`.
2. Droits : `select tablename, policyname from pg_policies where tablename in ('profil_porteur','profil_existant','profil_credits')` donne quatre politiques par table (lecture, ajout, modification, suppression).
3. Visiteur anonyme : `GET <URL du projet>/rest/v1/entretien_questions` avec les en-têtes `apikey` (clé publique), `Accept-Profile: ref` répond `[]` (rien n'est validé). `GET .../rest/v1/profil_porteur` sans jeton répond `[]` (RLS).
4. Utilisateur connecté : la route `GET /api/cultiplan/exploitations/:id/entretien` renvoie une question ; la page `/cultiplan/projets/:id/consultation` affiche le parcours ; une réponse enregistrée apparaît dans « Mes réponses ».
5. Étanchéité : un second utilisateur ne voit ni le profil ni les réponses du premier (RLS par exploitation).
6. Écriture refusée : un utilisateur connecté qui tente un `insert` dans `ref.entretien_questions` reçoit une erreur (aucune politique d'écriture).

## 6. Retour arrière

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_profil_entretien_retour_arriere.sql
```

Les réponses des porteurs (profil, existant, crédits) et les lignes relues par un expert sont perdues : refaire la sauvegarde de l'étape 2 juste avant. Les plans déjà calculés gardent l'apport et les hypothèses copiés dans `plans.financement` et `plans.hypotheses` : ils ne sont pas touchés.

## 7. Après l'application

- Faire relire par un agroéconomiste les questions, les seuils de prudence (moins de 5 heures par semaine, moins de 3 ans de droit sur la terre) et les phrases des feux. Une ligne passe en `validee` seulement avec `source` et `valide_le` (la base l'impose pour les tables qui ont ces colonnes).
- Les autres données du référentiel (spéculations, modèles, règles d'ajustement, bornes de rendement) ne sont pas dans ces scripts : `npm run referentiel:importer` n'écrit qu'en local (il refuse toute autre adresse, exprès).
- Mettre à jour `ANALYSE-BASE-RESSOURCES.md` §4 : « R9 et S3 appliquées en ligne le … ».
