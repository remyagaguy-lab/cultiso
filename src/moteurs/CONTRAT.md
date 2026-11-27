# Contrat des moteurs de calcul

Les moteurs de `src/moteurs/` font tous les calculs de Cultiso. L'IA (Cultisia) ne calcule jamais : elle restitue ce que les moteurs renvoient. Code pur : aucune base, aucun réseau, aucune date du jour. Montants en FCFA, arrondis à l'unité en sortie ; prix unitaires arrondis au centime ; taux en décimal (0,24 = 24 %), arrondis à 4 décimales.

Chaque résultat porte `versionMoteur`. Une sortie ajoutée fait monter la version mineure ; un changement de sens d'une sortie existante est signalé ci-dessous.

| Version | Changement |
|---|---|
| 1.0.0 | Budget, finance (résultat pluriannuel, trésorerie de l'an 1, BFR, seuil, VAN, TRI, scénarios sur la production), crédit |
| 1.1.0 | **M3** : ménage, salaires, impôts ; capacité de remboursement, solde résiduel, CAF disponible ; seuil de commercialisation ; trésorerie avec prélèvements, mois déficitaires, retrait possible, point bas. **Le `statut` change de sens** : il combine rentabilité, trésorerie et ménage |
| 1.2.0 | **M4** : `controles[]` et `ratios` par scénario ; entrées `regleFinanceur` et `bornesQuantite` (par ligne de revenu) |
| 1.3.0 | **M5** : `sensibilite` (variations, classement, équilibre, test du prix bas, tableau rendement × charges) ; entrées `ecartsScenarios` (scénarios croisés prix, rendement, charges) et `sensibilite` |
| 1.5.0 | **M4 (suite)** : contrôles du §3.6 portés par des champs optionnels des lignes (itinéraire, bande, pérennes, emploi, débouché, client, fournisseur) et entrée `seuilsControles` ; `bornesQuantite.statut` (R10) |
| 1.6.0 | **R10** : le générateur de budget met à la taille de l'atelier les bornes de rendement du référentiel (`ModeleRevenu.bornes` → `revenus[].bornesQuantite`, avec source, date et statut) |
| 1.7.0 | **S5 (intensité)** : `sensibilite.intensite` (part des intrants et de la main d'oeuvre, coût à l'unité vendue, rendement requis pour qu'une hausse d'intensité ne fasse pas perdre d'argent) ; l'alerte `ALERTE_EXPOSITION_PRIX` en reprend les chiffres |

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
| `revenus[].client`, `charges[].fournisseur` | absents | Nom du client ou du fournisseur, pour la concentration |
| `charges[].referenceItineraire` | absente | `{ quantite, source? }` : quantité attendue d'après l'itinéraire, dans l'unité et la période de `quantite` |
| `charges[].couverture` | absente | `{ moisCouverts, dureeBandeMois }` : ce que couvre la quantité budgétée, et la durée de la bande |
| `charges[].emploi` | absent | `{ effectif, salaireMensuel?, saisonnier = faux, moisTravailles? }` |
| `revenus[].perenne` | absent | `{ anneeEntreeProduction? }` : culture pérenne ; sa seule présence rend la déclaration obligatoire |
| `revenus[].debouche` | absent | `{ volumeAbsorbable, source? }` : volume que le marché ou un contrat absorbe (unité et période de `quantite`) |
| `seuilsControles` | absents | `{ ecartIntrants?, ecartMasseSalariale?, concentrationMax? }`, en décimal. **Aucune valeur par défaut** : sans seuil, le contrôle donne la mesure en niveau `info`, sans jugement |

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
| `INTRANTS_ECART_ITINERAIRE` | `referenceItineraire` fourni : écart relatif entre la quantité saisie et l'itinéraire (`ecart`, `seuil`) | ok, info (sans seuil), alerte |
| `CONSOMMATION_BANDE` | `couverture` fournie : mois couverts sous la durée de la bande (`quantiteNecessaire`) | ok, alerte |
| `PERIODE_IMPRODUCTIVE` | `perenne` fourni : année d'entrée en production absente (alerte), égale à 1 (info), ou supérieure à 1 (alerte : le moteur répète encore l'an type et surestime `anneesSurestimees`) | info, alerte |
| `MAIN_OEUVRE_SAISONNIERE` | `emploi.saisonnier` : mois payés hors des mois travaillés, ou 12 mois payés sans mois travaillés | ok, alerte |
| `MASSE_SALARIALE` | `emploi.salaireMensuel` fourni : montant annuel de la ligne contre effectif × salaire × mois (`attendu`, `ecart`) | ok, info (sans seuil), alerte |
| `VOLUME_HORS_DEBOUCHE` | `debouche` fourni : quantité × (1 − pertes) au-dessus du volume absorbable | ok, alerte |
| `CONCENTRATION_CLIENT`, `CONCENTRATION_FOURNISSEUR` | au moins un client (ou fournisseur) nommé : part du premier dans le chiffre d'affaires (ou les charges d'exploitation) ; `partNonAttribuee` pour ce qui n'est pas nommé | ok, info (sans seuil), alerte |

