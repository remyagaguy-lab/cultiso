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
| 1.8.0 | **M14** : `simulerBandes` (atelier animal à bandes) et `simulerTroupeau` (cheptel en flux), deux moteurs autonomes ; `calculerFinances` est inchangé |
| **2.0.0** | **M1, M2, M17** : moteur calendaire. Grille mensuelle sur tout l'horizon (jusqu'à 120 mois), trésorerie mensuelle pluriannuelle, investissements et prêts datés avec renouvellement, amortissement au prorata, point bas avec et sans financement, montée en production, hausses par ligne, horizon libre. **Changements de sens** : voir « Moteur calendaire » ci-dessous. Les plans calculés avec une version 1.x sont **à recalculer** (`versionMoteur` < 2) |
| **2.1.0** | **Branchement de M6 et R2 sur la grille** : entrées `financement` (financement détaillé mois par mois, `financementPourMoteur`) et `travailFamilial` ; `annees[]` gagne `taxeInterets`, `fraisFinanciers`, `repriseSubventions`, `travailFamilial`, `resultatApresTravailFamilial`. **Changements de sens** : avec `financement`, la grille ne tire plus de flux de `apport` ni de `credit` ; `resultat` = excédent brut − amortissements − intérêts − taxe − impôts + reprise des subventions ; `cafNette` retire la reprise ; `annuites` comprend la taxe |

Aucune valeur de référence (seuil de financeur, taux, rendement) n'est codée dans les moteurs : elles arrivent en paramètres, depuis le référentiel `ref` ou les règles des financeurs, au statut `brouillon_ia` tant qu'un expert ne les a pas validées.

## `calculerFinances(entree)` : entrées

| Champ | Défaut | Sens |
|---|---|---|
| `charges[]`, `revenus[]` | | Lignes (voir `schemaLigneCharge`, `schemaLigneRevenu`) |
| `horizonAnnees`, `horizonMois`, `horizonCycles` | voir M17 | Horizon libre (M17). `horizonMois` (1 à 120) l'emporte sur `horizonCycles` (nombre du plus long cycle des lignes), qui l'emporte sur `horizonAnnees` (1 à 10). Sans aucun des trois : le plus long entre un cycle, la durée du crédit (mois du tirage + durée) et le plein régime, arrondi à l'année (12 mois au moins). `HORIZON_PAR_DEFAUT` (3) n'est plus le défaut du moteur : c'est celui du service Cultiplan et des outils de Cultisia |
| `montee[]` | aucune | M2 : `{ atelierId, coefficientsRendement?[], tauxUtilisation?[], debutant?: { coefficientAn1 }, origine? }`, tableaux par année (index 0 = an 1) ; au-delà du dernier élément, la dernière valeur se prolonge |
| `moisTirageCredit` | 0 | Mois où le crédit est tiré ; les échéances suivent |
| `charges[].moisAcquisition`, `charges[].renouvellement` | 0, vrai | Investissement : mois de l'achat (0 = démarrage) ; renouvelé à la fin de la durée de vie si l'horizon le permet |
| `charges[].atelierId`, `revenus[].atelierId` | absent | Rattache la ligne à la montée en production d'un atelier |
| `lignes[].hausseAnnuelle`, `lignes[].hausseParAn[]` | absentes | M2 : hausse propre à la ligne (prix pour un revenu, coût pour une charge) ; `hausseParAn[j]` = passage de l'an j+1 à l'an j+2 ; sinon `hausseAnnuelle`, sinon `haussePrix` / `hausseCharges` |
| `lignes[].calendrier` | absent | R1 : `{ debutMois = 1, parts[], origine? }` ; ligne par cycle seulement ; `parts` (somme = 1) = part du montant du cycle à chaque mois du cycle ; remplace `moisDecaissement` / `moisVente` |
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
| `revenus[].perenne` | absent | `{ anneeEntreeProduction? }` : culture pérenne ou cheptel à constituer ; sa seule présence rend la déclaration obligatoire. **Depuis 2.0.0, aucune vente n'est comptée avant l'année indiquée** (les charges courent) |
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

### Trésorerie mensuelle (`tresorerieMensuelle[]`, mois 0 à N ; `tresorerieMensuelleAn1[]` = ses 13 premiers mois)

