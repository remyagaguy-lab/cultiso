// Dimensionnement à rebours (M13) : on part du débouché (volume vendable par mois, issu du marché ou d'un contrat),
// on remonte à la production nécessaire (pertes et déclassement compris), puis à la surface ou au cheptel, aux intrants
// et au travail, et on plafonne par l'existant du porteur (profil R9). Trois tailles sont proposées côte à côte :
// « ce que tu peux faire avec ce que tu as », « la taille qui couvre ton coût de vie », « ce que le marché absorbe ».
// Service PUR : aucune base, aucun appel au modèle. Les montants viennent de genererBudget, calculerFinances (contrôles M4,
// revenu du ménage M3, bornes R10) et confronterExistant ; ici on ne fait que des proportions entre eux.
// Rien n'est inventé : un paramètre sans source (pertes après récolte, déclassement, coefficient de rendement, surface utile,
// durée d'un jour de travail, besoin en eau) est fourni par l'appelant avec sa source, ou laissé vide ; il est alors listé dans
// `manques` et la dimension qu'il alimente est « non évaluée ».
import { z } from "zod";
import { ErreurMoteur, HORIZON_PAR_DEFAUT, calculerFinances, genererBudget, type EntreeBudget, type ResultatFinance, type Scenario } from "@/moteurs";
import type { LigneChargeBudget } from "@/moteurs/budget";
import { valider } from "@/moteurs/commun";
import { confronterExistant, type EcartBesoin, type SpeculationBesoin } from "./besoins";
import { deduireDuProfil, valeur, type ProfilPorteur } from "./profil";

const parametre = (regle: z.ZodNumber) => z.object({ valeur: regle, source: z.string().trim().min(2, "la source du paramètre est obligatoire") });

export const schemaParametresDimensionnement = z.object({
  /** Ce que le marché ou un contrat absorbe : volume vendable par mois, dans l'unité de la ligne de revenu. */
  debouche: z.object({
    volumeParMois: z.number().positive("le volume vendable par mois doit être positif"),
    /** Nombre de mois par an où ce volume se vend (12 si toute l'année). Pas de valeur par défaut. */
    moisParAn: z.number().positive().max(12),
    unite: z.string().trim().min(1),
    origine: z.enum(["marche", "contrat", "promesse_achat", "enquete"]),
    source: z.string().trim().min(2, "la source du débouché est obligatoire"),
  }),
  scenario: z.enum(["pessimiste", "realiste", "optimiste"]).default("realiste"),
  /** Ligne de revenu visée quand la spéculation en a plusieurs (identifiant du modèle). */
  modeleRevenuId: z.string().min(1).optional(),
  /** Cycles par an ; sans valeur, celui du référentiel pour la spéculation (sinon 1, comme le générateur de budget). */
  cyclesParAn: z.number().positive().optional(),
  /** Pertes après récolte, en part du volume produit (en plus de celles du modèle du référentiel). */
  pertesApresRecolte: parametre(z.number().min(0).max(0.99)).optional(),
  /** Part déclassée (non vendable au prix normal). */
  declassement: parametre(z.number().min(0).max(0.99)).optional(),
  /** Coefficient appliqué au rendement du référentiel (inférieur à 1 pour un débutant). */
  coefficientRendement: parametre(z.number().positive().max(2)).optional(),
  /** Surface utile majorée : surface à prévoir = surface cultivée × ce coefficient (tournières, chemins, jachère). Au moins 1. */
  surfaceUtile: parametre(z.number().min(1)).optional(),
  /** Durée d'un jour de travail, en heures. */
  heuresParJourTravail: parametre(z.number().positive().max(24)).optional(),
  /** Besoin en eau en m³ par jour pour une unité d'échelle. */
  besoinEau: parametre(z.number().positive()).optional(),
});
export type ParametresDimensionnement = z.input<typeof schemaParametresDimensionnement>;

export interface EntreeDimensionnement {
  profil: ProfilPorteur;
  speculation: SpeculationBesoin;
  /** Référentiel pour cette spéculation : modèles, règles, contexte, prix. Les ateliers sont ajoutés par le service. */
  budget: Omit<EntreeBudget, "ateliers">;
  /** Cycles par an de la spéculation dans le référentiel, utilisés si les paramètres n'en donnent pas. */
  cyclesParAnReferentiel?: number;
  parametres: ParametresDimensionnement;
}

