// Contrôles nommés et ratios (M4) : chaque contrôle renvoie un code stable, un niveau, les valeurs qui le fondent
// et une phrase simple pour un porteur sans formation financière. Rien n'est jugé par l'IA : Cultisia lit ces contrôles.
// Les seuils (apport minimum d'un financeur, bornes de rendement) arrivent en paramètres ; aucun n'est écrit ici.
// Sources : ANALYSE-RESSOURCES-MODELISATION.md §4.1 (M4) ; ANALYSE-BASE-RESSOURCES.md §3.5 (ratios) et §3.6 (erreurs des plans réels).

/** ok : rien à signaler ; info : à vérifier ; alerte : point faible à corriger ou à justifier ; bloquant : le plan ne tient pas en l'état. */
export type NiveauControle = "ok" | "info" | "alerte" | "bloquant";

export const CODES_CONTROLE = [
  "TRESORERIE_NEGATIVE",
  "MENAGE_NON_COUVERT",
  "MENAGE_NON_RENSEIGNE",
  "APPORT_INSUFFISANT",
  "BFR_NON_FINANCE",
  "DERNIERES_ANNEES_DEFICITAIRES",
  "RENDEMENT_HORS_BORNES",
  "RESSOURCE_EN_DOUBLE",
  "POSTE_EN_DOUBLE",
  "UNITE_PERIODE",
  "VARIATION_BFR",
  "BFR_AMORTI",
] as const;
export type CodeControle = (typeof CODES_CONTROLE)[number];

export type ValeurControle = number | string | boolean | null | number[] | string[];

export interface Controle {
  code: CodeControle;
  niveau: NiveauControle;
  /** Chiffres du moteur qui fondent le contrôle (montants en FCFA, taux en décimal). */
  valeurs: Record<string, ValeurControle>;
  /** Phrase simple, en français, qui dit ce qui va ou ce qui manque. */
  message: string;
}

export interface Ratios {
  /** Investissement + BFR du scénario. */
  coutProjet: number;
  /** Dettes / fonds propres : crédit / apport. null sans apport. */
  endettement: number | null;
  /** Dettes / CAF nette de l'an 1 : années de CAF pour rembourser. null si la CAF n'est pas positive. */
  dettesSurCaf: number | null;
  /** Charges financières (intérêts de l'an 1) / chiffre d'affaires de l'an 1. null sans vente. */
  chargesFinancieresSurCA: number | null;
  /** Apport / coût du projet. null si le coût du projet est nul. */
  partApport: number | null;
}

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nombrePrecis = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
/** Montant lisible dans un message (espaces ordinaires, pour tous les affichages). */
export const enFcfa = (montant: number) => `${nombre.format(montant).replace(/\s/g, " ")} FCFA`;
const enQuantite = (q: number) => nombrePrecis.format(q).replace(/\s/g, " ");
const enPourcent = (t: number) => `${nombrePrecis.format(Math.round(t * 1000) / 10).replace(/\s/g, " ")} %`;
const listeMois = (m: number[]) => (m.length === 1 ? `au mois ${m[0]}` : `aux mois ${m.join(", ")}`);
const listeAns = (a: number[]) => (a.length === 1 ? `l'an ${a[0]}` : `les ans ${a.join(", ")}`);

/** Normalise un libellé pour repérer les doublons (sans accents, casse ni ponctuation). */
export const normaliserLibelle = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Ces motifs reconnaissent des libellés (pas des valeurs de référence) : ce qu'un BFR ou un impôt s'appelle dans un plan.
const MOTIF_BFR = /\b(bfr|fonds de roulement|divers et imprevus|imprevus)\b/;
const MOTIF_IMPOT = /\b(impot|impots|taxe|taxes|patente)\b/;

/** Données nécessaires aux contrôles, déjà calculées et arrondies par le moteur financier. */
export interface DonneesControles {
  charges: { id: string; libelle: string; typeCharge: string; nature: "fixe" | "variable"; classe: "investissement" | "exploitation"; base: "cycle" | "an"; frequence: number; moisDecaissement?: number[] }[];
  revenus: { id: string; libelle: string; quantite: number; bornesQuantite?: { min?: number; max?: number; source?: string } }[];
  apport: number;
  credit: { montant: number } | null;
  menageRenseigne: boolean;
  salairesAnnuels: number;
  impotsAnnuels: number;
  listesMois: { nom: string; mois: number[] }[];
  regleFinanceur?: { nom: string; apportMinimum?: number; source?: string };
  investissementTotal: number;
  besoinFondsRoulement: number;
  annees: { an: number; chiffreAffaires: number; resultat: number; interets: number; cafNette: number; capaciteRemboursement: number; soldeResiduel: number }[];
  moisTresorerieNegative: number[];
  pointBasTresorerie: { montant: number; mois: number };
}

