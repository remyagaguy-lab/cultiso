# Procédure : appliquer R1 et R4 (itinéraires calendaires, profil pluriannuel) sur la base en ligne

Préparée le 27/11/2026. **Rien de ce qui suit n'a été exécuté en ligne.** Chaque étape qui touche la base en ligne attend le feu vert explicite de Remyaga (règle 02 du dépôt). Projet : `redtuedpnhbqziqmyyjc`.

| Fichier | Rôle |
|---|---|
| `20261127_ref_calendrier.sql` | Schéma (`ref.fiche_technique`, `ref.itineraire_mensuel`, `ref.profils_speculation`, `ref.profil_pluriannuel`, règles de sécurité) et données de départ : 25 valeurs de la fiche technique de l'oignon (DOC-00015), la pondeuse en profil `cheptel` (DOC-00136) et l'oignon en `annuelle`, tout en `brouillon_ia`. Une transaction. **Refuse de se rejouer** (garde « déjà appliqué »). Assemblé depuis les migrations locales `20261127200000_ref_itineraires_calendaires.sql` et `20261127210000_ref_profil_pluriannuel.sql`. |
| `20261127_ref_calendrier_retour_arriere.sql` | Supprime les quatre tables (retour arrière). |

La base en ligne n'a pas d'historique de migrations : ne jamais lancer `supabase db push`.

Vérifié sur la base locale le 27/11/2026 : retour arrière, application, refus du rejeu, puis `src/referentiel/__tests__/calendrier-base-locale.test.ts` (5 tests, dont le refus par la base d'une part supérieure à 1 et d'une fumure de couverture sans date).

## 0. Dépendances

Le référentiel Cultiplan doit être en ligne : schéma `ref`, `ref.speculations` avec `oignon` et `poule_pondeuse`, `public.update_modified_column()` (la garde du fichier le vérifie).

**Le code est tolérant** : tant que ces tables n'existent pas en ligne, la génération d'un plan le dit dans `generation.calendrier.notes` et garde l'ancien calendrier (`mois`). On peut donc déployer le code avant la base, ou l'inverse.

## 1. Vérifier l'état en ligne (lecture seule)

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select to_regclass('ref.fiche_technique') as fiche, to_regclass('ref.profils_speculation') as profils, (select count(*) from ref.speculations where code in ('oignon','poule_pondeuse')) as speculations"
```

Attendu : `fiche` et `profils` nuls, `speculations` égal à 2.

## 2. Sauvegarder

Rien avant la première application (tables nouvelles). Avant un retour arrière, exporter ce qu'un expert aurait relu :

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select * from ref.fiche_technique" -o json > sauvegarde-fiche-technique.json
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select * from ref.itineraire_mensuel" -o json > sauvegarde-itineraire-mensuel.json
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select * from ref.profils_speculation" -o json > sauvegarde-profils-speculation.json
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select * from ref.profil_pluriannuel" -o json > sauvegarde-profil-pluriannuel.json
```

(à ranger hors du dépôt).

## 3. Appliquer

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_calendrier.sql
```

## 4. Exposer le schéma et recharger l'API

Le schéma `ref` doit être exposé (voir `PROCEDURE-REGLES-FINANCEURS.md`, étape 4), puis :

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "notify pgrst, 'reload schema'"
```

## 5. Vérifier après application

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select code, count(*) from ref.fiche_technique group by 1 order by 1"
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select speculation_code, variante, type_profil, mois_improductifs from ref.profils_speculation"
```

Attendu : 8 codes de fiche pour `oignon` (densité 1, délai de repiquage 1, délai de récolte 1, conservation 1, eau_apport 9, eau_total 3, fumure de fond 3, fumure de couverture 6), et deux profils (`poule_pondeuse` en `cheptel` avec 6 mois, `oignon` en `annuelle`).

## 6. Plans calculés par l'ancien moteur (1.x)

Le moteur 2.0.0 change le sens de plusieurs sorties (voir `src/moteurs/CONTRAT.md`). Après le déploiement du code, les plans enregistrés avec une version 1.x portent `moteurObsolete` à vrai : les brouillons se recalculent avec `recalculerPlansObsoletes(client)` (service Cultiplan, un client par utilisateur car les droits s'appliquent) ; les plans **lancés ou archivés restent figés** et sont seulement marqués : dupliquer le plan pour obtenir une variante recalculée. Rien n'est recalculé automatiquement.

## 7. Après l'application

Toutes les valeurs sont des brouillons. À faire relire par un agroéconomiste togolais (ITRA, ICAT) : la fiche de l'oignon est **sénégalaise** (zone des Niayes et vallée du fleuve), et son délai de récolte (135 à 155 jours après le semis) dépasse les 120 jours de `ref.speculations`. À saisir : les parts de coûts, d'heures et de récolte par mois de cycle (`ref.itineraire_mensuel`, vide) et les coefficients de rendement par année (`ref.profil_pluriannuel`, vide) : le lot n'en donne aucun.