/** Un chiffre avec son unité et d'où il vient. */
export interface Chiffre {
  valeur: number | null;
  unite: string;
  origine: string;
}

export type ClePlafond = "terre" | "travail" | "argent" | "eau";
export interface Plafond {
  dimension: ClePlafond;
  statut: "evalue" | "non_evalue" | "non_limitant";
  /** Plus grande taille (unité d'échelle) que cette dimension permet ; null si non évalué ou non limitant. */
  tailleMax: number | null;
  phrase: string;
}

export type CleTaille = "avec_ce_que_tu_as" | "couvre_ton_cout_de_vie" | "ce_que_le_marche_absorbe";

export interface ResumeFinancier {
  statut: string;
  menageCouvert: boolean | null;
  soldeResiduelMinimum: number | null;
  pointBasTresorerie: number;
  /** Contrôles M4 qui demandent attention (niveau différent de « ok »), avec la phrase du moteur. */
  controles: { code: string; niveau: string; message: string }[];
}

export interface DetailTaille {
  volumeVendableAn: Chiffre;
  productionNecessaireAn: Chiffre;
  surfaceAPrevoirHa: Chiffre;
  intrantsAn: Chiffre;
  joursTravailAn: Chiffre;
  investissement: Chiffre;
  margeExploitationAn: Chiffre;
  /** Cette taille dépasse-t-elle ce que le débouché absorbe ? */
  depasseLeDebouche: boolean;
  /** Les plafonds de l'existant que cette taille dépasse. */
  plafondsDepasses: ClePlafond[];
  ecarts: EcartBesoin[];
  finances: ResumeFinancier;
}

export interface TailleProposee {
  cle: CleTaille;
  titre: string;
  statut: "calculee" | "non_evaluee" | "impossible";
  /** Dans l'unité d'échelle de la spéculation ; null tant qu'elle n'est pas calculée. */
  taille: number | null;
  uniteEchelle: string;
  phrase: string;
  detail?: DetailTaille;
}

export interface ResultatDimensionnement {
  speculation: string;
  uniteEchelle: string;
  scenario: Scenario;
  /** Volume vendable par unité d'échelle et par an, après pertes, déclassement et coefficient. */
  rendementVendable: Chiffre;
  debouche: Chiffre;
  plafonds: Plafond[];
  tailles: TailleProposee[];
  /** Ce qu'il faudrait fournir pour lever une limite de l'évaluation, une phrase par manque. */
  manques: string[];
  /** Vrai quand des chiffres reposent sur des données de référence non validées par un expert. */
  donneesNonValidees: boolean;
}

