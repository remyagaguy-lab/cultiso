# Scénario de test : Cultisia (noyau et outils de lecture)

Chantier 1 de la refonte (`PLAN-REFONTE-CODE.md`, §6.1 et §6.2). Mis à jour le 26/11/2026.

## A. Contrôles automatiques (sans réseau, sans dépense)

| Commande | Ce qu'elle vérifie | Résultat au 26/11 |
|---|---|---|
| `npm run check` | TypeScript, ESLint sur `src/cultisia` et les deux routes, 60 tests Cultisia | vert |
| `npm run db:start` puis `npm run test:base-locale` | base Supabase locale : migration `cultisia_noyau`, droits RLS, crédits, prix, référentiel, recherche documentaire, route de bout en bout avec un faux modèle | vert (8 tests) |

Les tests de `npm run check` utilisent un faux modèle de langage : aucun crédit OpenRouter n'est consommé.

## B. Scénario manuel dans l'interface

**Modèle** : par défaut OpenRouter (payant). Pour tester gratuitement, ajoute dans `.env.local` `CULTISIA_FOURNISSEUR=groq` et `GROQ_API_KEY=...` (offre gratuite de Groq, modèle `llama-3.3-70b-versatile`), ou `CULTISIA_FOURNISSEUR=xai` et `XAI_API_KEY=...` (Grok). `CULTISIA_MODEL` change le modèle.

### Préparation, sur la base locale (rien ne touche la production)

1. Démarrer Docker Desktop, puis `npm run db:start` (ou `npx supabase db reset` pour repartir des données de test).
2. Lire les clés locales : `npx supabase status`.
3. Dans un terminal PowerShell, lancer le site sur un port à part (pour ne pas gêner le serveur d'Antigravity) :

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY="<ANON_KEY local>"; $env:SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY local>"; npx next dev -p 3100
```

   La clé du fournisseur vient de `.env.local`. Les variables du terminal priment sur `.env.local`.
4. Créer un compte sur `http://localhost:3100/register` (en local, pas de confirmation par e-mail).
5. Facultatif, pour les étapes 9 et 10 : créer une exploitation dans Studio (`http://127.0.0.1:54323`, table `cultisos`, avec ton `user_id`), puis une ou deux lignes dans `transactions`.

### Déroulé

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Ouvrir le panneau Cultisia et demander « Comment lutter contre la chenille légionnaire sur le maïs ? » | Réponse agronomique en flux, une question à la fois si une précision manque, aucun emoji, niveau de certitude indiqué |
| 2 | Studio, `auth.users` de ton compte : regarder `raw_app_meta_data.tokens_balance` | Le solde a baissé (20 000 moins les jetons de la réponse) |
| 3 | Demander « Quel est le prix du maïs à Lomé ? » | Réponse sourcée et datée : 350 FCFA/kg, Lomé Adawlato, relevé du 20/11/2026 ; la source « Cours des prix Cultiso » s'affiche |
| 4 | Demander « Et le prix de la vanille ? » | Cultisia dit qu'elle n'a pas de relevé, sans inventer de chiffre |
| 5 | Demander « Quel sol pour le manioc en zone IV ? » | Pluviométrie de la zone IV (1 400 à 1 600 mm) et paramètres du manioc tirés du référentiel, avec la source |
| 6 | Demander « Je veux faire le budget de mon projet de tomates, ouvre Cultiplan » | Message de redirection, puis bascule sur Cultiplan après 2 secondes |
| 7 | Dans Cultima, dicter « J'ai acheté 4 sacs d'engrais à 18 000 » | Le formulaire est pré-rempli : dépense, Engrais, **72 000 FCFA** (calculé par le code). Rien n'est enregistré tant que tu ne cliques pas sur « Enregistrer » ; `transactions` est inchangée |
| 8 | Dans Cultima, demander « Fais-moi le budget complet avec la marge » | Cultisia explique que les calculs viendront du moteur de Cultiplan et ne donne pas de chiffres inventés |
| 9 | Avec une exploitation active : « Où en est ma ferme ? » | Résumé tiré de l'exploitation : nom, surface, dernières opérations (*voir la limite 2*) |
| 10 | Studio : mettre `tokens_balance` à 0, puis poser une question | Message « crédits épuisés » (HTTP 402), aucune réponse générée ; le solde reste à 0 (plus de recharge automatique) |

## C. Limites connues

1. **Cultiplan** garde son prompt v1.2 (format JSON du canevas) comme « contrat de sortie transitoire ». La règle « l'IA ne calcule pas » ne s'y applique pleinement qu'au chantier Cultiplan (couche 3, moteurs).
2. **Exploitation active** : l'interface actuelle n'envoie ni `exploitationId` ni `sessionId` à `/api/chat`. L'étape 9 ne fonctionne qu'en appelant `/api/cultisia` directement, en attendant qu'Antigravity branche le panneau sur la nouvelle route.
3. **Recherche documentaire** : aucun document n'est marqué `licence = autorisee`, donc `chercher_savoir` répond « aucune source autorisée ». Le point d'accès d'embeddings (`router.huggingface.co`, `multilingual-e5-small`) n'a pas encore été essayé en réel.
4. **Page Experts Cultiso** (`/cultiseil`) : elle appelle `/api/chat` sans jeton, donc reste en erreur 401 (correction côté interface).

## D. Appel direct de `/api/cultisia` (sans interface)

```powershell
$jeton = "<access_token de ta session locale>"
$corps = '{"module":"cultisia","messages":[{"role":"user","content":"Prix du maïs à Lomé ?"}]}'
curl.exe -N -X POST http://localhost:3100/api/cultisia -H "Authorization: Bearer $jeton" -H "Content-Type: application/json" -d $corps
```

Événements attendus : `sources`, puis des `token`, puis `done` avec `jetons` et `solde`.