`entrees`, `sorties` (investissements au mois 0 ; charges, salaires, impôts, échéances ensuite), `prelevementsNets`, `solde = entrees − sorties − prelevementsNets`, `cumul`, et `retraitPossible` : l'argent que le ménage peut retirer ce mois-là sans que la trésorerie devienne négative avant la fin de l'an 1 (le plus bas des cumuls de ce mois à décembre, jamais négatif ; DOC-00686).

Autour : `pointBasTresorerie { montant, mois, an, moisDansAn }` (sur **tout l'horizon**, financement et ménage compris), `pointBasSansFinancement` (même forme : sans apport, sans crédit, investissements, impôts et ménage compris), `moisDeficitaires` (solde du mois négatif, DOC-00011 p. 39-42), `moisTresorerieNegative` (cumul négatif), tous sur l'horizon. Le BFR reste le creux de la trésorerie **d'exploitation** (sans financement, investissements ni ménage), cette fois sur l'horizon. `retraitPossible` : le plus bas des cumuls du mois à la **fin de l'horizon**, jamais négatif.

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

**R10.** `ref.bornes_rendement` (migration `20261127160000_ref_bornes_rendement.sql`, locale, non appliquée en ligne) porte, pour un modèle de revenu et 1 unité d'échelle, un minimum, une valeur typique et un maximum de production dans l'unité et la période de ce modèle. Source et date de la source obligatoires, statut `brouillon_ia` tant qu'un expert ne les a pas validées. `lireModeles` les joint aux modèles de revenu (`bornes`), `genererBudget` les multiplie par la taille de l'atelier et les pose sur la ligne (`bornesQuantite { min, max, source, statut }`), et le contrôle `RENDEMENT_HORS_BORNES` les lit (`statutBornes` dans ses valeurs). Une borne absente n'est jamais devinée. Aujourd'hui deux lignes de départ : l'oignon (10 à 70 t/ha, DOC-00015 p. 15-21) et la poule pondeuse (maximum de 305 œufs par poule, DOC-00655 p. 4, sans minimum) ; aucune autre source du lot ne donne de borne (voir ANALYSE-BASE-RESSOURCES §4). Les seuils de `seuilsControles` n'ont aucune source non plus : ils restent absents. **Plan persistant.** La migration locale `20261127170000_plan_lignes_champs_controles.sql` ajoute à `plan_lignes` la colonne `champs_controle` (jsonb, objet, `{}` par défaut), validée par zod dans `src/modules/cultiplan/lignes.ts` (`schemaControlesCharge` : fournisseur, referenceItineraire, couverture, emploi ; `schemaControlesRevenu` : bornesQuantite, client, perenne, debouche ; mêmes schémas que le moteur). `depuisBudget` y range les champs de la ligne générée (dont `bornesQuantite`), `versLigne` les relit (un jsonb hors schéma est signalé, pas ignoré), `versMoteur` et donc `entreeFinance` les repassent au moteur au recalcul. Ligne saisie ou corrigée : champ `controles` (une correction remplace tout le groupe). Non appliquée en ligne : tant qu'elle ne l'est pas, le service Cultiplan en ligne n'a pas la colonne. Le moteur ne change pas (pas de montée de version).

**R11.** `regleFinanceur { nom, apportMinimum?, dureeMaxMois?, dureeInclutDiffere?, differeMaxMois?, source?, statut? }` vient du référentiel (`ref.regles_financeurs`, lu par `lireReglesFinanceurs`, converti par `versRegleMoteur`). Aucune valeur par défaut : une règle absente n'est pas contrôlée. Contrôles ajoutés : `DUREE_HORS_REGLE` (durée du crédit, différé compris sauf si `dureeInclutDiffere` vaut faux) et `DIFFERE_HORS_REGLE`. Les valeurs des contrôles portent la source et le statut de la règle (`statutRegle`).

**S5.** `alertesPrudence` (prudence.ts) ajoute aux `controles`, seulement quand elles se déclenchent : `ALERTE_APPORT_SOUS_SEUIL` (reprend `APPORT_INSUFFISANT`), `ALERTE_MENAGE_NON_COUVERT` (solde résiduel négatif), `ALERTE_MOIS_DEFICITAIRES_NON_FINANCES` (solde du mois négatif et caisse déjà négative), `ALERTE_POINT_BAS_NON_COUVERT` (point bas < 0), `ALERTE_EXPOSITION_PRIX` (scénario réaliste : le statut se dégrade, ou le ménage n'est plus couvert, au test du prix bas). L'exposition au prix mesure l'effet d'un prix bas.

**S5, intensité (`sensibilite.intensite`, moteur 1.7.0).** Mesure descriptive de l'an 1, scénario réaliste, sans seuil ni valeur de référence : `intrants` (lignes d'exploitation de type `intrants`), `mainOeuvre` (type `main_oeuvre` plus `salairesAnnuels`), `chargesExploitation`, `partIntrantsMainOeuvre` ; `parUniteVendue` (coût et prix à l'unité vendue, seulement s'il n'y a qu'une ligne de revenu, car les lignes n'ont pas d'unité commune) ; `seuils[]` : pour chaque hausse positive de la grille `sensibilite.variations`, le surcoût et le `rendementRequis` = surcoût / chiffre d'affaires de l'an 1, c'est-à-dire de combien la production doit monter pour que l'intensification ne fasse pas perdre d'argent (autres charges et impôts supposés inchangés). Ce que le moteur ne fait PAS, et pourquoi :
- **Comparer à une variante moins intensive du même plan** : il faudrait connaître l'effet d'un intrant sur le rendement (courbe de réponse, itinéraire extensif contre intensif). Cette donnée vient de l'itinéraire technique du référentiel (**M2**, **R1**, montée en production), pas encore modélisé ; en inventer une pente serait une valeur de référence codée en dur. On donne donc le gain requis, que le porteur ou l'expert compare à la promesse de l'itinéraire.
- **Déclencher une alerte « trop intensif »** : aucun seuil validé n'existe dans les sources. L'alerte d'exposition au prix cite la part et le rendement requis, elle ne juge pas.
Quand M2 et R1 existeront : ajouter `itineraire: "extensif" | "intensif"` aux lignes d'intrants du référentiel, générer la variante moins intensive depuis le référentiel (jamais depuis un coefficient du moteur) et comparer résultat, point bas et test du prix bas des deux plans.

**S8.** `donnees/explications.json` : pour chaque indicateur (`indicateurs`) et chaque code de contrôle ou d'alerte (`controles`), un `nom`, une phrase `simple` sans sigle et une version `technique` dépliable ; `lexique` pour l'annexe de l'export (`lexique()`, `lexiqueEnMarkdown()`). Les tests exigent une explication pour tout code de `CODES_CONTROLE` et pour tout champ de résultat.

## M14 : atelier animal à bandes et cheptel en flux (moteur 1.8.0)

Deux moteurs **autonomes** : ils ont leur propre grille mensuelle, car le moteur calendaire M1 n'existe pas encore (`calculerFinances` répète une année type). Quand M1 existera, leurs flux mensuels (`mois[]`) devront alimenter la grille de M1 au lieu d'une trésorerie séparée. Aucune courbe, aucun prix, aucune durée n'est écrit dans le code.

**`simulerBandes(entree)`** (`bandes.ts`) : entrées `courbes { mortalite, consommation, production }` (points `{ age, valeur }`, âge en mois), `joursParMois`, `dureeBandeMois` (âge de réforme), `bandes[] { debutMois, effectif }` (plusieurs = bandes décalées), `prix { animal, aliment, produit, reforme }`, `chargesParSujetMois[]`, `chargesFixesMensuelles[]`, `investissement` (mois 0), `apport` (mois 0). Les courbes viennent du référentiel (`ref.courbes_age` : source, date et statut par valeur, migration locale `20261127180000_ref_courbes_age.sql`, lecture `lireVariantesElevage`) ; **une courbe sans valeur à un âge de la bande est refusée, jamais prolongée**.

Conventions du modèle source (DOC-00686) : mortalité, consommation et production d'un mois se calculent sur l'effectif présent en **début** de mois ; le mois compte `joursParMois` jours ; la production est en unités par sujet et par jour (0,75 œuf par poule) ; les réformées sont l'effectif restant à la **fin** du dernier mois de la bande (le modèle source les vend sur l'effectif de début de mois : écart de quelques sujets, assumé).

