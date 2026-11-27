# Export du dossier (S4)

Deux documents tirés des mêmes calculs : le **dossier de financement** (14 parties dans l'ordre du canevas ANPGF quand le financeur est togolais, `pays = TG` dans `ref.regles_financeurs`) et la **version porteur** (7 parties, langage simple, tutoiement, vise 8 à 10 pages avec un vrai plan). Le texte est rédigé dans `dossier.ts` et `porteur.ts` ; les chiffres viennent uniquement des moteurs (plan calculé, financement M6, crédit, débouchés R3, main d'oeuvre R2). Un texte que le porteur doit écrire et qui manque est marqué « à compléter » et listé en dernière page (`aCompleter`), jamais inventé.

## Route (pour le front-end)

`POST /api/cultiplan/plans/:id/export` (jeton Bearer). Le plan doit avoir été calculé (sinon 400). Rien n'est enregistré.

Corps, tout facultatif :

| Champ | Sens |
|---|---|
| `format` | `pdf` (défaut), `html` ou `json` (le document : `titre`, `sections[]`, `aCompleter[]`, pour un aperçu dans l'interface) |
| `version` | `dossier` (défaut) ou `porteur` |
| `financeur` | `{ organisme, produit? }` d'un organisme de `ref.regles_financeurs` : lettre adaptée, règle appliquée, pièces exigées. Inconnu : 400 |
| `financement` | corps de `POST /plans/:id/financement` (prêts datés, campagne, chaîne de valeur, subventions, apport en nature...). Absent : l'apport et le crédit du plan |
| `debouches` | corps de `POST /exploitations/:id/debouches` (sans `dimensionnement`) |
| `mainOeuvre` | corps de `POST /exploitations/:id/main-oeuvre` |
| `promoteur` | `{ nom, adresse, contacts, rccm, effectif }` |
| `redaction` | textes du porteur : `contexteEtJustification`, `descriptionEntreprise`, `formeJuridique`, `objectif`, `descriptionProjet`, `produitsEtServices`, `concurrence`, `positionnement`, `strategieCommerciale`, `risques[{ risque, probabilite, impact, mesure }]`, `impacts{ economiques, environnementaux, sociaux }`, `suretes`, `calendrier[{ etape, debutMois, finMois }]`, `planB` |

Réponse : le fichier, avec `Content-Type` `application/pdf` ou `text/html` et `Content-Disposition: attachment`. Avec `format: "json"`, le document en JSON.

## Ce qui n'est pas produit, et pourquoi

- **Bilan SYSCOHADA (§10.9)** : le moteur de bilan (M9) n'existe pas ; la partie le dit et le liste dans `aCompleter`.
- **Calendrier de réalisation (Gantt)** : il vient de `redaction.calendrier` ; le calendrier cultural du référentiel (R1) le fournira.
- **Tableau d'amortissement technique par actif (§10.2)** : le moteur ne sort que le total des amortissements par année ; le dossier montre ce total, pas un calcul par ligne refait ici.
- **Trésorerie mensuelle** : lue par l'adaptateur `tresorerieDepuisScenario` (`service.ts`), qui prend la grille pluriannuelle `tresorerieMensuelle` du moteur 2.0.0 si elle existe, sinon l'an 1 (`tresorerieMensuelleAn1`). C'est le seul point à changer si le contrat du moteur change.
- Les mois sont **relatifs au démarrage** (« mois 3 »), jamais « mars » : le plan n'a pas de date de départ.

## PDF

`rendu-pdf.ts` utilise `pdfkit` 0.16 (JavaScript pur, polices de base). La version 0.21 charge `fontkit` en ESM, que Jest ne sait pas exécuter ; ne pas la remonter sans régler les tests. `pdfkit` est dans `serverExternalPackages` de `next.config.ts`. Le lexique de l'annexe vient de `lexique()` (la même source que `lexiqueEnMarkdown()`).