Ces contrôles du §3.6 ne se déclenchent que si la ligne porte la donnée : le moteur n'invente ni itinéraire, ni débouché, ni client. Ce qui reste hors de portée tant que M1 (calendrier), R1 (itinéraires), R4 (profil pluriannuel), M13 (dimensionnement à rebours) et M14 (bandes) n'existent pas : intrants **calculés** depuis l'itinéraire (ici, seulement comparés à une quantité fournie), main d'oeuvre **calculée** depuis le calendrier, consommation calculée par courbes d'âge, volumes vendables **déduits** du marché, croissance de production liée à une cause (le moteur répète une année type, il n'y a pas de croissance à contrôler). VAN et TRI sont toujours calculés par le moteur, jamais saisis.

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

## Règles des financeurs, alertes de prudence et langage simple (moteur 1.4.0)

**R10.** `ref.bornes_rendement` (migration `20261127160000_ref_bornes_rendement.sql`, locale, non appliquée en ligne) porte, pour un modèle de revenu et 1 unité d'échelle, un minimum, une valeur typique et un maximum de production dans l'unité et la période de ce modèle. Source et date de la source obligatoires, statut `brouillon_ia` tant qu'un expert ne les a pas validées. `lireModeles` les joint aux modèles de revenu (`bornes`), `genererBudget` les multiplie par la taille de l'atelier et les pose sur la ligne (`bornesQuantite { min, max, source, statut }`), et le contrôle `RENDEMENT_HORS_BORNES` les lit (`statutBornes` dans ses valeurs). Une borne absente n'est jamais devinée. Aujourd'hui une seule ligne de départ : l'oignon (10 à 70 t/ha, DOC-00015 p. 15-21) ; les autres spéculations n'ont pas encore de source citée. **Plan persistant.** La migration locale `20261127170000_plan_lignes_champs_controles.sql` ajoute à `plan_lignes` la colonne `champs_controle` (jsonb, objet, `{}` par défaut), validée par zod dans `src/modules/cultiplan/lignes.ts` (`schemaControlesCharge` : fournisseur, referenceItineraire, couverture, emploi ; `schemaControlesRevenu` : bornesQuantite, client, perenne, debouche ; mêmes schémas que le moteur). `depuisBudget` y range les champs de la ligne générée (dont `bornesQuantite`), `versLigne` les relit (un jsonb hors schéma est signalé, pas ignoré), `versMoteur` et donc `entreeFinance` les repassent au moteur au recalcul. Ligne saisie ou corrigée : champ `controles` (une correction remplace tout le groupe). Non appliquée en ligne : tant qu'elle ne l'est pas, le service Cultiplan en ligne n'a pas la colonne. Le moteur ne change pas (pas de montée de version).