| Sortie | Sens |
|---|---|
| `mois[]` (0 à N) | effectifs, morts, aliment (kg), production, ventes du produit et des réformées, achats, charges, investissement, entrées, sorties, solde, trésorerie cumulée (apport compris) |
| `coutAnimalPretAProduire` | achat + aliment + charges par sujet de la **première bande** pendant la phase improductive (mois avant la première production de la courbe), par sujet mis en place et par sujet vivant au début de la production ; les charges fixes de la phase sont montrées à part, non imputées (elles sont partagées entre les bandes) |
| `seuilTechnique` | production par sujet et par jour qui couvre juste les charges d'exploitation (aliment, charges par sujet, charges fixes) des mois où au moins une bande produit, contre la production prévue ; `seuilMoyen`, `prevuMoyen`, `margeSecurite`, `parMois[]` ; null sans prix du produit |
| `pointBasTresorerie`, `besoinFinancement`, `apportSuffisant` | point bas de la trésorerie ; besoin = point bas **sans apport**, investissement compris |
| `renouvellement` | `autofinancement` (trésorerie de fin hors investissement et apport), `besoinRedemarrage` (point bas d'une bande identique seule), `autofinance`, `retraitPossible` et `retraitPossibleParMois` (étalé sur la durée d'une bande : DOC-00686) |
| `lecture[]` | phrases simples, au tutoiement, dont ce qui n'est pas évalué |

