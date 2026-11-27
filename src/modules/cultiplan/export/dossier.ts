// Dossier de financement (S4) : 14 parties dans l'ordre du canevas ANPGF, complétées par le guide MAPAQ et le modèle tunisien
// (ANALYSE-BASE-RESSOURCES §5.3). Texte rédigé ici ; chiffres lus dans les sorties des moteurs. Registre : impersonnel (le dossier est
// lu par un financeur). Une rubrique que le porteur doit rédiger et qui manque est signalée « à compléter », jamais inventée.
import { lexique } from "@/moteurs";
import { fcfa, nombre, nomMois, moisN, pct, dateFr, STATUTS_LISIBLES } from "./format";
import type { LigneChargePlan } from "../lignes";
import { listerPieces } from "./pieces";
import type { Bloc, DocumentExport, DonneesDossier, SectionDocument } from "./types";

const A_COMPLETER = "À compléter par le porteur.";

/** Un texte rédigé, ou la mention « à compléter » (et la trace dans la liste finale). */
function texte(valeur: string | undefined, rubrique: string, manques: string[]): Bloc {
  if (valeur && valeur.trim().length > 0) return { type: "paragraphe", texte: valeur.trim() };
  manques.push(rubrique);
  return { type: "alerte", niveau: "info", texte: `${A_COMPLETER} (${rubrique})` };
}