**R11.** `regleFinanceur { nom, apportMinimum?, dureeMaxMois?, dureeInclutDiffere?, differeMaxMois?, source?, statut? }` vient du référentiel (`ref.regles_financeurs`, lu par `lireReglesFinanceurs`, converti par `versRegleMoteur`). Aucune valeur par défaut : une règle absente n'est pas contrôlée. Contrôles ajoutés : `DUREE_HORS_REGLE` (durée du crédit, différé compris sauf si `dureeInclutDiffere` vaut faux) et `DIFFERE_HORS_REGLE`. Les valeurs des contrôles portent la source et le statut de la règle (`statutRegle`).

**S5.** `alertesPrudence` (prudence.ts) ajoute aux `controles`, seulement quand elles se déclenchent : `ALERTE_APPORT_SOUS_SEUIL` (reprend `APPORT_INSUFFISANT`), `ALERTE_MENAGE_NON_COUVERT` (solde résiduel négatif), `ALERTE_MOIS_DEFICITAIRES_NON_FINANCES` (solde du mois négatif et caisse déjà négative), `ALERTE_POINT_BAS_NON_COUVERT` (point bas < 0), `ALERTE_EXPOSITION_PRIX` (scénario réaliste : le statut se dégrade, ou le ménage n'est plus couvert, au test du prix bas). L'exposition au prix mesure l'effet d'un prix bas.

**S5, intensité (`sensibilite.intensite`, moteur 1.7.0).** Mesure descriptive de l'an 1, scénario réaliste, sans seuil ni valeur de référence : `intrants` (lignes d'exploitation de type `intrants`), `mainOeuvre` (type `main_oeuvre` plus `salairesAnnuels`), `chargesExploitation`, `partIntrantsMainOeuvre` ; `parUniteVendue` (coût et prix à l'unité vendue, seulement s'il n'y a qu'une ligne de revenu, car les lignes n'ont pas d'unité commune) ; `seuils[]` : pour chaque hausse positive de la grille `sensibilite.variations`, le surcoût et le `rendementRequis` = surcoût / chiffre d'affaires de l'an 1, c'est-à-dire de combien la production doit monter pour que l'intensification ne fasse pas perdre d'argent (autres charges et impôts supposés inchangés). Ce que le moteur ne fait PAS, et pourquoi :
- **Comparer à une variante moins intensive du même plan** : il faudrait connaître l'effet d'un intrant sur le rendement (courbe de réponse, itinéraire extensif contre intensif). Cette donnée vient de l'itinéraire technique du référentiel (**M2**, **R1**, montée en production), pas encore modélisé ; en inventer une pente serait une valeur de référence codée en dur. On donne donc le gain requis, que le porteur ou l'expert compare à la promesse de l'itinéraire.
- **Déclencher une alerte « trop intensif »** : aucun seuil validé n'existe dans les sources. L'alerte d'exposition au prix cite la part et le rendement requis, elle ne juge pas.
Quand M2 et R1 existeront : ajouter `itineraire: "extensif" | "intensif"` aux lignes d'intrants du référentiel, générer la variante moins intensive depuis le référentiel (jamais depuis un coefficient du moteur) et comparer résultat, point bas et test du prix bas des deux plans.

**S8.** `donnees/explications.json` : pour chaque indicateur (`indicateurs`) et chaque code de contrôle ou d'alerte (`controles`), un `nom`, une phrase `simple` sans sigle et une version `technique` dépliable ; `lexique` pour l'annexe de l'export (`lexique()`, `lexiqueEnMarkdown()`). Les tests exigent une explication pour tout code de `CODES_CONTROLE` et pour tout champ de résultat.

## Limites connues (moteur actuel, avant M1)

Une année type répétée ; trésorerie mensuelle de l'an 1 seulement ; prélèvements constants sur l'horizon ; un seul crédit tiré au mois 0 ; pas de fiscalité calculée. Voir `Cultiso/2_Pilotage/03_Produit-et-technologie/ANALYSE-RESSOURCES-MODELISATION.md` §3.3.