**`simulerTroupeau(entree)`** (`troupeau.ts`) : effectif de chaque catégorie, mois par mois, avec entrées (`naissance`, `achat`, `don_recu`, `confiage_recu`) et sorties (`mortalite`, `vente`, `autoconsommation`, `don_donne`, `vol_perte`), croît = effectif de fin − effectif de début (structure du tableau DOC-00279 p. 40). Aucun taux de mise bas, de mortalité ou de vente : l'appelant donne les mouvements. Un mouvement impossible (sortir plus d'animaux qu'on n'en a) est refusé avec le mois et la catégorie. Trésorerie des achats et des ventes aux prix donnés ; `mouvementsSansPrix` signale ce qui n'est pas valorisé.

Service Cultiplan : `simulerAtelierAnimal` (`src/modules/cultiplan/atelier-animal.ts`) prend la variante de courbes, la durée de bande et les jours par mois du référentiel (ou de l'appelant, avec sa source) ; sans courbe ou sans durée, l'atelier est « non évalué » et la liste de ce qui manque est donnée. Outil Cultisia `simuler_atelier_animal`, routes `POST /api/cultiplan/elevage/bandes` et `/elevage/troupeau`.

## Moteur calendaire (M1, M2, M17, R1, R4 ; moteur 2.0.0)

`src/moteurs/calendrier.ts` (`construireGrille`, `resoudreHorizon`) construit la grille ; `finance.ts` en tire les années, la trésorerie et les indicateurs. **Aucune valeur de référence dans le code** : coefficients de montée, profils de cycle et hausses arrivent en paramètres.

**Conventions.** Mois 0 = démarrage ; mois 1 à N = grille ; l'an 1 = mois 1 à 12 (le mois 0 n'appartient à aucune année de résultat) ; la dernière année est **partielle** si N n'est pas un multiple de 12 (`annees[].mois`). Une ligne sans `calendrier` reste annuelle et se répète à l'identique chaque année (comportement 1.x : `moisDecaissement` et `moisVente` valent pour chaque année). Avec `calendrier`, le cycle k démarre au mois `debutMois + arrondi(k × 12 / cyclesParAn)` ; la part d'un cycle hors de l'horizon n'est pas comptée.

