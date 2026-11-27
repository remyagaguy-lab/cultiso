# Contrat des moteurs de calcul

Les moteurs de `src/moteurs/` font tous les calculs de Cultiso. L'IA (Cultisia) ne calcule jamais : elle restitue ce que les moteurs renvoient. Code pur : aucune base, aucun réseau, aucune date du jour. Montants en FCFA, arrondis à l'unité en sortie ; prix unitaires arrondis au centime ; taux en décimal (0,24 = 24 %), arrondis à 4 décimales.

Chaque résultat porte `versionMoteur`. Une sortie ajoutée fait monter la version mineure ; un changement de sens d'une sortie existante est signalé ci-dessous.

| Version | Changement |
|---|---|
| 1.0.0 | Budget, finance (résultat pluriannuel, trésorerie de l'an 1, BFR, seuil, VAN, TRI, scénarios sur la production), crédit |
| 1.1.0 | **M3** : ménage, salaires, impôts ; capacité de remboursement, solde résiduel, CAF disponible ; seuil de commercialisation ; trésorerie avec prélèvements, mois déficitaires, retrait possible, point bas. **Le `statut` change de sens** : il combine rentabilité, trésorerie et ménage |
| 1.2.0 | **M4** : `controles[]` et `ratios` par scénario ; entrées `regleFinanceur` et `bornesQuantite` (par ligne de revenu) |
| 1.3.0 | **M5** : `sensibilite` (variations, classement, équilibre, test du prix bas, tableau rendement × charges) ; entrées `ecartsScenarios` (scénarios croisés prix, rendement, charges) et `sensibilite` |

Aucune valeur de référence (seuil de financeur, taux, rendement) n'est codée dans les moteurs : elles arrivent en paramètres, depuis le référentiel `ref` ou les règles des financeurs, au statut `brouillon_ia` tant qu'un expert ne les a pas validées.

## `calculerFinances(entree)` : entrées

| Champ | Défaut | Sens |
|---|---|---|
| `charges[]`, `revenus[]` | | Lignes (voir `schemaLigneCharge`, `schemaLigneRevenu`) |
| `horizonAnnees` | 3 | 1 à 5 ans, l'an 1 répété (pas de calendrier : M1) |
| `tauxActualisation` | 0,12 | Pour la VAN |
| `hausseCharges`, `haussePrix` | 0 | Hausse annuelle uniforme |
| `apport`, `credit` | 0, aucun | Financement |
| `menage` | absent | `{ prelevementsAnnuels, revenusExterieursAnnuels = 0, moisPrelevements? }`. Absent : le ménage n'est pas évalué (`menageCouvert = null`) |
| `salairesAnnuels`, `moisSalaires` | 0 | Salaires des employés **non saisis en lignes** ; charge fixe d'exploitation |
| `impotsAnnuels` | 0 | Impôts et taxes, en attendant la fiscalité par pays (M8) ; répartis sur 12 mois |
| `regleFinanceur` | absente | `{ nom, apportMinimum?, source? }` : règle du financeur visé (R11), par exemple ANPGF 20 %. Absente : pas de contrôle d'apport |
| `revenus[].bornesQuantite` | absentes | `{ min?, max?, source? }` : bornes de production du référentiel (R10), dans l'unité et la période de `quantite`, à la taille de l'atelier. Absentes : pas de contrôle de rendement |

## Sorties par scénario (`scenarios.pessimiste | realiste | optimiste`)

### Par année (`annees[]`)

Les champs historiques (chiffre d'affaires, charges variables et fixes, marge brute, excédent brut, amortissements, intérêts, résultat, CAF nette, remboursement du capital, flux de trésorerie), plus :

| Champ | Formule | Source |
|---|---|---|
| `impots` | entrée `impotsAnnuels` ; retirés du résultat | |
| `salaires` | entrée `salairesAnnuels` × hausse des charges ; compris dans `chargesFixes` | |
| `margeAvantInteretsSalairesAmortissements` | excédent brut + salaires | DOC-00006 p. 24 |
| `annuites` | intérêts + remboursement du capital | |
| `prelevementsNets` | prélèvements − revenus extérieurs (négatif si le ménage apporte de l'argent) ; 0 sans ménage | DOC-00006 annexe II |
| `capaciteRemboursement` | marge avant intérêts, salaires et amortissements − salaires − prélèvements nets − impôts | DOC-00006 p. 24 |
| `soldeResiduel` | capacité − annuités ; doit rester positif | DOC-00006 p. 24 |
| `cafDisponible` | excédent brut − annuités − prélèvements nets | guide SPBN-AFOCG |

### Trésorerie de l'an 1 (`tresorerieMensuelleAn1[]`, mois 0 à 12)

`entrees`, `sorties` (investissements au mois 0 ; charges, salaires, impôts, échéances ensuite), `prelevementsNets`, `solde = entrees − sorties − prelevementsNets`, `cumul`, et `retraitPossible` : l'argent que le ménage peut retirer ce mois-là sans que la trésorerie devienne négative avant la fin de l'an 1 (le plus bas des cumuls de ce mois à décembre, jamais négatif ; DOC-00686).

Autour : `pointBasTresorerie { montant, mois }`, `moisDeficitaires` (solde du mois négatif, DOC-00011 p. 39-42), `moisTresorerieNegative` (cumul négatif). Le BFR reste le creux de la trésorerie **d'exploitation** (sans financement ni ménage).

### Seuil de commercialisation (`seuilCommercialisation`, DOC-00106 p. 4-5)

Le prix de vente minimum qui couvre les charges décaissées, les impôts, les annuités et les prélèvements nets. Calculé sur l'année la plus exigeante de l'horizon (`an`) : `besoinAnnuel`, `chiffreAffaires`, `coefficientPrix = besoin / chiffre d'affaires` (0,8 : les prix peuvent baisser de 20 % ; 1,1 : il faut vendre 10 % plus cher), et `parLigne[] { ligneId, libelle, quantiteVendue, prixActuel, prixSeuil }`. Avec plusieurs produits, le seuil suppose que tous les prix bougent dans la même proportion.

### Verdict et statut

`verdict { rentabilite, tresorerieToujoursPositive, menageCouvert }` et `statut` :

- `deficitaire` : rentabilité (résultat cumulé / charges cumulées) sous −5 % ;
- `limite` : rentabilité entre −5 % et +5 %, **ou** rentable mais trésorerie négative un mois de l'an 1, **ou** ménage non couvert (solde résiduel négatif une année) ;
- `rentable` : rentable, trésorerie jamais négative, ménage couvert ou non renseigné.

### Contrôles nommés (`controles[]`, M4)

Chaque contrôle : `{ code, niveau, valeurs, message }`. `niveau` : `ok` (rien à signaler), `info` (à vérifier), `alerte` (point faible à corriger ou justifier), `bloquant` (le plan ne tient pas en l'état). `valeurs` porte les chiffres du moteur ; `message` est une phrase simple, au tutoiement. Les codes sont stables : l'interface et Cultisia s'appuient dessus.

| Code | Quand | Niveaux |
|---|---|---|
| `TRESORERIE_NEGATIVE` | cumul de trésorerie négatif un mois de l'an 1 (`mois`, `pointBas`, `moisPointBas`) | ok, bloquant |
| `MENAGE_NON_COUVERT` | solde résiduel négatif une année (`annees`, `soldeResiduelMin`, `capaciteMin`) ; le message distingue « même sans crédit » et « pas de quoi payer les échéances » | ok, bloquant |
| `MENAGE_NON_RENSEIGNE` | pas d'entrée `menage` | info |
| `APPORT_INSUFFISANT` | apport / coût du projet sous `regleFinanceur.apportMinimum` (`manque`) ; seulement si la règle est fournie | ok, alerte |
| `BFR_NON_FINANCE` | apport + crédit < investissement + BFR (`manque`) | ok, alerte, bloquant |
| `DERNIERES_ANNEES_DEFICITAIRES` | résultat négatif les deux dernières années de l'horizon (la seule si horizon d'un an) | ok, bloquant |
| `RENDEMENT_HORS_BORNES` | quantité du scénario hors de `bornesQuantite`, une entrée par ligne bornée | ok, info (sous le min), alerte (au-dessus du max) |
| `RESSOURCE_EN_DOUBLE` | crédit supérieur au coût du projet (alerte) ; apport + crédit au-dessus du coût (info) | info, alerte |
| `POSTE_EN_DOUBLE` | même libellé, type et classe deux fois ; frais financiers saisis avec un crédit ; impôts en ligne et en montant ; salaires à part et main d'oeuvre fixe en ligne (info) | info, alerte |
| `UNITE_PERIODE` | un mois répété dans une liste de mois ; salaire fixe annuel payé une seule fois (souvent un mois saisi comme un an) | info, alerte |
| `VARIATION_BFR` | garantie du moteur : le BFR n'est compté qu'une fois (`variations` = BFR l'an 1, 0 ensuite) | ok |
| `BFR_AMORTI` | ligne d'investissement nommée fonds de roulement, BFR ou imprévus | ok, alerte |

Les contrôles du §3.6 qui demandent le calendrier, l'itinéraire ou le débouché (intrants issus de l'itinéraire, période improductive, consommation sur toute la bande, saisonniers payés 12 mois, volumes vendables) attendent M1, R1, R4, M13 et M14. VAN et TRI sont toujours calculés par le moteur, jamais saisis.

### Ratios (`ratios`, M4)

| Ratio | Formule |
|---|---|
| `coutProjet` | investissement + BFR du scénario |
| `endettement` | crédit / apport (null sans apport) |
| `dettesSurCaf` | crédit / CAF nette de l'an 1 (null si CAF ≤ 0) |
| `chargesFinancieresSurCA` | intérêts de l'an 1 / chiffre d'affaires de l'an 1 |
| `partApport` | apport / coût du projet (Canevas ANPGF §10.1) |

## Sensibilité (`sensibilite`, M5, scénario réaliste)

Entrées : `ecartsScenarios { pessimiste: { prix, charges }, optimiste: { prix, charges } }` (0 par défaut ; le pessimiste doit avoir le prix le plus bas et les charges les plus hautes) appliqués aux prix de vente et aux charges d'exploitation (salaires compris), en plus des quantités propres à chaque scénario (DOC-00011 p. 33, DOC-00106 p. 13) ; `sensibilite { variations = [−0,2, −0,1, 0,1, 0,2], baissePrixBas?, axeRendement = [−0,2…0,2 par 0,1], axeCharges = [−0,1…0,1 par 0,05] }`.

Sorties :

- `base` et `variations[] { hypothese, variation, resultatCumule, pointBasTresorerie, van, ecartResultat, ecartPointBas, ecartVan }` pour `prix`, `rendement`, `pertes`, `intrants` (lignes de type `intrants`), `mainOeuvre` (lignes `main_oeuvre` et `salairesAnnuels`) ;
- `classement` : hypothèses de la plus influente à la moins influente sur le résultat ;
- `equilibre { an, coefficient, parLigne[] { prixEquilibre, quantiteEquilibre } }` : prix et rendement qui annulent le résultat l'année la plus exigeante ;
- `testPrixBas { baisse, origine, statut, verdict, resultatCumule, pointBasTresorerie, soldeResiduelMin }` : baisse explicite, sinon écart de prix du pessimiste, sinon plus forte baisse de la grille ;
- `tableauSeuil { axeRendement, axeCharges, coefficientsPrix[i][j], lignePrincipale { prixSeuil[i][j] } }` : seuil de commercialisation (M3) pour chaque couple rendement × charges ; la case centrale égale `seuilCommercialisation`.

## Limites connues (moteur actuel, avant M1)

Une année type répétée ; trésorerie mensuelle de l'an 1 seulement ; prélèvements constants sur l'horizon ; un seul crédit tiré au mois 0 ; pas de fiscalité calculée. Voir `Cultiso/2_Pilotage/03_Produit-et-technologie/ANALYSE-RESSOURCES-MODELISATION.md` §3.3.