export function construireDossier(d: DonneesDossier): DocumentExport {
  const anpgf = d.financeur?.pays === "TG";
  const renvoi = (ref: string) => (anpgf ? ` (canevas ANPGF ${ref})` : "");
  const r = d.scenario;
  const an1 = r.annees[0];
  const manques: string[] = [];
  const sections: SectionDocument[] = [];

  const invest = d.lignes.filter((l): l is LigneChargePlan => l.sens === "charge" && l.classe === "investissement");
  const sensibilite = d.resultats.sensibilite;
  const pret = d.financement.planInitial.ressources.find((x) => x.libelle === "Prêts");
  const montantPret = pret?.montant ?? 0;
  const creditPlan = d.credit;
  const regle = d.financeur;
  const partApport = d.financement.apport.partApport;

  // ---------------------------------------------------------------- 1. Lettre de présentation
  sections.push({
    numero: "",
    titre: "Lettre de présentation",
    nouvellePage: true,
    blocs: [
      { type: "paragraphe", texte: `Objet : demande de financement du projet « ${d.titrePlan} »${regle ? ` auprès de ${regle.organisme} (${regle.libelle})` : ""}.` },
      { type: "paragraphe", texte: regle ? `À l'attention de ${regle.organisme},` : "À l'attention du financeur," },
      {
        type: "paragraphe",
        texte: `Le promoteur${d.promoteur.nom ? `, ${d.promoteur.nom},` : ""} sollicite un financement pour le projet « ${d.exploitation.nom} »${d.exploitation.lieu ? `, situé à ${d.exploitation.lieu}` : ""}. Le projet représente un coût total de ${fcfa(d.financement.planInitial.totalEmplois)}, dont ${fcfa(d.financement.planInitial.emplois[0]?.montant)} d'investissements et ${fcfa(d.financement.planInitial.emplois[1]?.montant)} de besoin en fonds de roulement.`,
      },
      {
        type: "paragraphe",
        texte: `Le promoteur apporte ${fcfa(d.financement.apport.total)}${partApport !== null ? `, soit ${pct(partApport)} du coût du projet` : ""}${regle?.apportMinimum != null ? `, pour un minimum de ${pct(regle.apportMinimum, 0)} indiqué par ${regle.organisme}${partApport !== null && partApport + 1e-9 >= regle.apportMinimum ? " (minimum atteint)" : " (minimum non atteint)"}` : ""}.${montantPret > 0 ? ` Le financement demandé s'élève à ${fcfa(montantPret)}${creditPlan ? `, remboursable sur ${creditPlanDuree(d)} dont ${differe(d)} de différé` : ""}.` : ""}`,
      },
      {
        type: "paragraphe",
        texte: `Sur la base du scénario réaliste, l'exploitation dégage un chiffre d'affaires de ${fcfa(an1.chiffreAffaires)} et un résultat de ${fcfa(an1.resultat)} dès la première année${r.verdict.menageCouvert === null ? "" : r.verdict.menageCouvert ? ", après avoir couvert les besoins du ménage et les échéances du crédit" : ", mais les besoins du ménage et les échéances ne sont pas couverts toutes les années : le dossier le montre en toute transparence"}. La valeur actuelle nette est de ${fcfa(r.van)}${r.tri === null ? "" : ` et le taux de rentabilité interne de ${pct(r.tri)}`}.`,
      },
      { type: "paragraphe", texte: "Les tableaux de ce dossier sont calculés par les moteurs de calcul de Cultiso à partir des hypothèses détaillées en partie 13 ; le texte a été rédigé par le promoteur ou relu par lui. Le promoteur reste à votre disposition pour tout complément." },
      { type: "paragraphe", texte: `Fait le ${dateFr(d.genereLe)}${d.promoteur.nom ? `, ${d.promoteur.nom}` : ""}.` },
    ],
  });

  // ---------------------------------------------------------------- 2. Fiche synoptique
  const effectif = d.promoteur.effectif ?? (d.mainOeuvre ? `${nombre(d.mainOeuvre.totaux.besoinHeures)} heures de travail par an` : undefined);
  sections.push({
    numero: "1.1",
    titre: `Fiche synoptique du projet${renvoi("§1.1")}`,
    nouvellePage: true,
    blocs: [
      {
        type: "cle_valeur",
        lignes: [
          ["Titre du projet", d.titrePlan],
          ["Dénomination, forme juridique", d.redaction.formeJuridique ?? "à compléter"],
          ["N° RCCM", d.promoteur.rccm ?? "à compléter"],
          ["Domaine d'activité", d.exploitation.ateliers.map((a) => a.libelle ?? a.speculationCode).join(", ") || "n.d."],
          ["Localisation", d.exploitation.lieu ?? "à compléter"],
          ["Contacts", d.promoteur.contacts ?? "à compléter"],
          ["Effectif / travail", effectif || "à compléter"],
          ["Promoteur", d.promoteur.nom ?? "à compléter"],
          ["Adresse du promoteur", d.promoteur.adresse ?? "à compléter"],
          ["Coût du projet", `Investissements : ${fcfa(d.financement.planInitial.emplois[0]?.montant)} ; fonds de roulement : ${fcfa(d.financement.planInitial.emplois[1]?.montant)} ; total : ${fcfa(d.financement.planInitial.totalEmplois)}`],
          ["Schéma de financement", `Apport du promoteur : ${fcfa(d.financement.apport.total)}${partApport !== null ? ` (${pct(partApport)})` : ""} ; financement demandé : ${fcfa(montantPret)}`],
          ["Modalités de l'emprunt", creditPlan ? `Durée : ${d.hypotheses ? creditPlanDuree(d) : "n.d."} ; différé : ${differe(d)}` : "Sans emprunt"],
          ["Chiffre d'affaires (an 1)", fcfa(an1.chiffreAffaires)],
          ["Résultat net (an 1)", fcfa(an1.resultat)],
          ["Revenu disponible du ménage (an 1)", r.verdict.menageCouvert === null ? "non évalué (ménage non renseigné)" : `solde résiduel ${fcfa(an1.soldeResiduel)} après prélèvements et échéances`],
          ["Indicateurs de rentabilité", `VAN : ${fcfa(r.van)} ; TRI : ${r.tri === null ? "non calculable" : pct(r.tri)}${d.hypotheses.horizonAnnees < 3 ? " (horizon court : à lire avec prudence)" : ""}`],
        ],
      },
    ],
  });
  if (!d.promoteur.nom) manques.push("Nom du promoteur");
  if (!d.promoteur.contacts) manques.push("Contacts du promoteur");
  if (!d.redaction.formeJuridique) manques.push("Forme juridique");

  // ---------------------------------------------------------------- 3. Résumé
  sections.push({
    numero: "",
    titre: "Résumé du projet",
    blocs: [
      { type: "paragraphe", texte: `Le projet consiste en ${d.redaction.descriptionProjet ? d.redaction.descriptionProjet.trim().replace(/^./, (c) => c.toLowerCase()) : `une exploitation (${d.exploitation.ateliers.map((a) => `${a.libelle ?? a.speculationCode}, ${nombre(a.taille, 2)} ${a.unite}`).join(" ; ") || "ateliers à préciser"})`}.` },
      { type: "paragraphe", texte: `Les moteurs de calcul concluent à un projet « ${libelleStatut(r.statut)} » : rentabilité cumulée de ${pct(r.rentabilite)}, trésorerie ${r.verdict.tresorerieToujoursPositive ? "toujours positive" : `négative aux mois ${r.moisTresorerieNegative.join(", ")}`} la première année, point bas à ${fcfa(r.pointBasTresorerie.montant)} (${moisN(r.pointBasTresorerie.mois)}).` },
      ...(r.seuilCommercialisation.coefficientPrix !== null
        ? [{ type: "paragraphe" as const, texte: `Seuil de commercialisation : les prix de vente couvrent toutes les charges décaissées, les échéances et les besoins du ménage tant qu'ils ne descendent pas sous ${pct(r.seuilCommercialisation.coefficientPrix)} des prix prévus (année ${r.seuilCommercialisation.an}).` }]
        : []),
      ...(blocsAlertes(r.controles, 3)),
    ],
  });

  // ---------------------------------------------------------------- 4. Le porteur et son existant
  const v = (c: Parameters<typeof valeurProfil>[1]) => valeurProfil(d, c);
  sections.push({
    numero: "1.2 - 3",
    titre: `Le porteur et son existant${renvoi("§2.4, §3")}`,
    nouvellePage: true,
    blocs: [
      texte(d.redaction.contexteEtJustification, "Contexte et justification du projet", manques),
      texte(d.redaction.descriptionEntreprise, "Description de l'entreprise", manques),
      texte(d.redaction.objectif, "Objectif de l'entreprise", manques),
      {
        type: "cle_valeur",
        lignes: [
          ["Terre", `${v("terreSurfaceHa")} ha ; statut foncier : ${v("terreStatut")} ; pièce : ${v("terrePiece")}`],
          ["Eau", `${v("eauSource")}, ${v("eauSaison")}`],
          ["Temps", `${v("tempsEngagement")}${v("tempsAutreActivite") !== "non renseigné" ? `, autre activité : ${v("tempsAutreActivite")}` : ""}`],
          ["Main d'oeuvre familiale", `${v("familleActifs")} actif(s), ${v("familleHeuresSemaine")} heures par semaine`],
          ["Savoir-faire", `technique : ${v("competenceTechnique")} ; gestion : ${v("competenceGestion")} ; vente : ${v("competenceVente")}`],
          ["Ménage", `${v("menagePersonnes")} personne(s) ; coût de vie annuel : ${d.hypotheses.prelevementsAnnuels === null ? "non renseigné" : fcfa(d.hypotheses.prelevementsAnnuels)} ; revenus extérieurs : ${fcfa(d.hypotheses.revenusExterieursAnnuels)}`],
          ["Apport", `espèces : ${fcfa(d.financement.apport.especes)} ; en nature (avec pièce) : ${fcfa(d.financement.apport.natureRetenu)}${d.financement.apport.natureNonRetenu > 0 ? ` ; en nature sans pièce, non compté : ${fcfa(d.financement.apport.natureNonRetenu)}` : ""}`],
        ],
      },
      ...(d.profil.existant.length > 0
        ? [
            {
              type: "tableau" as const,
              legende: "Existant déclaré",
              entetes: ["Catégorie", "Désignation", "Quantité", "État", "Valeur estimée"],
              lignes: d.profil.existant.map((e) => [e.categorie, e.libelle, e.quantite != null ? nombre(e.quantite) : "n.d.", e.etat ?? "n.d.", e.valeurEstimeeFcfa != null ? fcfa(e.valeurEstimeeFcfa) : "n.d."]),
            },
          ]
        : [{ type: "paragraphe" as const, texte: d.profil.sansExistant ? "Le porteur déclare ne rien posséder qui serve au projet." : "L'existant n'a pas été renseigné." }]),
    ],
  });

  // ---------------------------------------------------------------- 5. Étude de marché (débouchés)
  const marche: Bloc[] = [texte(d.redaction.produitsEtServices, "Présentation des produits et services", manques)];
  if (d.debouches) {
    const db = d.debouches;
    marche.push({
      type: "tableau",
      legende: `Débouchés de ${db.produit} (volume vendable : ${nombre(db.volumeVendableAn)} ${db.unite} par an)`,
      entetes: ["Circuit", "Acheteur", "Part", `Volume (${db.unite})`, "Prix moyen", "Recettes", "Part des recettes"],
      lignes: db.circuits.map((c) => [c.libelle, c.client ?? "non nommé", pct(c.part, 0), nombre(c.volume), fcfa(c.prixMoyen), fcfa(c.recettes), pct(c.partRecettes, 0)]),
    });
    if (db.volumeNonVendu > 0) marche.push({ type: "alerte", niveau: "alerte", texte: `${nombre(db.volumeNonVendu)} ${db.unite} (${pct(db.partNonVendue)}) n'ont pas de débouché et ne sont pas comptés dans les recettes.` });
    for (const c of db.contrats) {
      marche.push({ type: "paragraphe", texte: `Contrat avec ${c.acheteur} : ${nombre(c.volumeFixe)} ${db.unite} par an à ${fcfa(c.prixFixe)} l'unité, services déduits ${fcfa(c.servicesDeduitsParUnite)} l'unité, soit ${fcfa(c.paiementNetParUnite)} reçus net par unité.` });
    }
    const saisons = db.circuits.filter((c) => c.prixMax > c.prixMin);
    if (saisons.length > 0) {
      marche.push({
        type: "tableau",
        legende: "Prix par mois (saisonnalité)",
        entetes: ["Circuit", ...Array.from({ length: 12 }, (_, i) => `M${i + 1}`)],
        lignes: saisons.map((c) => [c.libelle, ...c.prixParMois.map((p) => (p === null ? "-" : nombre(p)))]),
      });
    }
  } else {
    marche.push({ type: "tableau", legende: "Ventes prévues (scénario réaliste)", entetes: ["Produit", "Quantité", "Prix unitaire", "Chiffre d'affaires"], lignes: ventes(d) });
  }
  marche.push(texte(d.redaction.concurrence, "Évaluation de la concurrence", manques), texte(d.redaction.positionnement, "Positionnement de l'entreprise", manques), texte(d.redaction.strategieCommerciale, "Stratégie commerciale (prix, place, promotion)", manques));
  sections.push({ numero: "4 - 6", titre: `Étude de marché${renvoi("§4, §6")}`, nouvellePage: true, blocs: marche });

  // ---------------------------------------------------------------- 6. Étude technique
  const technique: Bloc[] = [texte(d.redaction.descriptionProjet, "Description du projet", manques)];
  technique.push({
    type: "tableau",
    legende: "Investissements",
    entetes: ["Désignation", "Quantité", "Prix unitaire", "Montant", "Durée de vie (ans)"],
    lignes: [
      ...invest.map((l) => [l.libelle, nombre(l.quantite, 2), fcfa(l.prixUnitaire), fcfa(l.quantite * l.prixUnitaire * l.frequence), l.dureeVieAns !== null ? nombre(l.dureeVieAns, 1) : "n.d."]),
      ["TOTAL INVESTISSEMENT", "", "", fcfa(d.resultats.investissementTotal), ""],
    ],
    gras: [invest.length],
  });
  if (d.mainOeuvre) {
    const m = d.mainOeuvre;
    technique.push({
      type: "paragraphe",
      texte: `Main d'oeuvre : ${nombre(m.totaux.besoinHeures)} heures de travail par an, dont ${nombre(m.totaux.heuresFamilleUtilisees)} fournies par la famille et ${nombre(m.totaux.heuresSalarieesUtilisees)} par des salariés ou des saisonniers. Mois le plus chargé : ${nomMois(m.moisLePlusCharge.mois)} (${nombre(m.moisLePlusCharge.besoinHeures)} heures).${m.pointes.length > 0 ? ` Pointes de travail non couvertes aux mois ${m.pointes.map((p) => p.mois).join(", ")}.` : ""}`,
    });
    if (m.valorisationFamille.montantAn !== null) technique.push({ type: "paragraphe", texte: `Le travail de la famille, valorisé au prix du marché (${fcfa(m.valorisationFamille.prixHeure)} l'heure, source : ${m.valorisationFamille.source}), représente ${fcfa(m.valorisationFamille.montantAn)} par an. Il entre dans le coût de revient mais pas dans la trésorerie.` });
  }
  technique.push({
    type: "tableau",
    legende: "Calendrier de réalisation",
    entetes: ["Étape", "Début (mois)", "Fin (mois)"],
    lignes: (d.redaction.calendrier ?? []).map((c) => [c.etape, String(c.debutMois), String(c.finMois)]),
  });
  if (!d.redaction.calendrier || d.redaction.calendrier.length === 0) {
    technique.pop();
    manques.push("Calendrier de réalisation du projet");
    technique.push({ type: "alerte", niveau: "info", texte: `${A_COMPLETER} (calendrier de réalisation : en attendant le calendrier cultural du référentiel)` });
  }
  sections.push({ numero: "2, 5", titre: `Étude technique${renvoi("§2, §5")}`, nouvellePage: true, blocs: technique });

  // ---------------------------------------------------------------- 7. Étude financière
  const f: Bloc[] = [];
  f.push({
    type: "tableau",
    legende: `Schéma de financement initial${renvoi("§10.1")}`,
    entetes: ["Rubrique", "Montant"],
    lignes: [
      ["EMPLOIS", ""],
      ...d.financement.planInitial.emplois.map((e) => [e.libelle, fcfa(e.montant)]),
      ["TOTAL EMPLOIS", fcfa(d.financement.planInitial.totalEmplois)],
      ["RESSOURCES", ""],
      ...d.financement.planInitial.ressources.map((e) => [e.libelle, `${fcfa(e.montant)} (${pct(d.financement.planInitial.partsRessources.find((p) => p.libelle === e.libelle)?.part ?? null, 0)})`]),
      ["TOTAL RESSOURCES", fcfa(d.financement.planInitial.totalRessources)],
    ],
    // EMPLOIS (0), TOTAL EMPLOIS, RESSOURCES, TOTAL RESSOURCES
    gras: [0, 1 + d.financement.planInitial.emplois.length, 2 + d.financement.planInitial.emplois.length, 2 + d.financement.planInitial.emplois.length + 1 + d.financement.planInitial.ressources.length],
  });
  f.push({ type: "paragraphe", texte: `Besoin en fonds de roulement : ${fcfa(r.besoinFondsRoulement)}, correspondant au creux de la trésorerie d'exploitation.` });
  if (d.credit) {
    const parAn = new Map<number, { interets: number; amortissement: number; echeance: number; restant: number }>();
    for (const e of d.credit.echeancier) {
      const an = Math.ceil(e.mois / 12);
      const x = parAn.get(an) ?? { interets: 0, amortissement: 0, echeance: 0, restant: 0 };
      x.interets += e.interets;
      x.amortissement += e.amortissement;
      x.echeance += e.echeance;
      x.restant = e.capitalRestantDebut - e.amortissement;
      parAn.set(an, x);
    }
    f.push({
      type: "tableau",
      legende: `Échéancier du prêt (annuel)${renvoi("§10.3")}`,
      entetes: ["Année", "Intérêts", "Capital remboursé", "Annuité", "Capital restant dû"],
      lignes: [...parAn.entries()].map(([an, x]) => [String(an), fcfa(x.interets), fcfa(x.amortissement), fcfa(x.echeance), fcfa(Math.max(x.restant, 0))]),
    });
    f.push({ type: "paragraphe", texte: `Mensualité : ${fcfa(d.credit.mensualite)} ; coût total du crédit : ${fcfa(d.credit.coutTotal)}.` });
  }
  if (d.financement.annees.some((a) => a.taxeInterets > 0)) f.push({ type: "paragraphe", texte: `Taxe sur les intérêts incluse dans les frais financiers (${fcfa(d.financement.annees.reduce((s, a) => s + a.taxeInterets, 0))} sur l'horizon).` });
  f.push({
    type: "tableau",
    legende: `Compte d'exploitation prévisionnel${renvoi("§10.6")} (scénario réaliste)`,
    entetes: ["Rubrique", ...r.annees.map((a) => `An ${a.an}`)],
    lignes: [
      ["Chiffre d'affaires", ...r.annees.map((a) => fcfa(a.chiffreAffaires))],
      ["Charges variables", ...r.annees.map((a) => fcfa(a.chargesVariables))],
      ["Marge brute", ...r.annees.map((a) => fcfa(a.margeBrute))],
      ["Charges fixes (salaires compris)", ...r.annees.map((a) => fcfa(a.chargesFixes))],
      ["Excédent brut d'exploitation", ...r.annees.map((a) => fcfa(a.excedentBrut))],
      ["Amortissements", ...r.annees.map((a) => fcfa(a.amortissements))],
      ["Intérêts", ...r.annees.map((a) => fcfa(a.interets))],
      ["Impôts et taxes", ...r.annees.map((a) => fcfa(a.impots))],
      ["Résultat", ...r.annees.map((a) => fcfa(a.resultat))],
      ["Capacité d'autofinancement nette", ...r.annees.map((a) => fcfa(a.cafNette))],
    ],
    gras: [4, 8],
  });
  f.push({
    type: "tableau",
    legende: `Budget de trésorerie mensuel, mois 0 à ${d.tresorerie.horizonMois}${renvoi("§10.7")}`,
    entetes: ["Mois", "Entrées", "Sorties", "Prélèvements ménage", "Solde", "Cumul", "Retrait possible"],
    lignes: d.tresorerie.mois.map((m) => [m.mois === 0 ? "Démarrage" : `Mois ${m.mois}`, fcfa(m.entrees), fcfa(m.sorties), fcfa(m.prelevementsNets), fcfa(m.solde), fcfa(m.cumul), fcfa(m.retraitPossible)]),
  });
  f.push({ type: "paragraphe", texte: `Point bas de la trésorerie : ${fcfa(d.tresorerie.pointBas.montant)} (${moisN(d.tresorerie.pointBas.mois)}). ${d.tresorerie.moisDeficitaires.length > 0 ? `Mois dont le solde est négatif : ${d.tresorerie.moisDeficitaires.map((m) => `mois ${m}`).join(", ")}.` : "Aucun mois n'a de solde négatif."}` });
  f.push({
    type: "tableau",
    legende: `Plan de financement annuel${renvoi("§10.8")}`,
    entetes: ["Élément", ...d.financement.planAnnuel.map((a) => `An ${a.an}`)],
    lignes: [
      ["Trésorerie initiale", ...d.financement.planAnnuel.map((a) => fcfa(a.tresorerieInitiale))],
      ["Capacité d'autofinancement", ...d.financement.planAnnuel.map((a) => fcfa(a.ressources.caf))],
      ["Apports en capital", ...d.financement.planAnnuel.map((a) => fcfa(a.ressources.apportsCapital))],
      ["Subventions d'investissement", ...d.financement.planAnnuel.map((a) => fcfa(a.ressources.subventionsInvestissement))],
      ["Emprunts", ...d.financement.planAnnuel.map((a) => fcfa(a.ressources.emprunts))],
      ["TOTAL RESSOURCES", ...d.financement.planAnnuel.map((a) => fcfa(a.ressources.total))],
      ["Acquisitions d'immobilisations", ...d.financement.planAnnuel.map((a) => fcfa(a.emplois.acquisitionsImmobilisations))],
      ["Remboursement d'emprunts", ...d.financement.planAnnuel.map((a) => fcfa(a.emplois.remboursementEmprunts))],
      ["Augmentation du BFR", ...d.financement.planAnnuel.map((a) => fcfa(a.emplois.augmentationBfr))],
      ["TOTAL EMPLOIS", ...d.financement.planAnnuel.map((a) => fcfa(a.emplois.total))],
      ["Variation de trésorerie", ...d.financement.planAnnuel.map((a) => fcfa(a.variationTresorerie))],
      ["Trésorerie finale", ...d.financement.planAnnuel.map((a) => fcfa(a.tresorerieFinale))],
    ],
    gras: [5, 9, 11],
  });
  f.push({ type: "alerte", niveau: "info", texte: "Le bilan prévisionnel au format SYSCOHADA (§10.9) n'est pas produit : le moteur de bilan n'est pas encore réalisé. Il sera joint par l'expert-comptable ou ajouté avec ce moteur." });
  manques.push("Bilan prévisionnel SYSCOHADA (moteur de bilan non réalisé)");
  f.push({
    type: "tableau",
    legende: "Seuil de rentabilité et seuil de commercialisation",
    entetes: ["Indicateur", "Valeur"],
    lignes: [
      ["Chiffre d'affaires au seuil de rentabilité", r.seuilRentabilite.chiffreAffaires === null ? "non atteint" : fcfa(r.seuilRentabilite.chiffreAffaires)],
      ["Mois d'atteinte du seuil", r.seuilRentabilite.moisAtteint === null ? "n.d." : nomMois(r.seuilRentabilite.moisAtteint)],
      ["Besoin à couvrir (charges, impôts, échéances, ménage)", fcfa(r.seuilCommercialisation.besoinAnnuel)],
      ["Prix minimum / prix prévus", pct(r.seuilCommercialisation.coefficientPrix)],
      ["Délai de récupération", r.delaiRecuperationAns === null ? "au-delà de l'horizon" : `${nombre(r.delaiRecuperationAns, 1)} an(s)`],
    ],
  });
  f.push({
    type: "tableau",
    legende: "Revenu du ménage et capacité de remboursement",
    entetes: ["Rubrique", ...r.annees.map((a) => `An ${a.an}`)],
    lignes: [
      ["Prélèvements nets du ménage", ...r.annees.map((a) => fcfa(a.prelevementsNets))],
      ["Capacité de remboursement", ...r.annees.map((a) => fcfa(a.capaciteRemboursement))],
      ["Annuités", ...r.annees.map((a) => fcfa(a.annuites))],
      ["Solde résiduel", ...r.annees.map((a) => fcfa(a.soldeResiduel))],
    ],
    gras: [3],
  });
  f.push({
    type: "tableau",
    legende: "Ratios",
    entetes: ["Ratio", "Valeur"],
    lignes: [
      ["Part d'apport (apport / coût du projet)", pct(r.ratios.partApport)],
      ["Endettement (crédit / apport)", r.ratios.endettement === null ? "n.d." : nombre(r.ratios.endettement, 2)],
      ["Dettes / capacité d'autofinancement", r.ratios.dettesSurCaf === null ? "n.d." : `${nombre(r.ratios.dettesSurCaf, 1)} an(s)`],
      ["Charges financières / chiffre d'affaires", pct(r.ratios.chargesFinancieresSurCA)],
    ],
  });
  sections.push({ numero: "10", titre: `Étude financière${renvoi("§10")}`, nouvellePage: true, blocs: f });

  // ---------------------------------------------------------------- 8. Scénarios et sensibilité
  const sc = d.resultats.scenarios;
  const s: Bloc[] = [
    {
      type: "tableau",
      legende: "Trois scénarios",
      entetes: ["Scénario", "CA an 1", "Résultat an 1", "VAN", "TRI", "Point bas", "Statut"],
      lignes: (["pessimiste", "realiste", "optimiste"] as const).map((k) => [k === "realiste" ? "Réaliste" : k === "pessimiste" ? "Pessimiste" : "Optimiste", fcfa(sc[k].annees[0].chiffreAffaires), fcfa(sc[k].annees[0].resultat), fcfa(sc[k].van), sc[k].tri === null ? "n.d." : pct(sc[k].tri), fcfa(sc[k].pointBasTresorerie.montant), libelleStatut(sc[k].statut)]),
    },
    {
      type: "tableau",
      legende: "Effet d'une variation de chaque hypothèse sur le résultat cumulé",
      entetes: ["Hypothèse", "Variation", "Résultat cumulé", "Écart", "Point bas"],
      lignes: sensibilite.variations.map((x) => [x.hypothese, pct(x.variation, 0), fcfa(x.resultatCumule), fcfa(x.ecartResultat), fcfa(x.pointBasTresorerie)]),
    },
    { type: "paragraphe", texte: `Hypothèses classées de la plus à la moins influente : ${sensibilite.classement.join(", ")}.` },
    {
      type: "paragraphe",
      texte: `Test du prix bas (baisse de ${pct(Math.abs(sensibilite.testPrixBas.baisse), 0)}) : le plan devient « ${libelleStatut(sensibilite.testPrixBas.statut)} », avec un résultat cumulé de ${fcfa(sensibilite.testPrixBas.resultatCumule)} et un point bas de trésorerie de ${fcfa(sensibilite.testPrixBas.pointBasTresorerie)}.`,
    },
  ];
  if (sensibilite.tableauSeuil.lignePrincipale) {
    const t = sensibilite.tableauSeuil;
    s.push({
      type: "tableau",
      legende: `Prix de vente minimum de « ${t.lignePrincipale!.libelle} » (prix prévu : ${fcfa(t.lignePrincipale!.prixActuel)}), selon le rendement et les charges`,
      entetes: ["Rendement \\ charges", ...t.axeCharges.map((c) => pct(c, 0))],
      lignes: t.axeRendement.map((rd, i) => [pct(rd, 0), ...t.lignePrincipale!.prixSeuil[i].map((p) => (p === null ? "n.d." : fcfa(p)))]),
    });
  }
  sections.push({ numero: "", titre: `Scénarios et sensibilité${anpgf ? " (annexe du canevas)" : ""}`, nouvellePage: true, blocs: s });

  // ---------------------------------------------------------------- 9. Risques
  const risques: Bloc[] = [];
  if (d.redaction.risques && d.redaction.risques.length > 0) {
    risques.push({ type: "tableau", legende: `Risques et mesures${renvoi("§7")}`, entetes: ["Risque", "Probabilité", "Impact", "Mesure (plan B)"], lignes: d.redaction.risques.map((x) => [x.risque, x.probabilite, x.impact, x.mesure]) });
  } else {
    manques.push("Risques du projet et mesures d'atténuation (3 à 5)");
    risques.push({ type: "alerte", niveau: "info", texte: `${A_COMPLETER} (3 à 5 risques avec probabilité, impact et mesure)` });
  }
  risques.push({ type: "paragraphe", texte: `Risques chiffrés par les moteurs : l'hypothèse qui pèse le plus sur le résultat est « ${sensibilite.classement[0] ?? "n.d."} » ; avec ${pct(Math.abs(sensibilite.testPrixBas.baisse), 0)} de baisse des prix, le plan est « ${libelleStatut(sensibilite.testPrixBas.statut)} ».` });
  sections.push({ numero: "7", titre: `Risques et mesures${renvoi("§7")}`, blocs: risques });

  // ---------------------------------------------------------------- 10. Impacts
  const imp = d.redaction.impacts ?? {};
  sections.push({
    numero: "8",
    titre: `Impacts du projet${renvoi("§8")}`,
    blocs: [
      { type: "paragraphe", texte: "Impacts économiques" },
      texte(imp.economiques, "Impacts économiques", manques),
      { type: "paragraphe", texte: "Impacts environnementaux" },
      texte(imp.environnementaux, "Impacts environnementaux", manques),
      { type: "paragraphe", texte: "Impacts sociaux" },
      texte(imp.sociaux, "Impacts sociaux", manques),
    ],
  });

  // ---------------------------------------------------------------- 11. Sûretés
  sections.push({ numero: "9", titre: `Sûretés proposées${renvoi("§9")}`, blocs: [texte(d.redaction.suretes, "Sûretés proposées", manques)] });

  // ---------------------------------------------------------------- 12. Calendrier de réalisation : repris en partie technique
  sections.push({
    numero: "",
    titre: "Calendrier de réalisation",
    blocs: [{ type: "paragraphe", texte: "Le calendrier de réalisation figure dans l'étude technique (partie 2, 5). Les mois sont comptés à partir du démarrage." }],
  });

  // ---------------------------------------------------------------- 13. Hypothèses et sources, bilan de santé
  const hyp: Bloc[] = [
    {
      type: "cle_valeur",
      lignes: [
        ["Horizon", `${d.hypotheses.horizonAnnees} an(s)`],
        ["Taux d'actualisation", pct(d.hypotheses.tauxActualisation)],
        ["Hausse annuelle des charges", pct(d.hypotheses.hausseCharges)],
        ["Hausse annuelle des prix", pct(d.hypotheses.haussePrix)],
        ["Impôts et taxes annuels", fcfa(d.hypotheses.impotsAnnuels)],
        ["Version des moteurs de calcul", d.resultats.versionMoteur],
      ],
    },
    {
      type: "tableau",
      legende: "Origine des chiffres importants",
      entetes: ["Ligne", "Origine", "Source du prix"],
      lignes: d.lignes.map((l) => [l.libelle, l.origine === "utilisateur" ? "saisie du porteur" : l.origine === "cultisia" ? "proposition de Cultisia" : l.origine === "prix_marche" ? "prix du marché" : l.origine === "ajustee_terrain" ? "référentiel ajusté au terrain" : l.origine === "estimation" ? "estimation" : "référentiel Cultiso", l.sourcePrix ? `${l.sourcePrix.source} (${l.sourcePrix.date})` : "n.d."]),
    },
  ];
  if (d.generation.prixMarche.length > 0) hyp.push({ type: "liste", items: d.generation.prixMarche.map((p) => `${p.produit} : ${fcfa(p.prix)}, ${p.source}, ${dateFr(p.date)}`) });
  if (d.generation.origineProfil && d.generation.origineProfil.length > 0) hyp.push({ type: "liste", items: d.generation.origineProfil });
  if (regle) {
    hyp.push({
      type: "paragraphe",
      texte: `Règle du financeur appliquée : ${regle.organisme}, ${regle.libelle}. Apport minimum : ${regle.apportMinimum === null ? "non renseigné" : pct(regle.apportMinimum, 0)} ; durée maximale : ${regle.dureeMaxMois === null ? "non renseignée" : `${regle.dureeMaxMois} mois`} ; différé maximal : ${regle.differeMaxMois === null ? "non renseigné" : `${regle.differeMaxMois} mois`}. Source : ${regle.source ?? "non renseignée"}. Statut de la donnée : ${STATUTS_LISIBLES[regle.statut] ?? regle.statut}.`,
    });
    if (regle.statut !== "validee") hyp.push({ type: "alerte", niveau: "alerte", texte: "Cette règle du financeur n'a pas été validée par un expert : à confirmer auprès du financeur avant le dépôt du dossier." });
  }
  hyp.push({ type: "paragraphe", texte: "Bilan de santé du plan (contrôles des moteurs) :" });
  const aSignaler = r.controles.filter((c) => c.niveau !== "ok");
  const ok = r.controles.filter((c) => c.niveau === "ok").length;
  hyp.push(
    aSignaler.length > 0
      ? { type: "liste", items: aSignaler.map((c) => `[${c.niveau}] ${c.message}`) }
      : { type: "paragraphe", texte: "Aucun point à signaler." },
  );
  hyp.push({ type: "paragraphe", texte: `${ok} contrôle(s) passé(s) sans remarque.` });
  for (const c of [...d.financement.controles]) hyp.push({ type: "alerte", niveau: c.niveau, texte: c.message });
  for (const c of d.mainOeuvre?.controles ?? []) hyp.push({ type: "alerte", niveau: c.niveau, texte: c.message });
  for (const c of d.debouches?.controles ?? []) hyp.push({ type: "alerte", niveau: c.niveau, texte: c.message });
  sections.push({ numero: "", titre: "Hypothèses, sources et bilan de santé", nouvellePage: true, blocs: hyp });

  // ---------------------------------------------------------------- 14. Annexes
  const pieces = listerPieces(d);
  sections.push({
    numero: "",
    titre: "Annexes : pièces à joindre et lexique",
    nouvellePage: true,
    blocs: [
      { type: "paragraphe", texte: "Pièces à joindre (cochées quand le porteur déclare les avoir) :" },
      { type: "case_a_cocher", items: pieces.map((p) => ({ coche: p.etat === "declaree", texte: p.libelle, detail: p.detail })) },
      { type: "paragraphe", texte: "Lexique :" },
      { type: "definitions", lignes: lexique().map((e) => ({ terme: e.terme, definition: e.definition })) },
    ],
  });

  return {
    version: "dossier",
    format: anpgf ? "anpgf" : "generique",
    titre: `Dossier de financement : ${d.titrePlan}`,
    sousTitre: anpgf ? "Plan d'affaires au format du canevas ANPGF des projets en démarrage" : "Plan d'affaires",
    pageDeTitre: [
      ["Projet", d.titrePlan],
      ["Exploitation", d.exploitation.nom],
      ["Promoteur", d.promoteur.nom ?? "à compléter"],
      ["Financeur visé", regle ? `${regle.organisme} (${regle.libelle})` : "non précisé"],
      ["Date", dateFr(d.genereLe)],
      ["Calculs", `Moteurs Cultiso ${d.resultats.versionMoteur}`],
    ],
    sections,
    aCompleter: [...new Set(manques)],
    pied: `Cultiso : dossier généré le ${dateFr(d.genereLe)}, moteurs ${d.resultats.versionMoteur}`,
  };
}