export function calculerRatios(d: DonneesControles): Ratios {
  const coutProjet = d.investissementTotal + d.besoinFondsRoulement;
  const dettes = d.credit?.montant ?? 0;
  const a1 = d.annees[0];
  const arrondi = (x: number) => Math.round(x * 10_000) / 10_000;
  return {
    coutProjet,
    endettement: d.apport > 0 ? arrondi(dettes / d.apport) : null,
    dettesSurCaf: a1.cafNette > 0 ? arrondi(dettes / a1.cafNette) : null,
    chargesFinancieresSurCA: a1.chiffreAffaires > 0 ? arrondi(a1.interets / a1.chiffreAffaires) : null,
    partApport: coutProjet > 0 ? arrondi(d.apport / coutProjet) : null,
  };
}

export function controler(d: DonneesControles, ratios: Ratios): Controle[] {
  const controles: Controle[] = [];
  const ajouter = (code: CodeControle, niveau: NiveauControle, valeurs: Controle["valeurs"], message: string) =>
    controles.push({ code, niveau, valeurs, message });

  // Trésorerie négative tel mois (financement et prélèvements compris).
  if (d.moisTresorerieNegative.length > 0) {
    ajouter(
      "TRESORERIE_NEGATIVE",
      "bloquant",
      { mois: d.moisTresorerieNegative, pointBas: d.pointBasTresorerie.montant, moisPointBas: d.pointBasTresorerie.mois },
      `Ta caisse passe sous zéro ${listeMois(d.moisTresorerieNegative)} de la première année. ` +
        `Au plus bas (mois ${d.pointBasTresorerie.mois}), il manque ${enFcfa(-d.pointBasTresorerie.montant)} : il faut plus d'apport, un crédit de campagne ou décaler des dépenses.`,
    );
  } else {
    ajouter(
      "TRESORERIE_NEGATIVE",
      "ok",
      { mois: [], pointBas: d.pointBasTresorerie.montant, moisPointBas: d.pointBasTresorerie.mois },
      `Ta caisse reste positive tous les mois de la première année (au plus bas : ${enFcfa(d.pointBasTresorerie.montant)} au mois ${d.pointBasTresorerie.mois}).`,
    );
  }

  // Revenu du ménage.
  if (!d.menageRenseigne) {
    ajouter("MENAGE_NON_RENSEIGNE", "info", {}, "Le coût de vie de ta famille n'est pas renseigné : on ne peut pas encore dire si le projet la fait vivre et rembourse le crédit.");
  } else {
    const anneesNonCouvertes = d.annees.filter((a) => a.soldeResiduel < 0).map((a) => a.an);
    const soldeMin = Math.min(...d.annees.map((a) => a.soldeResiduel));
    const capaciteMin = Math.min(...d.annees.map((a) => a.capaciteRemboursement));
    if (anneesNonCouvertes.length > 0) {
      const avantCredit = capaciteMin < 0;
      ajouter(
        "MENAGE_NON_COUVERT",
        "bloquant",
        { annees: anneesNonCouvertes, soldeResiduelMin: soldeMin, capaciteMin },
        avantCredit
          ? `Même sans crédit, le projet ne couvre pas les besoins de ta famille (${listeAns(anneesNonCouvertes)}) : il manque jusqu'à ${enFcfa(-capaciteMin)} par an.`
          : `Le projet fait vivre ta famille, mais ne laisse pas de quoi payer les échéances du crédit (${listeAns(anneesNonCouvertes)}) : il manque jusqu'à ${enFcfa(-soldeMin)} par an.`,
      );
    } else {
      ajouter(
        "MENAGE_NON_COUVERT",
        "ok",
        { annees: [], soldeResiduelMin: soldeMin, capaciteMin },
        `Chaque année, le projet couvre les besoins de ta famille et les échéances, avec au moins ${enFcfa(soldeMin)} de reste.`,
      );
    }
  }

  // Apport sous le seuil du financeur (seuil passé en paramètre : ANPGF 20 %, à confirmer par R11).
  const regle = d.regleFinanceur;
  if (regle?.apportMinimum !== undefined && ratios.partApport !== null) {
    const valeurs = { partApport: ratios.partApport, apportMinimum: regle.apportMinimum, financeur: regle.nom, source: regle.source ?? null, apport: d.apport, coutProjet: ratios.coutProjet };
    if (ratios.partApport < regle.apportMinimum) {
      const manque = Math.ceil(regle.apportMinimum * ratios.coutProjet - d.apport);
      ajouter(
        "APPORT_INSUFFISANT",
        "alerte",
        { ...valeurs, manque },
        `Ton apport couvre ${enPourcent(ratios.partApport)} du coût du projet ; ${regle.nom} demande au moins ${enPourcent(regle.apportMinimum)}. Il manque ${enFcfa(manque)} d'apport.`,
      );
    } else {
      ajouter("APPORT_INSUFFISANT", "ok", valeurs, `Ton apport couvre ${enPourcent(ratios.partApport)} du coût du projet, au-dessus du minimum de ${regle.nom} (${enPourcent(regle.apportMinimum)}).`);
    }
  }

  // BFR non financé : les ressources (apport + crédit) doivent couvrir l'investissement ET le fonds de roulement.
  const ressources = d.apport + (d.credit?.montant ?? 0);
  if (ressources < ratios.coutProjet) {
    const manque = ratios.coutProjet - ressources;
    const bfrNonFinance = Math.min(manque, d.besoinFondsRoulement);
    ajouter(
      "BFR_NON_FINANCE",
      d.besoinFondsRoulement > 0 && bfrNonFinance > 0 ? "bloquant" : "alerte",
      { ressources, investissement: d.investissementTotal, besoinFondsRoulement: d.besoinFondsRoulement, manque },
      `Ton apport et ton crédit (${enFcfa(ressources)}) ne couvrent pas l'achat du matériel (${enFcfa(d.investissementTotal)}) plus l'argent pour tenir jusqu'aux premières ventes (${enFcfa(d.besoinFondsRoulement)}). Il manque ${enFcfa(manque)}.`,
    );
  } else {
    ajouter(
      "BFR_NON_FINANCE",
      "ok",
      { ressources, investissement: d.investissementTotal, besoinFondsRoulement: d.besoinFondsRoulement, manque: 0 },
      `Ton apport et ton crédit couvrent le matériel et l'argent pour tenir jusqu'aux premières ventes.`,
    );
  }

  // Les deux dernières années déficitaires (la seule si l'horizon est d'un an).
  const dernieres = d.annees.slice(-2);
  const deficitaires = dernieres.filter((a) => a.resultat < 0);
  if (deficitaires.length === dernieres.length) {
    ajouter(
      "DERNIERES_ANNEES_DEFICITAIRES",
      "bloquant",
      { annees: dernieres.map((a) => a.an), resultats: dernieres.map((a) => a.resultat) },
      `Le projet perd de l'argent ${dernieres.length > 1 ? "les deux dernières années" : "sur l'année calculée"} (${dernieres.map((a) => `an ${a.an} : ${enFcfa(a.resultat)}`).join(" ; ")}) : il ne devient pas rentable dans l'horizon choisi.`,
    );
  } else {
    ajouter("DERNIERES_ANNEES_DEFICITAIRES", "ok", { annees: dernieres.map((a) => a.an), resultats: dernieres.map((a) => a.resultat) }, "Le projet gagne de l'argent en fin d'horizon.");
  }

  // Rendement hors des bornes du référentiel, quand elles existent.
  for (const r of d.revenus) {
    const b = r.bornesQuantite;
    if (!b || (b.min === undefined && b.max === undefined)) continue;
    const valeurs = { ligneId: r.id, quantite: r.quantite, min: b.min ?? null, max: b.max ?? null, source: b.source ?? null };
    if (b.max !== undefined && r.quantite > b.max) {
      ajouter("RENDEMENT_HORS_BORNES", "alerte", valeurs, `${r.libelle} : la production prévue (${enQuantite(r.quantite)}) dépasse le maximum connu (${enQuantite(b.max)}). Justifie-la ou réduis-la.`);
    } else if (b.min !== undefined && r.quantite < b.min) {
      ajouter("RENDEMENT_HORS_BORNES", "info", valeurs, `${r.libelle} : la production prévue (${enQuantite(r.quantite)}) est sous le minimum connu (${enQuantite(b.min)}). C'est prudent, vérifie que c'est voulu.`);
    } else {
      ajouter("RENDEMENT_HORS_BORNES", "ok", valeurs, `${r.libelle} : la production prévue reste dans les valeurs connues.`);
    }
  }

  // §3.6 : nature unique de chaque ressource. Un crédit plus grand que tout le besoin trahit souvent une ressource comptée deux fois.
  if (d.credit && d.credit.montant > ratios.coutProjet) {
    ajouter(
      "RESSOURCE_EN_DOUBLE",
      "alerte",
      { credit: d.credit.montant, apport: d.apport, coutProjet: ratios.coutProjet },
      `Le crédit (${enFcfa(d.credit.montant)}) dépasse tout le coût du projet (${enFcfa(ratios.coutProjet)}). Vérifie qu'une même somme n'est pas comptée deux fois (apport, prêt, subvention).`,
    );
  } else if (ressources > ratios.coutProjet && d.credit) {
    ajouter(
      "RESSOURCE_EN_DOUBLE",
      "info",
      { credit: d.credit.montant, apport: d.apport, coutProjet: ratios.coutProjet },
      `Apport et crédit dépassent de ${enFcfa(ressources - ratios.coutProjet)} le coût du projet : tu pourrais emprunter moins.`,
    );
  }

  // §3.6 : un poste, une seule source.
  const doublons = new Map<string, string[]>();
  for (const c of d.charges) {
    const cle = `${c.classe}|${c.typeCharge}|${normaliserLibelle(c.libelle)}`;
    doublons.set(cle, [...(doublons.get(cle) ?? []), c.id]);
  }
  for (const ids of doublons.values()) {
    if (ids.length < 2) continue;
    const libelle = d.charges.find((c) => c.id === ids[0])?.libelle ?? "";
    ajouter("POSTE_EN_DOUBLE", "alerte", { poste: libelle, lignes: ids }, `« ${libelle} » apparaît ${ids.length} fois dans les charges. Vérifie que ce n'est pas la même dépense comptée deux fois.`);
  }
  const fraisFinanciers = d.charges.filter((c) => c.typeCharge === "frais_financiers").map((c) => c.id);
  if (d.credit && fraisFinanciers.length > 0) {
    ajouter("POSTE_EN_DOUBLE", "alerte", { poste: "frais_financiers", lignes: fraisFinanciers }, "Les intérêts du crédit sont déjà calculés : une ligne de frais financiers les compterait deux fois. Vérifie-la.");
  }
  const lignesImpots = d.charges.filter((c) => MOTIF_IMPOT.test(normaliserLibelle(c.libelle))).map((c) => c.id);
  if (d.impotsAnnuels > 0 && lignesImpots.length > 0) {
    ajouter("POSTE_EN_DOUBLE", "alerte", { poste: "impots", lignes: lignesImpots }, "Des impôts sont saisis à la fois en ligne de charge et en montant annuel : garde une seule des deux sources.");
  }
  const mainOeuvreFixe = d.charges.filter((c) => c.typeCharge === "main_oeuvre" && c.nature === "fixe" && c.classe === "exploitation").map((c) => c.id);
  if (d.salairesAnnuels > 0 && mainOeuvreFixe.length > 0) {
    ajouter("POSTE_EN_DOUBLE", "info", { poste: "salaires", lignes: mainOeuvreFixe }, "Des salaires sont saisis à part et des lignes de main d'oeuvre fixe existent : vérifie qu'un même salaire n'est pas compté deux fois.");
  }

  // §3.6 : unités et périodes.
  for (const l of d.listesMois) {
    if (new Set(l.mois).size !== l.mois.length) {
      ajouter("UNITE_PERIODE", "alerte", { liste: l.nom, mois: l.mois }, `${l.nom} : un même mois est indiqué plusieurs fois (${l.mois.join(", ")}).`);
    }
  }
  for (const c of d.charges) {
    // Personnel permanent payé une seule fois par an : souvent un salaire mensuel saisi comme annuel (DOC-00136 p. 10).
    if (c.typeCharge === "main_oeuvre" && c.nature === "fixe" && c.classe === "exploitation" && c.base === "an" && c.frequence === 1 && c.moisDecaissement?.length === 1) {
      ajouter(
        "UNITE_PERIODE",
        "info",
        { ligneId: c.id, mois: c.moisDecaissement },
        `${c.libelle} : un salaire fixe payé une seule fois dans l'année. Vérifie que le montant est bien annuel et non mensuel.`,
      );
    }
  }

  // §3.6 : le BFR se finance une fois, il ne s'amortit pas.
  ajouter(
    "VARIATION_BFR",
    "ok",
    { besoinFondsRoulement: d.besoinFondsRoulement, variations: d.annees.map((a) => (a.an === 1 ? d.besoinFondsRoulement : 0)) },
    "L'argent pour tenir jusqu'aux premières ventes est compté une seule fois, au démarrage, et pas chaque année.",
  );
  const bfrAmortis = d.charges.filter((c) => c.classe === "investissement" && MOTIF_BFR.test(normaliserLibelle(c.libelle)));
  if (bfrAmortis.length > 0) {
    ajouter(
      "BFR_AMORTI",
      "alerte",
      { lignes: bfrAmortis.map((c) => c.id) },
      `${bfrAmortis.map((c) => `« ${c.libelle} »`).join(", ")} : le fonds de roulement et les imprévus ne sont pas du matériel, ils ne s'amortissent pas. Retire ces lignes des investissements : le moteur calcule déjà le fonds de roulement.`,
    );
  } else {
    ajouter("BFR_AMORTI", "ok", { lignes: [] }, "Seul le matériel durable est amorti.");
  }

  return controles;
}
