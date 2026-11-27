# Contrat des moteurs de calcul

Les moteurs de `src/moteurs/` font tous les calculs de Cultiso. L'IA (Cultisia) ne calcule jamais : elle restitue ce que les moteurs renvoient. Code pur : aucune base, aucun réseau, aucune date du jour. Montants en FCFA, arrondis à l'unité en sortie ; prix unitaires arrondis au centime ; taux en décimal (0,24 = 24 %), arrondis à 4 décimales.

Chaque résultat porte `versionMoteur`. Une sortie ajoutée fait monter la version mineure ; un changement de sens d'une sortie existante est signalé ci-dessous.

| Version | Changement |
|---|---|
| 1.0.0 | Budget, finance (résultat pluriannuel, trésorerie de l'an 1, BFR, seuil, VAN, TRI, scénarios sur la production), crédit |
| 1.1.0 | **M3** : ménage, salaires, impôts ; capacité de remboursement, solde résiduel, CAF disponible ; seuil de commercialisation ; trésorerie avec prélèvements, mois déficitaires, retrait possible, point bas. **Le `statut` change de sens** : il combine rentabilité, trésorerie et ménage |

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

## Limites connues (moteur actuel, avant M1)

Une année type répétée ; trésorerie mensuelle de l'an 1 seulement ; prélèvements constants sur l'horizon ; un seul crédit tiré au mois 0 ; pas de fiscalité calculée. Voir `Cultiso/2_Pilotage/03_Produit-et-technologie/ANALYSE-RESSOURCES-MODELISATION.md` §3.3.