**Investissements.** Décaissés au mois `moisAcquisition` (0 par défaut), amortis en linéaire **par mois** à partir du mois suivant (prorata : un achat au mois 7 donne 5 mois d'amortissement l'an 1), **renouvelés** à la fin de la durée de vie (au prix de l'année, avec la hausse de la ligne) tant que le renouvellement tombe avant la fin de l'horizon ; `renouvellement: false` l'interdit. `investissementTotal` reste l'achat initial (les renouvellements se financent par l'exploitation) ; `investissementsDates[]` liste achats et renouvellements ; un achat ou un tirage après l'horizon n'est pas compté et `avertissements[]` le dit.

**Montée en production (M2).** Vente de l'année = quantité × `coefficientsRendement[an]` × `tauxUtilisation[an]` × (`debutant.coefficientAn1` en an 1) ; les **charges variables** de l'atelier suivent `tauxUtilisation` seulement (un rendement faible ne baisse pas le coût) ; un `perenne.anneeEntreeProduction` n'est vendu qu'à partir de cette année. Le seuil de commercialisation et l'équilibre de la sensibilité ignorent les années sans vente.

**Horizon et indicateurs annuels (M17).** `horizon { mois, annees, anneesCompletes, origine ("mois" | "cycles" | "annees" | "defaut"), cycleMois, creditMois, pleinRegimeMois, indicateursAnnuels }` est dans chaque scénario et dans `ResultatFinance`. **`van`, `tri` et `delaiRecuperationAns` valent `null` (et `indicateursAnnuels` est faux) s'il y a moins de deux années complètes.** Les flux annuels sont : −achats du mois 0, puis excédent brut − investissements de chaque année complète (renouvellements compris), sans valeur résiduelle.

**Sorties ajoutées.** `horizon`, `tresorerieMensuelle`, `grille.lignes[] { id, libelle, sens, classe, nature, atelierId, mensuel[0..N] }` (toutes les lignes, mois par mois), `investissementsDates`, `avertissements`, `pointBasSansFinancement`, `annees[].mois`, `annees[].investissements`. **Changements de sens** : `pointBasTresorerie` (avant : an 1) porte sur tout l'horizon et gagne `an` et `moisDansAn` ; `moisDeficitaires`, `moisTresorerieNegative`, `verdict.tresorerieToujoursPositive` et le statut portent sur tout l'horizon ; `van` peut être `null` ; `HORIZON_PAR_DEFAUT` n'est plus le défaut du moteur ; un investissement de durée de vie plus courte que l'horizon est renouvelé.

**Contrôles.** `HORIZON_INSUFFISANT` (nouveau : horizon plus court que le crédit = alerte, plus court que le plein régime = info). `PERIODE_IMPRODUCTIVE` change de sens : le moteur compte désormais zéro vente avant l'année d'entrée en production (`info`, valeurs `anneesSansProduction`), alerte si l'entrée tombe après l'horizon ; `anneesSurestimees` disparaît. `TRESORERIE_NEGATIVE` parle de tout le plan.

**Moteurs autonomes.** `bandes.ts`, `troupeau.ts` (M14) et `financement.ts` (M6) gardent leur grille mensuelle (mois 0 = démarrage, mois 1 à N, mêmes conventions que la grille de M1). Leur raccord à la grille est décrit dans « Raccord des moteurs autonomes » (service Cultiplan).

## Limites connues (moteur 2.0.0)

Prélèvements du ménage constants sur l'horizon (sans hausse) ; un seul crédit tiré dans `calculerFinances` (les prêts multiples, crédits de campagne et subventions sont dans `financement.ts`) ; pas de fiscalité calculée ; pas de valeur résiduelle dans la VAN ; le coefficient d'un cycle suit l'année du mois où le montant tombe. Voir `Cultiso/2_Pilotage/03_Produit-et-technologie/ANALYSE-RESSOURCES-MODELISATION.md` §3.3.

## Raccord des moteurs autonomes et service Cultiplan (moteur 2.0.0)

**Séries mensuelles.** Une ligne de charge d'exploitation ou de revenu peut porter `serieMensuelle { debutMois (1 au moins), montants[], origine? }` : `montants[k]` (FCFA, prix et hausses déjà compris) tombe au mois `debutMois + k`. Elle remplace quantité, prix, calendrier, hausse et montée en production de la ligne (`quantite` = 1 et `prixUnitaire` = total, par convention). Ce qui dépasse l'horizon n'est pas compté.

**`src/moteurs/raccord.ts`** (pur) : `lignesDepuisBandes(resultatBandes, { prefixe, atelierId?, decalageMois?, dureeVieAns? })` et `lignesDepuisTroupeau(resultatTroupeau, { prefixe, atelierId?, decalageMois? })` renvoient `{ charges, revenus, avertissements }` à passer à `calculerFinances`. Test de garde : la trésorerie de la grille (`tresorerieMensuelle[m].solde`) est **identique mois par mois** à celle du moteur à bandes ou du cheptel, et le point bas aussi. L'investissement du mois 0 devient une ligne d'investissement amortie sur `dureeVieAns` ; **sans durée de vie** (aucune n'est devinée), il est compté comme une charge d'exploitation du mois 1 et `avertissements` le dit. `CONSOMMATION_BANDE` n'a plus d'objet pour un atelier raccordé : la consommation est calculée par les courbes d'âge. `financement.ts` (M6) garde ses flux séparés (mêmes mois 0 à N) : le service les additionne à la trésorerie, `calculerFinances` ne les absorbe pas.

**Référentiel calendaire (`ref`, migrations locales `20261127200000_ref_itineraires_calendaires.sql` et `20261127210000_ref_profil_pluriannuel.sql`, non appliquées en ligne).** `ref.fiche_technique` (densité, eau par phase et par système, fumure de fond et de couverture datée, pertes après récolte, conservation, délais de repiquage et de récolte ; valeur ou fourchette, source, date, statut), `ref.itineraire_mensuel` (part des coûts par type de charge, heures par unité d'échelle, part de la récolte, par mois de cycle ; la somme de chaque profil doit valoir 1 sinon il est écarté et signalé), `ref.profils_speculation` (annuelle, pérenne ou cheptel ; mois improductifs et années de plein régime quand la source les donne), `ref.profil_pluriannuel` (coefficient de rendement et taux d'utilisation par année). Lecture : `src/referentiel/calendrier.ts` (`lireFichesTechniques`, `lireItinerairesMensuels`, `lireProfilsPluriannuels`). **Données saisies** : la fiche de l'oignon (DOC-00015 p. 15-21, Sénégal, `brouillon_ia`), la pondeuse en `cheptel` avec 6 mois improductifs (DOC-00136 p. 3) et l'oignon en `annuelle`. **Aucun profil mensuel ni coefficient par année n'est saisi** : le lot n'en donne pas.

**Service Cultiplan.** `genererPlan` lit le référentiel calendaire des spéculations des ateliers (`src/modules/cultiplan/calendrier.ts`) : un itinéraire mensuel est posé sur les lignes par cycle de l'atelier (`champs_controle.calendrier`), un profil pérenne ou cheptel oblige la déclaration (`perenne`, l'année d'entrée étant déduite des mois improductifs de la source, sinon laissée à déclarer), les coefficients par année deviennent `hypotheses.montee`. Plusieurs variantes pour une spéculation : rien n'est arbitré, `generation.calendrier.aChoisir` les liste. Tables absentes en ligne : lecture tolérante, `generation.calendrier.notes` le dit et le plan garde l'ancien calendrier. Nouveautés d'interface (voir aussi les tableaux d'entrées) :

- `Hypotheses` : `horizonAnnees` (1 à **10**), `horizonMois` (null), `horizonCycles` (null), `montee[]` ; `Financement.moisTirageCredit` (0) ; les routes qui acceptent des hypothèses ou un financement acceptent ces champs.
- `ResumePlan.moteurObsolete` : vrai si la version **majeure** du moteur du plan est plus ancienne que l'actuelle. `recalculerPlansObsoletes(client)` recalcule les brouillons obsolètes et renvoie `{ recalcules, marques, echecs }` ; les plans lancés ou archivés sont figés : seulement **marqués**, à dupliquer pour obtenir une variante recalculée.
- `Plan.generation.calendrier { notes[], aChoisir[] }`.
- Lecture du résultat : `scenarios.*.tresorerieMensuelle` (mois 0 à N, à préférer à `tresorerieMensuelleAn1`), `scenarios.*.grille.lignes[]`, `scenarios.*.investissementsDates`, `scenarios.*.horizon`, `scenarios.*.pointBasSansFinancement` ; **`van`, `tri` et `delaiRecuperationAns` peuvent être `null`** (horizon de moins de deux années complètes) ; `ResultatScenario`, `AnneeResultat`, `PointBas` sont exportés par `@/moteurs`.
- Outils de Cultisia : `horizonAnnees` va jusqu'à 10, le défaut reste `HORIZON_PAR_DEFAUT` (3).

**Atelier animal ou cheptel dans le plan.** `POST /api/cultiplan/plans/:id/atelier-animal` (`src/modules/cultiplan/atelier-plan.ts`, `raccorderAtelierAuPlan`) : corps `{ type: "bandes", nom, speculation, atelierId?, decalageMois?, dureeVieInvestissement?: { valeur, source }, ...paramètres de /elevage/bandes }` ou `{ type: "troupeau", nom, atelierId?, decalageMois?, ...paramètres de /elevage/troupeau }`. Plan en brouillon seulement. Le service simule, passe par `lignesDepuisBandes` / `lignesDepuisTroupeau`, range les lignes dans le plan (série mensuelle dans `champs_controle.serieMensuelle`, libellé « nom : ... ») et recalcule : la trésorerie du plan est identique, mois par mois, à celle du moteur autonome (test de garde). Raccorder à nouveau le même `nom` **remplace** ses lignes (les nouvelles sont ajoutées avant de retirer les anciennes). Atelier non évalué (courbe ou durée sans source) : `statut: "non_evalue"`, `manques[]`, plan intact. Réponse : `{ statut, plan, lignes { ajoutees, remplacees }, dureeVie, manques, avertissements, simulation }`.

**Durée de vie de l'investissement d'une bande** (`src/referentiel/duree-vie.ts`). Ordre : 1) `dureeVieInvestissement` de l'appelant (avec sa source) ; 2) la durée du référentiel (`ref.modeles_charges`, classe investissement) **si toutes les lignes d'investissement de la spéculation ont la même** (source et statut repris dans `dureeVie`) ; 3) sinon aucune : l'achat est compté comme une charge du mois 1, non amorti, et `manques` dit pourquoi. Plusieurs durées (bâtiment 10 ans, matériel 5 ans pour la pondeuse) : jamais de moyenne, la durée est demandée, car l'investissement d'une bande est un seul montant.

**Financement détaillé (M6) dans la trésorerie du plan.** `POST /plans/:id/financement` renvoie en plus `tresorerie { mois[] { mois, exploitation, financement, retenuesAcheteur, solde, cumul }, pointBas, moisTresorerieNegative, notes }` (`additionnerFinancement`). Exploitation = le plan recalculé **sans** son apport ni son crédit simples (sinon ils seraient comptés deux fois) ; financement = `flux` de M6 ; moins les retenues de l'acheteur. Contrat de M6 inchangé (champ ajouté, rien retiré) ; `calculerFinances` ne change pas. L'horizon par défaut du financement est celui du plan (`horizon.mois` du scénario). Horizons différents : partie commune et `notes`.

**Ce qui reste hors de portée des contrôles du §3.6 (état au 27/11/2026, moteur 2.0.0).** `INTRANTS_ECART_ITINERAIRE` : le mécanisme est prêt côté moteur (`referenceItineraire`) et la fiche de l'oignon donne des doses par hectare, mais aucun modèle de charge du référentiel n'est dans une unité comparable (« forfait ») : rien ne l'alimente. `MAIN_OEUVRE_SAISONNIERE` et `MASSE_SALARIALE` : besoins en heures par mois de `ref.itineraire_mensuel` (vide) et main d'oeuvre R2. `VOLUME_HORS_DEBOUCHE` : R3. Seuils de `seuilsControles` : aucune source.

## Branchement du financement détaillé et du travail familial (moteur 2.1.0)

`calculerFinances({ financement, travailFamilial })`. `financement` = `financementPourMoteur(calculerFinancement(...).mois)` : par mois (0 à N) `apportEspeces`, `tirages` (prêts, campagne, chaîne, avances), `subventionsEncaissees` (nettes des avances), `interets`, `taxeInterets`, `capital` (retenue de l'acheteur comprise), `repriseSubventions`. **Aucun double comptage** : quand `financement` est présent, la grille ne tire plus rien de `apport` ni de `credit` (ils ne servent qu'aux contrôles et aux ratios) ; la retenue de l'acheteur est déjà dans `capital` et `interets` et ne se retranche pas des ventes. Un mois au-delà de l'horizon n'est pas compté (`avertissements`). Trésorerie : entrées = apport + tirages + subventions + ventes ; sorties = intérêts + taxe + capital + charges. Résultat : les frais financiers (intérêts + taxe) se retranchent, la reprise des subventions s'ajoute (produit non encaissé, donc retirée de la CAF). `travailFamilial { montantAnnuel }` (`valorisationFamille.montantAn` de R2) est réparti sur les 12 mois : il alimente `annees[].travailFamilial` et `resultatApresTravailFamilial` (coût de revient complet) et ne touche **jamais** la trésorerie, le résultat, la CAF ni la VAN. Limites : montant constant d'une année à l'autre (pas de hausse), pas de coût de revient par unité vendue dans le moteur financier (il reste dans la sortie de `calculerMainOeuvre`).