const SEMAINES_PAR_AN = 52;
const EPSILON = 1e-9;
const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const nombre = (v: number, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(v).replace(/\s/g, " ");
const fcfa = (v: number) => `${nombre(v, 0)} FCFA`;
const parAn = (l: { base?: "cycle" | "an"; cyclesParAn?: number }) => ((l.base ?? "cycle") === "cycle" ? (l.cyclesParAn ?? 1) : 1);
/** Une taille se lit mieux arrondie : à l'entier au-dessus de 100, sinon à 2 décimales. */
const arrondir = (t: number, sens: "bas" | "haut"): number => {
  const pas = t >= 100 ? 1 : 0.01;
  const n = sens === "bas" ? Math.floor(t / pas + 1e-7) : Math.ceil(t / pas - 1e-7);
  return Math.round(n * pas * 100) / 100;
};

const LIBELLE_DEBOUCHE = { marche: "marché", contrat: "contrat", promesse_achat: "promesse d'achat", enquete: "enquête de terrain" } as const;
const ORIGINE_STATUT = (statut: string | undefined): string =>
  statut === "validee" ? "référentiel Cultiso validé" : "référentiel Cultiso, brouillon non validé par un expert";

interface Unitaire {
  chargesExploitation: number;
  intrants: number;
  jours: number;
  jourLignes: boolean;
  investissement: number;
  chiffreAffaires: number;
}

function ligneCharge(l: LigneChargeBudget) {
  const montantAn = l.quantite * l.prixUnitaire * (l.frequence ?? 1) * parAn(l);
  return { montantAn, montantUnique: l.quantite * l.prixUnitaire * (l.frequence ?? 1) };
}

export function dimensionnerARebours(entree: EntreeDimensionnement): ResultatDimensionnement {
  const p = valider(schemaParametresDimensionnement, entree.parametres, "dimensionnement");
  const { profil, speculation } = entree;
  const cycles = p.cyclesParAn ?? entree.cyclesParAnReferentiel ?? 1;
  const echelleHa = normaliser(speculation.uniteEchelle) === "ha";
  const budgetPour = (taille: number) =>
    genererBudget({ ...entree.budget, ateliers: [{ atelierId: "m13", speculationCode: speculation.code, taille, cyclesParAn: cycles }] });

  // 1. La ligne de revenu visée, dans l'unité du débouché.
  const unitaire = budgetPour(1);
  const candidates = unitaire.revenus;
  if (candidates.length === 0) throw new ErreurMoteur(`Le référentiel n'a aucune ligne de revenu pour ${speculation.nom} : le dimensionnement est impossible.`);
  const cible =
    p.modeleRevenuId !== undefined
      ? candidates.find((r) => r.modeleId === p.modeleRevenuId)
      : candidates.length === 1
        ? candidates[0]
        : candidates.filter((r) => r.typeRevenu === "principal").length === 1
          ? candidates.find((r) => r.typeRevenu === "principal")
          : undefined;
  if (!cible) {
    throw new ErreurMoteur(
      `Plusieurs lignes de revenu pour ${speculation.nom} : précise laquelle vise le débouché (${candidates.map((r) => `${r.modeleId} : ${r.libelle}`).join(" ; ")}).`,
    );
  }
  if (normaliser(cible.unite) !== normaliser(p.debouche.unite)) {
    throw new ErreurMoteur(`Le débouché est donné en « ${p.debouche.unite} » mais la ligne « ${cible.libelle} » se compte en « ${cible.unite} » : convertis le volume dans la bonne unité.`);
  }
  const modeleCible = entree.budget.modelesRevenus.find((m) => m.id === cible.modeleId);
  const origineRef = ORIGINE_STATUT(modeleCible?.statut);

  // 2. Du volume vendable à la production nécessaire : pertes du modèle, pertes après récolte, déclassement, coefficient.
  const pertesModele = cible.pertes ?? 0;
  const coefficient = p.coefficientRendement?.valeur ?? 1;
  const pertesApres = p.pertesApresRecolte?.valeur ?? 0;
  const declasse = p.declassement?.valeur ?? 0;
  const partVendue = (1 - pertesModele) * (1 - pertesApres) * (1 - declasse);
  const pertesTotales = 1 - partVendue;
  const cyclesLigne = parAn(cible);
  const brutParUnite = cible.quantite[p.scenario] * coefficient * cyclesLigne;
  const vendableParUnite = brutParUnite * partVendue;
  const volumeAn = p.debouche.volumeParMois * p.debouche.moisParAn;

  const originesRendement = [
    `${origineRef} (rendement ${p.scenario}, pertes du modèle ${nombre(pertesModele * 100)} %)`,
    p.pertesApresRecolte ? `pertes après récolte ${nombre(pertesApres * 100)} % (${p.pertesApresRecolte.source})` : null,
    p.declassement ? `déclassement ${nombre(declasse * 100)} % (${p.declassement.source})` : null,
    p.coefficientRendement ? `coefficient de rendement ${nombre(coefficient, 2)} (${p.coefficientRendement.source})` : null,
  ].filter(Boolean);
  const rendementVendable: Chiffre = { valeur: vendableParUnite, unite: `${cible.unite} par ${speculation.uniteEchelle} et par an`, origine: originesRendement.join(" ; ") };
  const debouche: Chiffre = { valeur: volumeAn, unite: `${cible.unite} par an`, origine: `${LIBELLE_DEBOUCHE[p.debouche.origine]} : ${p.debouche.source} (${nombre(p.debouche.volumeParMois, 2)} ${cible.unite} par mois pendant ${nombre(p.debouche.moisParAn)} mois)` };

  // 3. Ligne de revenu ajustée (rendement, pertes, débouché) : c'est elle que lisent les moteurs financiers.
  // Les bornes de rendement (R10) sont déjà mises à la taille par le générateur de budget.
  const lignesPour = (taille: number) => {
    const b = budgetPour(taille);
    const revenus = b.revenus.map((r) =>
      r.id === cible.id
        ? {
            ...r,
            quantite: { pessimiste: r.quantite.pessimiste * coefficient, realiste: r.quantite.realiste * coefficient, optimiste: r.quantite.optimiste * coefficient },
            pertes: pertesTotales,
            debouche: { volumeAbsorbable: volumeAn / cyclesLigne, source: debouche.origine },
          }
        : r,
    );
    return { charges: b.charges, revenus };
  };

  // 4. Valeurs par unité d'échelle et par an (le budget est proportionnel à la taille).
  const u: Unitaire = { chargesExploitation: 0, intrants: 0, jours: 0, jourLignes: false, investissement: 0, chiffreAffaires: 0 };
  for (const l of unitaire.charges) {
    const { montantAn, montantUnique } = ligneCharge(l);
    if (l.classe === "investissement") u.investissement += montantUnique;
    else {
      u.chargesExploitation += montantAn;
      if (l.typeCharge === "intrants") u.intrants += montantAn;
    }
    if (l.typeCharge === "main_oeuvre" && normaliser(l.unite) === "jour") {
      u.jours += l.quantite * (l.frequence ?? 1) * parAn(l);
      u.jourLignes = true;
    }
  }
  for (const r of unitaire.revenus) {
    const vendu = r.id === cible.id ? vendableParUnite : r.quantite[p.scenario] * (1 - (r.pertes ?? 0)) * parAn(r);
    u.chiffreAffaires += vendu * r.prixUnitaire;
  }
  const margeUnite = u.chiffreAffaires - u.chargesExploitation;

  // 5. Ce que permet l'existant, dimension par dimension.
  const manques: string[] = [];
  const plafonds: Plafond[] = [];
  const nonEvalue = (dimension: ClePlafond, phrase: string): Plafond => ({ dimension, statut: "non_evalue", tailleMax: null, phrase });

  const surface = valeur<number>(profil, "terreSurfaceHa");
  if (!echelleHa) {
    plafonds.push(nonEvalue("terre", `La taille de ${speculation.nom} ne se compte pas en hectares : la terre n'est pas confrontée ici.`));
  } else if (surface === null) {
    plafonds.push(nonEvalue("terre", "Tu n'as pas donné la surface que tu peux utiliser : la terre n'est pas évaluée."));
    manques.push("Ta surface de terre disponible (profil).");
  } else {
    const coefSurface = p.surfaceUtile?.valeur ?? 1;
    const tailleMax = surface / coefSurface;
    plafonds.push({
      dimension: "terre",
      statut: "evalue",
      tailleMax,
      phrase: p.surfaceUtile
        ? `Avec ${nombre(surface)} ha et une surface utile majorée de ${nombre(coefSurface, 2)} (${p.surfaceUtile.source}), tu peux cultiver jusqu'à ${nombre(tailleMax, 2)} ha.`
        : `Tu disposes de ${nombre(surface)} ha : tu peux cultiver jusqu'à ${nombre(tailleMax, 2)} ha, à condition que les chemins, tournières et la jachère tiennent dans ce chiffre (ils ne sont pas comptés).`,
    });
  }

  const heuresPorteur = valeur<number>(profil, "tempsHeuresSemaine");
  const heuresFamille = valeur<number>(profil, "familleHeuresSemaine");
  const actifs = valeur<number>(profil, "familleActifs");
  if (!u.jourLignes || u.jours <= 0) {
    plafonds.push(nonEvalue("travail", "Le référentiel ne donne pas les jours de travail de cette production : le travail n'est pas évalué."));
  } else if (heuresPorteur === null || (heuresFamille === null && (actifs ?? 0) > 0)) {
    plafonds.push(nonEvalue("travail", "Tu n'as pas donné les heures par semaine que toi et ta famille pouvez consacrer au projet : le travail n'est pas évalué."));
    manques.push("Les heures de travail par semaine de toi et de ta famille (profil).");
  } else if (!p.heuresParJourTravail) {
    plafonds.push(nonEvalue("travail", "Le référentiel ne dit pas combien d'heures dure un jour de travail : la comparaison est à faire avec un technicien."));
  } else {
    const heures = heuresPorteur + (heuresFamille ?? 0);
    const joursPossibles = (heures * SEMAINES_PAR_AN) / p.heuresParJourTravail.valeur;
    const tailleMax = joursPossibles / u.jours;
    plafonds.push({
      dimension: "travail",
      statut: "evalue",
      tailleMax,
      phrase: `Avec ${nombre(heures)} heures par semaine (toi et ta famille), soit ${nombre(joursPossibles, 0)} jours de travail par an (un jour = ${nombre(p.heuresParJourTravail.valeur)} h, ${p.heuresParJourTravail.source}), tu peux faire seul(e) jusqu'à ${nombre(tailleMax, 2)} ${speculation.uniteEchelle}. Au-delà, il faut payer de la main d'oeuvre.`,
    });
  }

  const apportEspeces = valeur<number>(profil, "apportEspecesFcfa");
  const apportNature = valeur<number>(profil, "apportNatureFcfa");
  const apport = apportEspeces === null && apportNature === null ? null : (apportEspeces ?? 0) + (apportNature ?? 0);
  if (u.investissement <= 0) {
    plafonds.push({ dimension: "argent", statut: "non_limitant", tailleMax: null, phrase: "Le référentiel ne prévoit pas d'investissement de départ : l'argent ne limite pas la taille ici." });
  } else if (apport === null) {
    plafonds.push(nonEvalue("argent", "Tu n'as pas dit combien tu peux mettre : l'argent n'est pas évalué."));
    manques.push("Ton apport en espèces et en nature (profil).");
  } else {
    const tailleMax = apport / u.investissement;
    plafonds.push({
      dimension: "argent",
      statut: "evalue",
      tailleMax,
      phrase: `Avec ${fcfa(apport)} d'apport, tu couvres les investissements de départ jusqu'à ${nombre(tailleMax, 2)} ${speculation.uniteEchelle} (${fcfa(u.investissement)} par ${speculation.uniteEchelle}). Ton matériel déjà possédé n'est pas déduit, et l'argent à avancer avant les premières ventes n'est pas compté.`,
    });
  }

  const debit = valeur<number>(profil, "eauDebitM3Jour");
  if (!p.besoinEau) {
    plafonds.push(nonEvalue("eau", "Le référentiel ne donne pas encore le besoin en eau de cette production : l'eau n'est pas confrontée à ton débit."));
    manques.push("Le besoin en eau en m³ par jour et par unité d'échelle, avec sa source (le référentiel ne le donne pas).");
  } else if (debit === null) {
    plafonds.push(nonEvalue("eau", "Tu n'as pas donné le débit de ton point d'eau : l'eau n'est pas évaluée."));
    manques.push("Le débit de ton point d'eau en m³ par jour (profil).");
  } else {
    const tailleMax = debit / p.besoinEau.valeur;
    plafonds.push({
      dimension: "eau",
      statut: "evalue",
      tailleMax,
      phrase: `Avec ${nombre(debit)} m³ par jour (${p.besoinEau.valeur} m³ par jour et par ${speculation.uniteEchelle}, ${p.besoinEau.source}), l'eau permet jusqu'à ${nombre(tailleMax, 2)} ${speculation.uniteEchelle}.`,
    });
  }
  if (echelleHa && !p.surfaceUtile) manques.push("Le coefficient de surface utile (chemins, tournières, jachère), avec sa source : sans lui, la surface à prévoir est la surface cultivée.");
  if (u.jourLignes && !p.heuresParJourTravail) manques.push("La durée d'un jour de travail en heures, avec sa source.");
  if (!p.pertesApresRecolte) manques.push(`Les pertes après récolte, avec leur source : la production nécessaire ne compte que les pertes du référentiel (${nombre(pertesModele * 100)} %).`);
  if (!p.declassement) manques.push("La part déclassée (non vendable au prix normal), avec sa source : elle n'est pas comptée.");
  if (!p.coefficientRendement) manques.push("Le coefficient de rendement du débutant, avec sa source : le rendement du référentiel est pris tel quel.");

  // 6. Les trois tailles.
  const evalues = plafonds.filter((x) => x.statut === "evalue" && x.tailleMax !== null);
  const tailleMarche = vendableParUnite > 0 ? volumeAn / vendableParUnite : null;
  const deduit = deduireDuProfil(profil);
  const prelevements = deduit.hypotheses.prelevementsAnnuels;
  const exterieurs = deduit.hypotheses.revenusExterieursAnnuels ?? 0;

  const montrer = (cle: CleTaille, titre: string, brute: number, sens: "bas" | "haut", phrase: (t: number) => string): TailleProposee => {
    const taille = arrondir(brute, sens);
    return { cle, titre, statut: "calculee", taille, uniteEchelle: speculation.uniteEchelle, phrase: phrase(taille), detail: detailPour(taille) };
  };

  const detailPour = (taille: number): DetailTaille => {
    const { charges, revenus } = lignesPour(taille);
    const ecarts = confronterExistant({
      profil,
      ateliers: [{ speculationCode: speculation.code, taille }],
      speculations: [speculation],
      charges,
      revenus,
      heuresParJourTravail: p.heuresParJourTravail?.valeur,
    });
    const finances: ResultatFinance = calculerFinances({
      charges,
      revenus,
      menage: prelevements === undefined ? undefined : { prelevementsAnnuels: prelevements, revenusExterieursAnnuels: exterieurs },
      horizonAnnees: HORIZON_PAR_DEFAUT,
      apport: deduit.financement.apport ?? 0,
    });
    const s = finances.scenarios[p.scenario];
    const soldes = s.verdict.menageCouvert === null ? [] : s.annees.map((a) => a.soldeResiduel);
    const brut = taille * brutParUnite;
    const venduAn = taille * vendableParUnite;
    const origineCalcul = `calculé par le moteur depuis ${origineRef}${deduit.origines.length > 0 ? " et le profil du porteur" : ""}`;
    return {
      volumeVendableAn: { valeur: venduAn, unite: `${cible.unite} par an`, origine: `${rendementVendable.origine}` },
      productionNecessaireAn: { valeur: partVendue > 0 ? Math.max(brut, 0) : null, unite: `${cible.unite} par an, avant pertes`, origine: `${origineCalcul}` },
      surfaceAPrevoirHa: {
        valeur: echelleHa ? taille * (p.surfaceUtile?.valeur ?? 1) : null,
        unite: "ha",
        origine: echelleHa ? (p.surfaceUtile ? `taille × surface utile majorée (${p.surfaceUtile.source})` : "taille cultivée (surface utile non fournie : chemins et jachère non comptés)") : "non évalué : la taille ne se compte pas en hectares",
      },
      intrantsAn: { valeur: taille * u.intrants, unite: "FCFA par an", origine: origineCalcul },
      joursTravailAn: { valeur: u.jourLignes ? taille * u.jours : null, unite: "jours par an", origine: u.jourLignes ? origineCalcul : "non évalué : le référentiel ne donne pas les jours de travail" },
      investissement: { valeur: taille * u.investissement, unite: "FCFA", origine: origineCalcul },
      margeExploitationAn: { valeur: taille * margeUnite, unite: "FCFA par an, avant amortissements, impôts et annuités", origine: origineCalcul },
      depasseLeDebouche: tailleMarche !== null && taille > tailleMarche + EPSILON && venduAn > volumeAn + EPSILON,
      plafondsDepasses: evalues.filter((x) => x.tailleMax !== null && taille > x.tailleMax + EPSILON).map((x) => x.dimension),
      ecarts,
      finances: {
        statut: s.statut,
        menageCouvert: s.verdict.menageCouvert,
        soldeResiduelMinimum: soldes.length > 0 ? Math.min(...soldes) : null,
        pointBasTresorerie: s.pointBasTresorerie.montant,
        controles: s.controles.filter((c) => c.niveau !== "ok").map((c) => ({ code: c.code, niveau: c.niveau, message: c.message })),
      },
    };
  };

  const tailles: TailleProposee[] = [];
  const vide = (cle: CleTaille, titre: string, statut: "non_evaluee" | "impossible", phrase: string): TailleProposee => ({ cle, titre, statut, taille: null, uniteEchelle: speculation.uniteEchelle, phrase });

  // a) Ce que tu peux faire avec ce que tu as : la plus petite des limites évaluées.
  const TITRE_A = "Avec ce que tu as";
  if (evalues.length === 0) {
    tailles.push(vide("avec_ce_que_tu_as", TITRE_A, "non_evaluee", "Aucune de tes ressources (terre, travail, argent, eau) n'est évaluée pour l'instant : on ne peut pas dire jusqu'où tu peux aller avec ce que tu as. Complète ton profil."));
  } else {
    const limite = evalues.reduce((a, b) => ((b.tailleMax as number) < (a.tailleMax as number) ? b : a));
    tailles.push(
      montrer("avec_ce_que_tu_as", TITRE_A, limite.tailleMax as number, "bas", (t) => {
        const nonEval = plafonds.filter((x) => x.statut === "non_evalue").map((x) => x.dimension);
        return `Avec ce que tu as, la limite vient de ${NOM_PLAFOND[limite.dimension]} : jusqu'à ${nombre(t, 2)} ${speculation.uniteEchelle}.${nonEval.length > 0 ? ` Ne sont pas évalués : ${nonEval.map((d) => NOM_PLAFOND[d]).join(", ")}.` : ""}`;
      }),
    );
  }

  // b) La taille qui couvre ton coût de vie : le besoin net du ménage divisé par la marge d'exploitation d'une unité.
  const TITRE_B = "Pour couvrir ton coût de vie";
  if (prelevements === undefined) {
    tailles.push(vide("couvre_ton_cout_de_vie", TITRE_B, "non_evaluee", "Tu n'as pas donné le coût de vie annuel de ton ménage : cette taille n'est pas évaluée."));
    manques.push("Le coût de vie annuel de ton ménage (profil).");
  } else if (prelevements - exterieurs <= 0) {
    tailles.push(vide("couvre_ton_cout_de_vie", TITRE_B, "non_evaluee", `Tes revenus extérieurs (${fcfa(exterieurs)} par an) couvrent déjà ton coût de vie (${fcfa(prelevements)} par an) : le projet n'a pas besoin de le couvrir.`));
  } else if (margeUnite <= 0) {
    tailles.push(vide("couvre_ton_cout_de_vie", TITRE_B, "impossible", `À ces prix et à ces rendements, une unité de ${speculation.nom} ne dégage pas de marge d'exploitation (${fcfa(margeUnite)} par ${speculation.uniteEchelle}) : aucune taille ne couvre ton coût de vie. Revois le prix, le rendement ou les charges.`));
  } else {
    const besoin = prelevements - exterieurs;
    tailles.push(
      montrer("couvre_ton_cout_de_vie", TITRE_B, besoin / margeUnite, "haut", (t) =>
        `Ton ménage a besoin de ${fcfa(besoin)} par an (coût de vie${deduit.hypotheses.prelevementsAnnuels !== undefined && profil.credits.length > 0 ? " et crédits en cours" : ""}, moins tes revenus extérieurs). Une unité te laisse ${fcfa(margeUnite)} par an avant amortissements, impôts et crédit du projet : il faut ${nombre(t, 2)} ${speculation.uniteEchelle}.`,
      ),
    );
  }

  // c) Ce que le marché absorbe.
  const TITRE_C = "Ce que le marché absorbe";
  if (tailleMarche === null) {
    tailles.push(vide("ce_que_le_marche_absorbe", TITRE_C, "impossible", "Le rendement vendable est nul : aucun volume ne peut être produit, la taille du marché ne se calcule pas."));
  } else {
    tailles.push(
      montrer("ce_que_le_marche_absorbe", TITRE_C, tailleMarche, "bas", (t) =>
        `Pour vendre ${nombre(volumeAn, 0)} ${cible.unite} par an (${LIBELLE_DEBOUCHE[p.debouche.origine]}), il faut produire ${nombre(volumeAn / partVendue, 0)} ${cible.unite} avant pertes, soit ${nombre(t, 2)} ${speculation.uniteEchelle}.`,
      ),
    );
  }

  const donneesNonValidees =
    [...unitaire.charges, ...unitaire.revenus].some((l) => l.origine === "estimation") || unitaire.revenus.some((r) => r.bornesQuantite !== undefined && r.bornesQuantite.statut !== "validee");
  return { speculation: speculation.code, uniteEchelle: speculation.uniteEchelle, scenario: p.scenario, rendementVendable, debouche, plafonds, tailles, manques: [...new Set(manques)], donneesNonValidees };
}

const NOM_PLAFOND: Record<ClePlafond, string> = { terre: "ta terre", travail: "ton temps de travail", argent: "ton apport", eau: "ton eau" };