// ------------------------------------------------------------------ aides

function libelleStatut(s: string): string {
  return s === "rentable" ? "rentable" : s === "limite" ? "limite" : s === "deficitaire" ? "déficitaire" : s;
}

function valeurProfil(d: DonneesDossier, champ: keyof DonneesDossier["profil"]["valeurs"]): string {
  const x = d.profil.valeurs[champ];
  if (x === null || x === undefined) return "non renseigné";
  if (typeof x === "boolean") return x ? "oui" : "non";
  if (typeof x === "number") return nombre(x, Number.isInteger(x) ? 0 : 1);
  return String(x).replace(/_/g, " ");
}

function ventes(d: DonneesDossier): string[][] {
  return d.lignes
    .filter((l) => l.sens === "revenu")
    .map((l) => {
      const q = l.sens === "revenu" ? l.quantites.realiste * (1 - l.pertes) : 0;
      return [l.libelle, `${nombre(q, 2)} ${l.unite}`, fcfa(l.prixUnitaire), fcfa(q * l.prixUnitaire * (l.base === "an" ? 1 : l.cyclesParAn))];
    });
}

function blocsAlertes(controles: { niveau: string; message: string }[], max: number): Bloc[] {
  const a = controles.filter((c) => c.niveau === "bloquant" || c.niveau === "alerte").slice(0, max);
  return a.map((c) => ({ type: "alerte" as const, niveau: c.niveau === "bloquant" ? ("bloquant" as const) : ("alerte" as const), texte: c.message }));
}

function creditPlanDuree(d: DonneesDossier): string {
  const n = d.credit?.echeancier.length ?? 0;
  return n > 0 ? `${n} mois` : "n.d.";
}
function differe(d: DonneesDossier): string {
  const n = d.credit?.echeancier.filter((e) => e.amortissement <= 0).length ?? 0;
  return `${n} mois`;
}
