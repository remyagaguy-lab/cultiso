# Scénario de test : Cultiplan (plan persistant et outils de calcul de Cultisia)

Chantier 2 de la refonte (`CHANTIER-2-CULTIPLAN.md`, étapes 7 et 8). Écrit le 27/11/2026.
L'écran Cultiplan d'Antigravity n'est pas encore branché sur l'API : le scénario passe par l'API et le panneau Cultisia.

## A. Contrôles automatiques (sans réseau, sans dépense)

| Commande | Ce qu'elle vérifie | Résultat au 27/11 |
|---|---|---|
| `npm run check` | TypeScript, ESLint des dossiers refaits (dont `src/modules` et `src/app/api/cultiplan`), tests des moteurs, du socle, du référentiel, du plan et de Cultisia | vert (140 tests) |
| `npm run db:start` puis `npm run test:base-locale` | base locale : socle, référentiel, plan persistant (générer, corriger, ajouter, recalculer, dupliquer, figer, droits par rôle), données des outils de calcul | vert (31 tests, 4 suites) |
| `npm run test:modele-reel` | vrai modèle (Groq, clé gratuite) sur une fausse base : prix, opération proposée, crédit calculé par l'outil | vert (3 essais, 27/11) |

`npx supabase status` met environ une minute sur ce poste : les tests sur la base locale attendent jusqu'à 5 minutes au démarrage.

## B. Préparation, sur la base locale (rien ne touche la production)

1. Docker Desktop, puis `npm run db:start`. Appliquer les migrations du chantier si la base est ancienne : `npx supabase migration up`.
2. Charger le référentiel : `npm run referentiel:importer` (10 spéculations en `brouillon_ia`).
3. Lancer le site sur un port à part (variables lues dans `npx supabase status`), comme dans `docs/scenarios/cultisia.md` :

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY="<ANON_KEY local>"; $env:SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY local>"; npx next dev -p 3100
```

4. Créer un compte sur `http://localhost:3100/register`, puis récupérer le jeton d'accès (outils du navigateur, `localStorage`, clé `sb-127-auth-token`, champ `access_token`). Dans les commandes ci-dessous, `$J` vaut ce jeton :

```powershell
$J = "<access_token>"; $H = @{ Authorization = "Bearer $J"; "Content-Type" = "application/json" }; $A = "http://localhost:3100/api/cultiplan"
```

## C. Déroulé du plan persistant (API)

| # | Requête | Résultat attendu |
|---|---|---|
| 1 | `Invoke-RestMethod "$A/speculations" -Headers $H` | Les 10 spéculations, statut `brouillon_ia` |
| 2 | `$e = Invoke-RestMethod "$A/exploitations" -Method Post -Headers $H -Body '{"nom":"Ferme de Tsévié","lieu":"Tsévié"}'` | Exploitation au statut `projet` (201) |
| 3 | `Invoke-RestMethod "$A/exploitations/$($e.id)/ateliers" -Method Post -Headers $H -Body '{"speculationCode":"tomate","taille":2,"unite":"ha"}'` | Atelier créé |
| 4 | `Invoke-RestMethod "$A/questions?secteurs=vegetal" -Headers $H` puis `Invoke-RestMethod "$A/exploitations/$($e.id)/terrain" -Method Put -Headers $H -Body '{"cle":"accessibilite","valeur":"isolee"}'` | Questions dans l'ordre ; réponse enregistrée (204) |
| 5 | `$p = Invoke-RestMethod "$A/exploitations/$($e.id)/plans" -Method Post -Headers $H -Body '{"titre":"Tomate 2 ha"}'` | Plan en `brouillon`, `version` 1, `versionMoteur` égale à `VERSION_MOTEURS` (voir `src/moteurs/CONTRAT.md`) ; chaque ligne a son `origine` (`estimation`, `ajustee_terrain` pour la logistique en zone isolée) ; `resultats.scenarios` rempli |
| 6 | Corriger une ligne : `Invoke-RestMethod "$A/plans/$($p.id)/lignes/<id de ligne>" -Method Patch -Headers $H -Body '{"prixUnitaire":20000}'` | La ligne passe en `utilisateur`, `version` 2, résultats recalculés |
| 7 | `Invoke-RestMethod "$A/plans/$($p.id)" -Method Patch -Headers $H -Body '{"financement":{"apport":200000,"credit":{"montant":500000,"tauxAnnuel":0.24,"dureeMois":12}}}'` | Intérêts dans le compte de résultat, besoin de financement réduit de l'apport |
| 8 | `$v = Invoke-RestMethod "$A/plans/$($p.id)/dupliquer" -Method Post -Headers $H -Body '{"titre":"Et si le prix baisse ?"}'` | Variante en brouillon, `varianteDe` = plan d'origine, mêmes lignes |
| 9 | `Invoke-RestMethod "$A/plans/$($p.id)" -Method Patch -Headers $H -Body '{"statut":"lance"}'` puis refaire l'étape 6 | Réponse 409 : le plan lancé est figé ; dupliquer reste possible |
| 10 | Refaire l'étape 5 sans jeton | 401 |
| 11 | `Invoke-RestMethod "$A/credit" -Method Post -Headers $H -Body '{"montant":1000000,"tauxAnnuel":0.24,"dureeMois":12}'` | Mensualité 94 560 FCFA, échéancier de 12 mois |

Prix du marché : un modèle du référentiel qui désigne un produit (`produit_prix`, nom de `products.name`) prend le dernier relevé de moins d'un an dans la même unité. Les données de départ n'en désignent encore aucun : à renseigner lors de la revue du référentiel.

## D. Déroulé Cultisia (outils de calcul)

Ouvrir le panneau Cultisia dans `/cultiplan` ou `/cultisia` (modèle Groq gratuit, `CULTISIA_FOURNISSEUR=groq`).

| # | Demande | Résultat attendu |
|---|---|---|
| 1 | « Combien rapportent 2 ha de tomate ? » | Appel de `calculer_plan` ; chiffres du moteur (chiffre d'affaires, résultat, VAN, TRI, statut) ; mention « estimations non validées » ; source « Moteur financier Cultiso » |
| 2 | « Compare la tomate et le piment sur 1 ha » | Appel de `comparer_filieres` ; deux lignes chiffrées par le moteur |
| 3 | « Si j'emprunte 1 million à 24 % sur 12 mois ? » | Appel de `calculer_credit` ; mensualité 94 560 FCFA |
| 4 | « Et la vanille ? » | Cultisia dit que la spéculation n'est pas dans le référentiel, sans chiffre |

Dans `/cultiplan`, le prompt v1.2 (JSON lu par le canevas) reste actif tant que l'écran n'est pas branché sur l'API : le modèle peut encore y écrire des chiffres. C'est le contrat transitoire à retirer avec Antigravity.
