# Procédure : appliquer M14 (courbes par âge des ateliers animaux) sur la base en ligne

Préparée le 27/11/2026. **Rien de ce qui suit n'a été exécuté en ligne.** Chaque étape qui touche la base en ligne attend le feu vert explicite de Remyaga (règle 02 du dépôt). Projet : `redtuedpnhbqziqmyyjc`.

| Fichier | Rôle |
|---|---|
| `20261127_ref_courbes_age.sql` | Schéma (`ref.courbes_age`, `ref.parametres_elevage`, règles de sécurité) et données de départ : 58 courbes et paramètres de la poule pondeuse (DOC-00686, DOC-00136) et du poulet de chair (DOC-00136), tous `brouillon_ia`. Une transaction. **Refuse de se rejouer** (garde « déjà appliqué »). Assemblé depuis la migration locale `20261127180000_ref_courbes_age.sql`. |
| `20261127_ref_courbes_age_retour_arriere.sql` | Supprime les deux tables (retour arrière). |

La base en ligne n'a pas d'historique de migrations : ne jamais lancer `supabase db push`.

Vérifié sur la base locale le 27/11/2026 : le fichier s'applique (19 + 19 + 19 + 1 courbes, 9 paramètres), la garde refuse le rejeu, le retour arrière s'exécute sans erreur. Le test d'intégration `src/referentiel/__tests__/elevage-base-locale.test.ts` lit les données et les droits (visiteur : rien tant que rien n'est validé).

## 0. Dépendances

Le référentiel Cultiplan doit être en ligne : schéma `ref`, `ref.speculations` avec `poule_pondeuse` et `poulet_chair`, `public.update_modified_column()` (la garde du fichier le vérifie). Si ce n'est pas le cas, appliquer d'abord les fichiers du référentiel (voir `PROCEDURE-PROFIL-ENTRETIEN.md`, étape 0).

## 1. Vérifier l'état en ligne (lecture seule)

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select to_regclass('ref.courbes_age') as courbes, to_regclass('ref.parametres_elevage') as parametres, (select count(*) from ref.speculations where code in ('poule_pondeuse','poulet_chair')) as speculations"
```

Attendu : `courbes` et `parametres` nuls, `speculations` égal à 2. Si les tables existent déjà, ne rien appliquer et regarder leur contenu.

## 2. Sauvegarder

Rien avant la première application (tables nouvelles). Avant un retour arrière, exporter ce qu'un expert aurait relu :

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select * from ref.courbes_age" -o json > sauvegarde-courbes-age.json
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select * from ref.parametres_elevage" -o json > sauvegarde-parametres-elevage.json
```

(à ranger hors du dépôt).

## 3. Appliquer

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_courbes_age.sql
```

## 4. Exposer le schéma et recharger l'API

Le schéma `ref` doit être exposé (voir `PROCEDURE-REGLES-FINANCEURS.md`, étape 4), puis :

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "notify pgrst, 'reload schema'"
```

## 5. Vérifier après application

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select speculation_code, variante, grandeur, count(*) from ref.courbes_age group by 1,2,3 order by 1,2,3"
```

Attendu : `poule_pondeuse / burkina_doc00686` avec 19 lignes pour `consommation`, `mortalite`, `production`, et `poulet_chair / mali_doc00136 / poids` avec 1 ligne. Puis appeler `POST /api/cultiplan/elevage/bandes` avec `speculation: "poule pondeuse"`.

## 6. Après l'application

Toutes les valeurs sont des brouillons : l'atelier animal affiche « données non validées par un expert ». À faire relire par un expert togolais (ITRA, ICAT, vétérinaire avicole) : les courbes burkinabè du DOC-00686 sont d'un modèle non daté, les durées du DOC-00136 d'un document malien de 2014 qui contient des erreurs de montants.
