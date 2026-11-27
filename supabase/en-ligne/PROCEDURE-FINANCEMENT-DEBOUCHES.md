# Procédure : appliquer M6 (barème de campagne) et R3 (circuits) sur la base en ligne

Préparée le 27/11/2026. **Rien de ce qui suit n'a été exécuté en ligne.** Chaque étape qui touche la base en ligne attend le feu vert explicite de Remyaga (règle 02). Projet : `redtuedpnhbqziqmyyjc`.

| Fichier | Rôle |
|---|---|
| `20261127_ref_financement_debouches.sql` | Crée `ref.baremes_credit_campagne` (vide : le lot ne donne aucun barème chiffré) et `ref.circuits_commercialisation` (six circuits de départ, `brouillon_ia`, sans valeur chiffrée), avec leurs règles de sécurité. Une transaction. Assemblé à partir des migrations locales `20261127190000` et `20261127191000`. |
| `20261127_ref_financement_debouches_retour_arriere.sql` | Supprime les deux tables. |

La base en ligne n'a pas d'historique de migrations : ne jamais lancer `supabase db push`.

## 0. Dépendances

Le script suppose le schéma `ref`, la table `ref.speculations` et la fonction `public.update_modified_column()` en ligne (migration locale `20261126140000_cultiplan_referentiel.sql`). **Si le référentiel Cultiplan n'est pas encore en ligne, M6 et R3 ne peuvent pas y aller seuls** (même remarque que pour R11 et R10 : voir `PROCEDURE-REGLES-FINANCEURS.md`). Sans ces tables en ligne, les routes `/financement` (avec `baremeDe`), `/debouches`, `/circuits` et `/export` avec `debouches` répondent « référentiel indisponible » ; le moteur de financement, la main d'oeuvre et l'export sans débouchés n'en ont pas besoin.

## 1. Vérifier l'état en ligne (lecture seule)

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select to_regclass('ref.speculations') as speculations, to_regclass('ref.baremes_credit_campagne') as baremes, to_regclass('ref.circuits_commercialisation') as circuits, exists(select 1 from pg_proc where proname = 'update_modified_column') as fonction"
```

Attendu avant l'application : `speculations` non nul, `baremes` et `circuits` nuls, `fonction` vrai. Sinon, ne rien appliquer.

## 2. Sauvegarder

Les tables sont nouvelles : rien à sauvegarder avant. Avant un retour arrière, exporter les lignes relues par un expert.

## 3. Appliquer (après feu vert)

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_financement_debouches.sql
```

## 4. Vérifier

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc "select code, contractuel, statut from ref.circuits_commercialisation order by ordre"
```

Attendu : six lignes (bord_champ, marche_local, grossiste, transformateur, export, contrat), toutes `brouillon_ia`, seul `contrat` contractuel. `select count(*) from ref.baremes_credit_campagne` donne 0.

## 5. Ce qui reste à faire côté données

- **Barèmes de crédit de campagne** : à demander au financeur (BNA, banques et IMF togolaises ou de l'UEMOA) ou à saisir depuis un document source : plafond en FCFA par unité d'échelle de la spéculation, durée, taux. Source et date de la source obligatoires, statut `brouillon_ia` jusqu'à validation par un expert.
- **Circuits** : faire relire la liste et les libellés par un agroéconomiste.

## 6. Retour arrière

```powershell
npx supabase db query --remote=redtuedpnhbqziqmyyjc --file supabase/en-ligne/20261127_ref_financement_debouches_retour_arriere.sql
```

## Persistance du financement détaillé (moteur 2.1.0) : aucune migration

Le financement détaillé d'un plan s'enregistre dans la colonne existante `plans.financement` (jsonb, contrainte `jsonb_typeof = 'object'`), sous la clé `detaille` ; son résultat calculé est dans `plans.resultats.financementDetaille` (jsonb). **Aucune migration, aucun script en ligne** : la colonne est déjà en ligne. Ce qui doit être en ligne pour que le calcul soit complet : les migrations `20261127190000` (barèmes de campagne : sans elles le plafond n'est pas vérifié, la lecture est tolérante) et `20261127191000` (circuits). Les plans calculés avec un moteur 2.0.x gardent leur version majeure (2) : ils ne sont pas marqués obsolètes, mais n'ont pas les champs 2.1.0 (`fraisFinanciers`, `travailFamilial`...) tant qu'ils ne sont pas recalculés.
