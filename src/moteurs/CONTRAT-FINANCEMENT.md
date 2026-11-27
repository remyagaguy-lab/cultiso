# Contrat : financement, main d'oeuvre et débouchés (M6, R2, R3)

Complète `CONTRAT.md`. Ces moteurs sont **autonomes** : ils ne lisent pas `finance.ts` (que le socle calendaire fait passer à la grille mensuelle, moteur 2.0.0) et n'y sont pas branchés. Leurs sorties portent leur propre grille mensuelle, que M1 additionnera à la trésorerie d'exploitation. La constante `VERSION_MOTEURS` n'a pas été montée par ce lot, pour ne pas entrer en conflit avec la version 2.0.0 en cours : à faire au moment de la fusion avec M1.

Même règle que le reste : aucune valeur de référence dans le code. Barèmes, taux, taxes, durée de reprise d'une subvention arrivent en paramètres avec leur source ; un paramètre absent n'est jamais deviné (la taxe vaut 0 et la lecture le dit ; un plafond absent laisse le tirage non vérifié).

## M6 : `calculerFinancement(entree)` (`src/moteurs/financement.ts`)

| Entrée | Sens |
|---|---|
| `horizonMois` (obligatoire, 1 à 120) | Grille mensuelle : mois 0 (démarrage) à `horizonMois`. L'an 1 comprend les mois 0 à 12. |
| `emploisInitiaux { investissement, bfr }` | Emplois du démarrage (FCFA). Le service Cultiplan les lit dans le plan : investissement = coût du projet − BFR du scénario réaliste. |
| `apportEspeces` | Apport en numéraire, mois 0. |
| `apportsNature[] { libelle, valeur, piece?, nature?, origineValeur? }` | Valorisé ; **retenu seulement avec sa pièce**. Sans pièce : valeur écartée de l'apport et contrôle `APPORT_NATURE_SANS_PIECE`. |
| `prets[] { id, libelle, moisTirage = 0, credit }` | `credit` = entrée du moteur de crédit (`montant`, `tauxAnnuel`, `dureeMois`, `differeMois`, `typeDiffere`). Plusieurs prêts datés. |
| `creditsCampagne[] { id, libelle, tauxAnnuel, plafond?, campagnes[] }` | Court terme, renouvelable : chaque campagne `{ montantDemande, moisTirage, moisRemboursement }`. Intérêts simples payés au remboursement. `plafond { montant, source, statut? }` : plafond d'encours (les campagnes qui se chevauchent le partagent) ; `plafondCampagne(bareme, taille)` le calcule d'après un barème par unité d'échelle. Sans plafond : tirage non vérifié. |
| `creditsChaine[] { id, libelle, acheteur, montant, tauxAnnuel, moisTirage, moisPaiementAcheteur, paiementPrevuAcheteur? }` | Tripartite : la banque préfinance, l'acheteur rembourse la banque sur le paiement (capital + intérêts, `retenuesAcheteur`). Si `paiementPrevuAcheteur` est inférieur à la retenue : `RETENUE_ACHETEUR_NON_COUVERTE` (bloquant). |
| `subventions[] { id, libelle, type, montant, moisEncaissement, dureeRepriseAns?, etalementMois = 1, avance? }` | `investissement` : durée de reprise obligatoire (la durée d'amortissement du bien financé), reprise linéaire au résultat. `exploitation` : rattachée au résultat sur `etalementMois`. `avance { montant, moisAvance, tauxAnnuel = 0 }` : versée avant, rendue sur la subvention (encaissement net). |
| `taxeInterets { taux, nom, source, statut? }` | Taxe sur les intérêts (tous crédits). Absente : 0 et `TAXE_INTERETS_NON_RENSEIGNEE`. |
| `exploitation { tresorerieInitiale, cafParAn[], investissementsParAn[], variationBfrParAn[] }` | Chiffres du moteur financier pour compléter le plan de financement annuel. Absente : les lignes d'exploitation du plan annuel valent `null`. |

| Sortie | Sens |
|---|---|
| `mois[]` (0 à N) | `entrees`, `sorties`, `flux` (financement seul) et le détail : apport, tirages (prêts, campagne, chaîne), subventions encaissées, avances, capital, intérêts, remboursements de campagne, `retenuesAcheteur`, taxe, `repriseSubventions` (produit non encaissé, pour le résultat), `encours` de dette. |
| `annees[]` | Par an : apport (espèces, nature), emprunts tirés, subventions encaissées, capital remboursé, `interets`, `taxeInterets`, `fraisFinanciers` (intérêts + taxe, à porter au compte de résultat), `repriseSubventions`, `encoursFinAnnee`. |
| `planInitial` | Emplois (investissements, BFR) et ressources (apports, prêts, campagne, chaîne, subvention d'investissement, avances), `ecart`, `equilibre`, `partsRessources`. |
| `planAnnuel[]` | Format du canevas ANPGF §10.8 : trésorerie initiale, ressources (CAF, apports, subventions d'investissement, emprunts, réduction du BFR), emplois (immobilisations, remboursement d'emprunts, augmentation du BFR), variation et trésorerie finale. Les rubriques d'exploitation sont `null` sans l'entrée `exploitation`. |
| `apport` | `especes`, `natureRetenu`, `natureNonRetenu`, `sansPiece[]`, `total`, `partApport` (apport total / coût du projet). |
| `campagnes[]`, `chaines[]`, `subventions[]`, `encoursMaximum` | Détail par crédit : montant demandé, autorisé, tiré, intérêts. |
| `controles[]` | `{ code, niveau, valeurs, message }` : `PLAFOND_CAMPAGNE_DEPASSE`, `PLAFOND_CAMPAGNE_NON_VERIFIE`, `APPORT_NATURE_SANS_PIECE`, `RETENUE_ACHETEUR_NON_COUVERTE`, `PLAN_FINANCEMENT_DESEQUILIBRE`, `TAXE_INTERETS_NON_RENSEIGNEE`. Niveaux `info`, `alerte`, `bloquant`. |
| `lecture[]` | Phrases simples, au tutoiement. |

Ce que ce moteur ne fait pas : il ne ramène pas ses flux dans `calculerFinances` (frais financiers du résultat, trésorerie, VAN : à brancher quand M1 existe, avec `annees[].fraisFinanciers` et `mois[].flux`) ; pas de crédit-bail ni de compte courant d'associé ; pas de fiscalité du résultat (M8).

Données : `ref.baremes_credit_campagne` (migration locale `20261127190000`, non appliquée en ligne, **aucune ligne** : le lot ne donne aucun barème chiffré par spéculation). Lecture : `src/referentiel/financement.ts` (`lireBaremesCampagne`, `choisirBareme`).

Service et route : `src/modules/cultiplan/financement.ts` (`financerPlan`), `POST /api/cultiplan/plans/:id/financement` (voir l'en-tête de la route). Calcul à la demande, **rien n'est enregistré** : la persistance du financement détaillé dans `plans.financement` attend l'accord avec le front-end et le socle calendaire.
