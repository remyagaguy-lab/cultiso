# Procédure : appliquer R11 (règles des financeurs) sur la base en ligne

Préparée le 27/11/2026. **Rien de ce qui suit n'a été exécuté en ligne.** Chaque étape qui touche la base en ligne attend le feu vert explicite de Remyaga (règle 02 du dépôt). Projet : `redtuedpnhbqziqmyyjc`.

Fichiers prêts (générés par `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generer-sql-financeurs.mjs`, à relancer si `referentiel-depart.json` change) :

| Fichier | Rôle |
|---|---|
| `20261127_ref_regles_financeurs.sql` | Table `ref.regles_financeurs`, ses règles de sécurité et les 5 règles de départ (toutes `brouillon_ia`). Une seule transaction. Rejouable : testé deux fois de suite sur la base locale. Une règle déjà relue (statut autre que `brouillon_ia`) n'est jamais écrasée. |
| `20261127_ref_regles_financeurs_retour_arriere.sql` | Supprime la table (retour arrière). |

La base en ligne n'a pas d'historique de migrations : ne jamais lancer `supabase db push`.

## 0. Ce qui doit exister avant (dépendances)

Le script suppose que le schéma `ref` et la fonction `public.update_modified_column()` existent en ligne. Le schéma `ref` vient de la migration `20261126140000_cultiplan_referentiel.sql`. **Si le référentiel Cultiplan n'est pas encore en ligne, R11 ne peut pas y aller seul** : il faut d'abord appliquer, dans l'ordre, les migrations locales 20261126130000 (socle), 20261126140000 (référentiel), 20261127100000 (plans), puis les suivantes déjà écrites localement (profil du porteur, entretien de cadrage, bornes de rendement, eau, champs des contrôles). Même méthode que `20261126_application_cultisia.sql` : un fichier assemblé par migration, en une transaction, jamais `db push`.

## 1. Vérifier l'état en ligne (lecture seule)

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select to_regclass('ref.speculations') as referentiel, to_regclass('ref.regles_financeurs') as regles, exists(select 1 from pg_proc where proname = 'update_modified_column') as fonction"
```

Attendu avant l'application : `referentiel` non nul, `regles` nul, `fonction` vrai. Si `regles` n'est pas nul, la table existe déjà : ne rien appliquer et regarder son contenu d'abord.

## 2. Sauvegarder

La table est nouvelle : il n'y a rien à sauvegarder avant. Pour les rejeux ultérieurs, exporter d'abord les règles relues :

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select * from ref.regles_financeurs" -o json > sauvegarde-regles-financeurs.json
```

(à ne pas committer : à ranger hors du dépôt).

## 3. Appliquer

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_regles_financeurs.sql
```

En cas d'erreur, rien n'est appliqué (transaction).

## 4. Exposer le schéma `ref` à l'API

Dans le tableau de bord Supabase du projet : **Project Settings > Data API (API Settings) > Exposed schemas**, ajouter `ref` à `public` et `graphql_public`, enregistrer. Sans cela, l'application reçoit « schéma introuvable » (le local l'a déjà : `supabase/config.toml`, `schemas`). Les droits `GRANT USAGE ON SCHEMA ref` sont dans la migration du référentiel. Ensuite, recharger le cache de l'API :

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "notify pgrst, 'reload schema'"
```

## 5. Vérifier

1. Lecture serveur : `select organisme, produit, statut from ref.regles_financeurs order by 1, 2` doit donner 5 lignes, toutes `brouillon_ia`.
2. Visiteur anonyme : `GET <URL du projet>/rest/v1/regles_financeurs` avec les en-têtes `apikey` (clé publique), `Accept-Profile: ref` doit répondre `[]` (aucune règle n'est validée, donc aucune n'est visible).
3. Utilisateur connecté : la route `/api/cultiplan/financeurs` doit lister les 5 règles ; l'écran d'un plan doit proposer le choix du financeur.
4. Écriture refusée : un utilisateur connecté qui tente un `insert` reçoit une erreur (aucune politique d'écriture).

## 6. Retour arrière

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_regles_financeurs_retour_arriere.sql
```

Les plans déjà calculés gardent la règle copiée dans `plans.financement` : ils ne sont pas touchés. Si des règles ont été validées par un expert entre-temps, elles sont perdues : refaire la sauvegarde de l'étape 2 juste avant.

## 7. Après l'application

- Les données du reste du référentiel (spéculations, modèles, questions, règles d'ajustement, bornes de rendement) ne sont pas dans ce script : `npm run referentiel:importer` n'écrit qu'en local (il refuse toute autre adresse, exprès). Un script jumeau de `generer-sql-financeurs.mjs` est à écrire pour elles, avec le même feu vert.
- Faire valider les règles par un expert (note `Cultiso/2_Pilotage/03_Produit-et-technologie/NOTE-VALIDATION-REGLES-FINANCEURS.md`). Une règle passe en `validee` seulement avec `source` et `valide_le` (la base l'impose).
- Mettre à jour `ANALYSE-BASE-RESSOURCES.md` §4 : « R11 appliquée en ligne le … ».
