// Financement complet (M6) : plusieurs prêts datés, crédit de campagne renouvelable plafonné, crédit de chaîne de valeur
// tripartite, taxe sur les intérêts, apport en nature avec sa pièce, subventions (investissement et exploitation) avec
// reprise au résultat, avance sur subvention, plan de financement emplois-ressources initial et annuel.
//
// Moteur AUTONOME, comme bandes.ts : il a sa propre grille mensuelle (mois 0 à horizonMois) en attendant que la grille de M1
// (finance.ts 2.0.0) l'absorbe. Ses sorties `mois[]` et `annees[]` portent chacune un flux de financement séparé, de sorte que
// M1 n'a qu'à les additionner à la trésorerie d'exploitation. Il ne lit pas finance.ts et n'en dépend pas.
//
// Aucune valeur de référence n'est codée : taux, plafonds de campagne (barème par spéculation), taxe sur les intérêts, durée de
// reprise d'une subvention arrivent en paramètres avec leur source (ref.baremes_credit_campagne, ref.regles_financeurs).
// Un paramètre absent n'est jamais deviné : la taxe vaut 0 et la lecture le dit ; un plafond absent laisse le tirage non vérifié.
//
// Conventions : mois 0 = démarrage ; les intérêts d'un prêt tombent à chaque échéance ; ceux d'un crédit de campagne ou d'un
// crédit de chaîne de valeur (intérêts simples) tombent au remboursement ; l'an 1 comprend le mois 0 et les mois 1 à 12.
import { z } from "zod";
import { fcfa, somme, taux, valider, VERSION_MOTEURS } from "./commun";
import { echeancierBrut, schemaCredit } from "./credit";

const moisIndex = z.number().int().min(0, "mois négatif").max(120, "au plus 120 mois");
const sourceObligatoire = z.string().trim().min(2, "la source est obligatoire");

/** Un prêt daté : tirage au mois indiqué (0 = démarrage), échéances ensuite. */
export const schemaPret = z.object({
  id: z.string().min(1),
  libelle: z.string().min(1),
  creancier: z.string().min(1).optional(),
  moisTirage: moisIndex.default(0),
  credit: schemaCredit,
});

/** Crédit de campagne : court terme, renouvelable à chaque campagne, remboursé à la récolte, plafonné par un barème. */
export const schemaCreditCampagne = z.object({
  id: z.string().min(1),
  libelle: z.string().min(1),
  tauxAnnuel: z.number().min(0).max(1),
  /** Plafond d'encours (FCFA) calculé d'après le barème par spéculation de `ref` ; absent : plafond inconnu, tirage non vérifié. */
  plafond: z.object({ montant: z.number().min(0), source: sourceObligatoire, statut: z.string().optional() }).optional(),
  campagnes: z
    .array(
      z
        .object({
          libelle: z.string().min(1).optional(),
          montantDemande: z.number().positive(),
          moisTirage: moisIndex,
          moisRemboursement: moisIndex,
        })
        .refine((c) => c.moisRemboursement > c.moisTirage, { message: "le remboursement doit venir après le tirage", path: ["moisRemboursement"] }),
    )
    .min(1),
});

/** Crédit de chaîne de valeur tripartite : la banque préfinance, l'acheteur rembourse la banque sur le paiement de la récolte. */
export const schemaCreditChaine = z
  .object({
    id: z.string().min(1),
    libelle: z.string().min(1),
    acheteur: z.string().min(1),
    montant: z.number().positive(),
    tauxAnnuel: z.number().min(0).max(1),
    moisTirage: moisIndex,
    moisPaiementAcheteur: moisIndex,
    /** Paiement que l'acheteur doit au producteur ce mois-là (FCFA). Sert à vérifier que la retenue (capital + intérêts) est couverte. */
    paiementPrevuAcheteur: z.number().min(0).optional(),
  })
  .refine((c) => c.moisPaiementAcheteur > c.moisTirage, { message: "le paiement de l'acheteur doit venir après le tirage", path: ["moisPaiementAcheteur"] });

/** Apport en nature : valorisé, retenu seulement avec sa pièce. */
export const schemaApportNature = z.object({
  libelle: z.string().min(1),
  nature: z.string().min(1).optional(),
  valeur: z.number().positive(),
  /** Pièce qui justifie la valeur (titre, attestation, facture pro forma, expertise) ; sans pièce, la valeur n'est pas retenue. */
  piece: z.string().trim().min(2).optional(),
  /** Origine de la valeur (déclaration du porteur, expertise, pro forma). */
  origineValeur: z.string().optional(),
});

export const schemaSubvention = z
  .object({
    id: z.string().min(1),
    libelle: z.string().min(1),
    financeur: z.string().min(1).optional(),
    type: z.enum(["investissement", "exploitation"]),
    montant: z.number().positive(),
    moisEncaissement: moisIndex,
    /** Subvention d'investissement : durée de reprise au résultat, en années (la durée d'amortissement du bien financé). */
    dureeRepriseAns: z.number().positive().optional(),
    /** Subvention d'exploitation : nombre de mois sur lesquels elle est rattachée au résultat (1 = le mois de l'encaissement). */
    etalementMois: z.number().int().min(1).max(120).default(1),
    /** Avance sur subvention : somme versée avant l'encaissement, remboursée sur la subvention. */
    avance: z
      .object({
        montant: z.number().positive(),
        moisAvance: moisIndex,
        /** Intérêts annuels de l'avance (0 si elle est gratuite). */
        tauxAnnuel: z.number().min(0).max(1).default(0),
      })
      .optional(),
  })
  .refine((s) => s.type !== "investissement" || s.dureeRepriseAns !== undefined, {
    message: "une subvention d'investissement doit avoir une durée de reprise au résultat",
    path: ["dureeRepriseAns"],
  })
  .refine((s) => !s.avance || (s.avance.montant <= s.montant && s.avance.moisAvance < s.moisEncaissement), {
    message: "l'avance doit être inférieure à la subvention et versée avant son encaissement",
    path: ["avance"],
  });

export const schemaFinancementComplet = z.object({
  horizonMois: z.number().int().min(1).max(120),
  /** Emplois du démarrage : investissements et besoin en fonds de roulement initial. */
  emploisInitiaux: z.object({ investissement: z.number().min(0), bfr: z.number().min(0) }),
  apportEspeces: z.number().min(0).default(0),
  apportsNature: z.array(schemaApportNature).default([]),
  prets: z.array(schemaPret).default([]),
  creditsCampagne: z.array(schemaCreditCampagne).default([]),
  creditsChaine: z.array(schemaCreditChaine).default([]),
  subventions: z.array(schemaSubvention).default([]),
  /** Taxe sur les intérêts payés (par exemple une taxe sur les activités financières) : taux appliqué aux intérêts, avec son nom et sa source. */
  taxeInterets: z.object({ taux: z.number().min(0).max(1), nom: z.string().min(1), source: sourceObligatoire, statut: z.string().optional() }).optional(),
  /** Exploitation, tirée du moteur financier, pour compléter le plan de financement annuel (une valeur par année, an 1 en premier). */
  exploitation: z
    .object({
      tresorerieInitiale: z.number().default(0),
      cafParAn: z.array(z.number()).default([]),
      investissementsParAn: z.array(z.number().min(0)).default([]),
      variationBfrParAn: z.array(z.number()).default([]),
    })
    .optional(),
});
export type EntreeFinancement = z.input<typeof schemaFinancementComplet>;

export interface MoisFinancement {
  mois: number;
  /** Argent qui entre : apport en espèces, prêts, campagne, chaîne de valeur, subventions (nettes des avances remboursées), avances. */
  entrees: number;
  /** Argent qui sort pour le financement : capital, intérêts et taxe. */
  sorties: number;
  /** Entrées moins sorties. */
  flux: number;
  apportEspeces: number;
  tiragesPrets: number;
  tiragesCampagne: number;
  tiragesChaine: number;
  subventionsEncaissees: number;
  avancesRecues: number;
  capitalPrets: number;
  interetsPrets: number;
  remboursementsCampagne: number;
  interetsCampagne: number;
  /** Retenue de l'acheteur sur le paiement de la récolte (capital + intérêts) : à retrancher de ses encaissements d'exploitation. */
  retenuesAcheteur: number;
  interetsChaine: number;
  remboursementsAvances: number;
  interetsAvances: number;
  taxeInterets: number;
  /** Subventions reprises au résultat ce mois-ci (produit non encaissé). */
  repriseSubventions: number;
  /** Dette de financement restant due en fin de mois (prêts, campagne, chaîne de valeur, avances). */
  encours: number;
}

export interface AnneeFinancement {
  an: number;
  apportEspeces: number;
  apportNature: number;
  empruntsTires: number;
  subventionsEncaissees: number;
  capitalRembourse: number;
  interets: number;
  taxeInterets: number;
  /** Intérêts + taxe : charge financière de l'année, à porter au compte de résultat. */
  fraisFinanciers: number;
  repriseSubventions: number;
  encoursFinAnnee: number;
}

export interface LignePlanFinancement {
  libelle: string;
  montant: number;
}

export interface PlanFinancementInitial {
  emplois: LignePlanFinancement[];
  ressources: LignePlanFinancement[];
  totalEmplois: number;
  totalRessources: number;
  /** Ressources − emplois : positif = surplus, négatif = besoin non financé. */
  ecart: number;
  equilibre: boolean;
  /** Part de chaque source dans le total des ressources (somme = 1). */
  partsRessources: { libelle: string; part: number }[];
}

/** Plan de financement annuel du canevas ANPGF (§10.8) : une colonne par année. */
export interface AnneePlanFinancement {
  an: number;
  tresorerieInitiale: number | null;
  ressources: { caf: number | null; apportsCapital: number; subventionsInvestissement: number; emprunts: number; reductionBfr: number | null; total: number | null };
  emplois: { acquisitionsImmobilisations: number | null; remboursementEmprunts: number; augmentationBfr: number | null; total: number | null };
  variationTresorerie: number | null;
  tresorerieFinale: number | null;
}

export type CodeControleFinancement =
  | "PLAFOND_CAMPAGNE_DEPASSE"
  | "PLAFOND_CAMPAGNE_NON_VERIFIE"
  | "APPORT_NATURE_SANS_PIECE"
  | "RETENUE_ACHETEUR_NON_COUVERTE"
  | "PLAN_FINANCEMENT_DESEQUILIBRE"
  | "TAXE_INTERETS_NON_RENSEIGNEE";

export interface ControleFinancement {
  code: CodeControleFinancement;
  niveau: "info" | "alerte" | "bloquant";
  valeurs: Record<string, number | string | null>;
  message: string;
}

export interface ResultatFinancement {
  versionMoteur: string;
  horizonMois: number;
  mois: MoisFinancement[];
  annees: AnneeFinancement[];
  planInitial: PlanFinancementInitial;
  planAnnuel: AnneePlanFinancement[];
  apport: {
    especes: number;
    natureRetenu: number;
    natureNonRetenu: number;
    /** Apport en nature sans pièce : valeur non retenue. */
    sansPiece: string[];
    total: number;
    /** Apport total / coût du projet ; null si le projet n'a aucun coût. */
    partApport: number | null;
  };
  campagnes: { id: string; plafond: number | null; tires: { libelle: string; demande: number; tire: number; autorise: number; interets: number }[] }[];
  chaines: { id: string; acheteur: string; capital: number; interets: number; retenue: number; moisPaiement: number }[];
  subventions: { id: string; type: "investissement" | "exploitation"; montant: number; avance: number }[];
  /** Plus gros encours de dette de financement, avec son mois. */
  encoursMaximum: { montant: number; mois: number };
  controles: ControleFinancement[];
  lecture: string[];
}

const dec = (x: number) => Math.round(x * 1e6) / 1e6;

export function calculerFinancement(entree: EntreeFinancement): ResultatFinancement {
  const e = valider(schemaFinancementComplet, entree, "financement");
  const H = e.horizonMois;
  const vide = (): MoisFinancement[] =>
    Array.from({ length: H + 1 }, (_, m) => ({
      mois: m, entrees: 0, sorties: 0, flux: 0, apportEspeces: 0, tiragesPrets: 0, tiragesCampagne: 0, tiragesChaine: 0,
      subventionsEncaissees: 0, avancesRecues: 0, capitalPrets: 0, interetsPrets: 0, remboursementsCampagne: 0, interetsCampagne: 0,
      retenuesAcheteur: 0, interetsChaine: 0, remboursementsAvances: 0, interetsAvances: 0, taxeInterets: 0, repriseSubventions: 0, encours: 0,
    }));
  const g = vide();
  const dansHorizon = (m: number) => m >= 0 && m <= H;
  const controles: ControleFinancement[] = [];
  const lecture: string[] = [];
  const ajouter = (m: number, champ: Exclude<keyof MoisFinancement, "mois">, v: number) => {
    if (dansHorizon(m)) g[m][champ] += v;
  };
  // Variation de l'encours de dette, mois par mois.
  const deltaEncours = new Array<number>(H + 2).fill(0);
  const bougerEncours = (m: number, v: number) => {
    if (m <= H) deltaEncours[m] += v;
  };

  ajouter(0, "apportEspeces", e.apportEspeces);

  // --- Prêts datés
  for (const p of e.prets) {
    const { echeancier } = echeancierBrut(p.credit);
    ajouter(p.moisTirage, "tiragesPrets", p.credit.montant);
    bougerEncours(p.moisTirage, p.credit.montant);
    for (const ech of echeancier) {
      const m = p.moisTirage + ech.mois;
      ajouter(m, "interetsPrets", ech.interets > 0 && ech.echeance > 0 ? Math.min(ech.interets, ech.echeance) : 0);
      // Différé total : les intérêts s'ajoutent au capital (amortissement négatif) et ne sont pas payés.
      if (ech.amortissement > 0) ajouter(m, "capitalPrets", ech.amortissement);
      if (ech.echeance === 0) bougerEncours(m, ech.interets);
      else bougerEncours(m, -Math.max(ech.amortissement, 0));
    }
  }

  // --- Crédits de campagne
  const campagnes: ResultatFinancement["campagnes"] = [];
  let campagneNonVerifiee = false;
  for (const c of e.creditsCampagne) {
    const tires: ResultatFinancement["campagnes"][number]["tires"] = [];
    const accordes: { debut: number; fin: number; montant: number }[] = [];
    const ordre = [...c.campagnes].sort((a, b) => a.moisTirage - b.moisTirage);
    for (const camp of ordre) {
      const encoursAuTirage = somme(accordes.filter((a) => a.debut < camp.moisRemboursement && a.fin > camp.moisTirage).map((a) => a.montant));
      const autorise = c.plafond ? Math.max(c.plafond.montant - encoursAuTirage, 0) : camp.montantDemande;
      const tire = Math.min(camp.montantDemande, autorise);
      const interets = tire * c.tauxAnnuel * ((camp.moisRemboursement - camp.moisTirage) / 12);
      accordes.push({ debut: camp.moisTirage, fin: camp.moisRemboursement, montant: tire });
      ajouter(camp.moisTirage, "tiragesCampagne", tire);
      bougerEncours(camp.moisTirage, tire);
      ajouter(camp.moisRemboursement, "remboursementsCampagne", tire);
      ajouter(camp.moisRemboursement, "interetsCampagne", interets);
      bougerEncours(camp.moisRemboursement, -tire);
      tires.push({ libelle: camp.libelle ?? `campagne du mois ${camp.moisTirage}`, demande: fcfa(camp.montantDemande), tire: fcfa(tire), autorise: fcfa(autorise), interets: fcfa(interets) });
      if (tire < camp.montantDemande) {
        controles.push({
          code: "PLAFOND_CAMPAGNE_DEPASSE",
          niveau: "alerte",
          valeurs: { credit: c.id, demande: fcfa(camp.montantDemande), autorise: fcfa(autorise), plafond: fcfa(c.plafond?.montant ?? 0), mois: camp.moisTirage },
          message: `Le crédit de campagne « ${c.libelle} » est plafonné : tu demandes ${fcfa(camp.montantDemande)} FCFA, le barème n'en accorde que ${fcfa(autorise)} (source : ${c.plafond?.source}). Il manque ${fcfa(camp.montantDemande - tire)} FCFA à financer autrement.`,
        });
      }
    }
    if (!c.plafond) {
      campagneNonVerifiee = true;
      controles.push({
        code: "PLAFOND_CAMPAGNE_NON_VERIFIE",
        niveau: "info",
        valeurs: { credit: c.id },
        message: `Le plafond du crédit de campagne « ${c.libelle} » n'est pas connu : le montant demandé est pris tel quel, sans vérifier le barème du financeur.`,
      });
    }
    campagnes.push({ id: c.id, plafond: c.plafond ? fcfa(c.plafond.montant) : null, tires });
  }

  // --- Crédits de chaîne de valeur
  const chaines: ResultatFinancement["chaines"] = [];
  for (const c of e.creditsChaine) {
    const interets = c.montant * c.tauxAnnuel * ((c.moisPaiementAcheteur - c.moisTirage) / 12);
    ajouter(c.moisTirage, "tiragesChaine", c.montant);
    bougerEncours(c.moisTirage, c.montant);
    ajouter(c.moisPaiementAcheteur, "retenuesAcheteur", c.montant + interets);
    ajouter(c.moisPaiementAcheteur, "interetsChaine", interets);
    bougerEncours(c.moisPaiementAcheteur, -c.montant);
    chaines.push({ id: c.id, acheteur: c.acheteur, capital: fcfa(c.montant), interets: fcfa(interets), retenue: fcfa(c.montant + interets), moisPaiement: c.moisPaiementAcheteur });
    if (c.paiementPrevuAcheteur !== undefined && c.paiementPrevuAcheteur < c.montant + interets) {
      controles.push({
        code: "RETENUE_ACHETEUR_NON_COUVERTE",
        niveau: "bloquant",
        valeurs: { credit: c.id, retenue: fcfa(c.montant + interets), paiementPrevu: fcfa(c.paiementPrevuAcheteur) },
        message: `Avec « ${c.libelle} », ${c.acheteur} doit rembourser la banque ${fcfa(c.montant + interets)} FCFA sur ton paiement, mais il ne te doit que ${fcfa(c.paiementPrevuAcheteur)} FCFA ce mois-là : le paiement ne couvre pas la dette.`,
      });
    }
  }

  // --- Subventions et avances
  const subventions: ResultatFinancement["subventions"] = [];
  for (const s of e.subventions) {
    const avance = s.avance?.montant ?? 0;
    subventions.push({ id: s.id, type: s.type, montant: fcfa(s.montant), avance: fcfa(avance) });
    // La subvention encaissée l'est nette de l'avance déjà versée ; l'avance est un flux à part.
    ajouter(s.moisEncaissement, "subventionsEncaissees", s.montant - avance);
    if (s.avance) {
      const interetsAvance = avance * s.avance.tauxAnnuel * ((s.moisEncaissement - s.avance.moisAvance) / 12);
      ajouter(s.avance.moisAvance, "avancesRecues", avance);
      bougerEncours(s.avance.moisAvance, avance);
      ajouter(s.moisEncaissement, "remboursementsAvances", avance);
      ajouter(s.moisEncaissement, "interetsAvances", interetsAvance);
      bougerEncours(s.moisEncaissement, -avance);
    }
    // Reprise au résultat : l'investissement sur la durée de reprise, l'exploitation sur l'étalement.
    if (s.type === "investissement") {
      const duree = Math.round((s.dureeRepriseAns ?? 1) * 12);
      for (let k = 1; k <= duree; k++) ajouter(s.moisEncaissement + k, "repriseSubventions", s.montant / duree);
    } else {
      for (let k = 0; k < s.etalementMois; k++) ajouter(s.moisEncaissement + k, "repriseSubventions", s.montant / s.etalementMois);
    }
  }

  // --- Taxe sur les intérêts, totaux mensuels et encours
  const tauxTaxe = e.taxeInterets?.taux ?? 0;
  const aDesInterets = somme(g.map((m) => m.interetsPrets + m.interetsCampagne + m.interetsChaine + m.interetsAvances)) > 0;
  if (!e.taxeInterets && aDesInterets) {
    controles.push({
      code: "TAXE_INTERETS_NON_RENSEIGNEE",
      niveau: "info",
      valeurs: {},
      message: "Aucune taxe sur les intérêts n'est prise en compte : elle n'est pas renseignée. Si ton financeur en applique une, les frais financiers sont sous-estimés.",
    });
  }
  let encours = 0;
  let maxEncours = { montant: 0, mois: 0 };
  for (let m = 0; m <= H; m++) {
    const x = g[m];
    // La retenue de l'acheteur n'est pas une sortie de caisse de financement : elle réduit les ventes encaissées (voir retenuesAcheteur).
    // On la compte donc comme sortie de financement pour que le flux soit complet ; l'appelant ne la retranche pas deux fois.
    x.taxeInterets = tauxTaxe * (x.interetsPrets + x.interetsCampagne + x.interetsChaine + x.interetsAvances);
    x.entrees = x.apportEspeces + x.tiragesPrets + x.tiragesCampagne + x.tiragesChaine + x.subventionsEncaissees + x.avancesRecues;
    x.sorties = x.capitalPrets + x.interetsPrets + x.remboursementsCampagne + x.interetsCampagne + x.retenuesAcheteur + x.remboursementsAvances + x.interetsAvances + x.taxeInterets;
    x.flux = x.entrees - x.sorties;
    encours += deltaEncours[m];
    x.encours = encours;
    if (encours > maxEncours.montant) maxEncours = { montant: encours, mois: m };
  }

  // --- Apport
  const nature = e.apportsNature;
  const retenu = somme(nature.filter((a) => a.piece).map((a) => a.valeur));
  const nonRetenu = somme(nature.filter((a) => !a.piece).map((a) => a.valeur));
  const sansPiece = nature.filter((a) => !a.piece).map((a) => a.libelle);
  if (sansPiece.length > 0) {
    controles.push({
      code: "APPORT_NATURE_SANS_PIECE",
      niveau: "alerte",
      valeurs: { valeurNonRetenue: fcfa(nonRetenu), apports: sansPiece.join(", ") },
      message: `Ton apport en nature (${sansPiece.join(", ")}) vaut ${fcfa(nonRetenu)} FCFA mais aucune pièce ne le prouve : il n'est pas compté dans ton apport. Joins le titre, l'attestation, la facture pro forma ou une expertise.`,
    });
  }
  const apportTotal = e.apportEspeces + retenu;
  const coutProjet = e.emploisInitiaux.investissement + e.emploisInitiaux.bfr;

  // --- Plan de financement initial (mois 0, plus les ressources de financement du mois 0 seulement)
  const m0 = g[0];
  const ressources: LignePlanFinancement[] = [
    { libelle: "Apport en espèces", montant: e.apportEspeces },
    { libelle: "Apport en nature (avec pièce)", montant: retenu },
    { libelle: "Prêts", montant: m0.tiragesPrets },
    { libelle: "Crédit de campagne", montant: m0.tiragesCampagne },
    { libelle: "Crédit de chaîne de valeur", montant: m0.tiragesChaine },
    { libelle: "Subventions d'investissement", montant: somme(e.subventions.filter((s) => s.type === "investissement" && s.moisEncaissement === 0).map((s) => s.montant)) },
    { libelle: "Avances sur subvention", montant: m0.avancesRecues },
  ].filter((l) => l.montant > 0);
  const emplois: LignePlanFinancement[] = [
    { libelle: "Investissements", montant: e.emploisInitiaux.investissement },
    { libelle: "Besoin en fonds de roulement initial", montant: e.emploisInitiaux.bfr },
  ];
  const totalR = somme(ressources.map((r) => r.montant));
  const totalE = coutProjet;
  const planInitial: PlanFinancementInitial = {
    emplois: emplois.map((l) => ({ ...l, montant: fcfa(l.montant) })),
    ressources: ressources.map((l) => ({ ...l, montant: fcfa(l.montant) })),
    totalEmplois: fcfa(totalE),
    totalRessources: fcfa(totalR),
    ecart: fcfa(totalR - totalE),
    equilibre: Math.abs(totalR - totalE) < 0.5,
    partsRessources: totalR > 0 ? ressources.map((r) => ({ libelle: r.libelle, part: taux(r.montant / totalR) })) : [],
  };
  if (!planInitial.equilibre) {
    const manque = totalE - totalR;
    controles.push({
      code: "PLAN_FINANCEMENT_DESEQUILIBRE",
      niveau: manque > 0 ? "bloquant" : "info",
      valeurs: { emplois: fcfa(totalE), ressources: fcfa(totalR), ecart: fcfa(totalR - totalE) },
      message:
        manque > 0
          ? `Le plan de financement ne boucle pas : le démarrage coûte ${fcfa(totalE)} FCFA et les ressources n'en couvrent que ${fcfa(totalR)} FCFA. Il manque ${fcfa(manque)} FCFA.`
          : `Les ressources (${fcfa(totalR)} FCFA) dépassent le coût du démarrage (${fcfa(totalE)} FCFA) de ${fcfa(-manque)} FCFA : ce surplus est de l'argent en caisse, pas un besoin.`,
    });
  }

  // --- Années
  const nAns = Math.ceil(H / 12);
  const annees: AnneeFinancement[] = [];
  const anDuMois = (m: number) => Math.max(1, Math.ceil(m / 12));
  for (let an = 1; an <= nAns; an++) {
    const ms = g.filter((x) => anDuMois(x.mois) === an);
    const interets = somme(ms.map((x) => x.interetsPrets + x.interetsCampagne + x.interetsChaine + x.interetsAvances));
    const taxe = somme(ms.map((x) => x.taxeInterets));
    annees.push({
      an,
      apportEspeces: fcfa(somme(ms.map((x) => x.apportEspeces))),
      apportNature: an === 1 ? fcfa(retenu) : 0,
      empruntsTires: fcfa(somme(ms.map((x) => x.tiragesPrets + x.tiragesCampagne + x.tiragesChaine + x.avancesRecues))),
      subventionsEncaissees: fcfa(somme(ms.map((x) => x.subventionsEncaissees))),
      capitalRembourse: fcfa(somme(ms.map((x) => x.capitalPrets + x.remboursementsCampagne + x.remboursementsAvances + x.retenuesAcheteur - x.interetsChaine))),
      interets: fcfa(interets),
      taxeInterets: fcfa(taxe),
      fraisFinanciers: fcfa(interets + taxe),
      repriseSubventions: fcfa(somme(ms.map((x) => x.repriseSubventions))),
      encoursFinAnnee: fcfa(ms[ms.length - 1]?.encours ?? 0),
    });
  }

  // --- Plan de financement annuel (canevas §10.8) ; les lignes d'exploitation restent null tant que l'appelant ne les fournit pas
  const ex = e.exploitation;
  const planAnnuel: AnneePlanFinancement[] = [];
  let tresoPrecedente = ex ? ex.tresorerieInitiale : null;
  for (const a of annees) {
    const caf = ex && ex.cafParAn[a.an - 1] !== undefined ? ex.cafParAn[a.an - 1] : null;
    const invest = ex && ex.investissementsParAn[a.an - 1] !== undefined ? ex.investissementsParAn[a.an - 1] : null;
    const dBfr = ex && ex.variationBfrParAn[a.an - 1] !== undefined ? ex.variationBfrParAn[a.an - 1] : null;
    const subvInvest = somme(e.subventions.filter((s) => s.type === "investissement" && anDuMois(s.moisEncaissement) === a.an).map((s) => s.montant));
    const complet = caf !== null && invest !== null && dBfr !== null && tresoPrecedente !== null;
    const reductionBfr = dBfr === null ? null : Math.max(-dBfr, 0);
    const augmentationBfr = dBfr === null ? null : Math.max(dBfr, 0);
    const apportsCapital = a.apportEspeces + a.apportNature;
    const emprunts = a.empruntsTires;
    const capital = a.capitalRembourse;
    const totalR = complet ? (caf as number) + apportsCapital + subvInvest + emprunts + (reductionBfr as number) : null;
    // Les frais financiers sont déjà dans la CAF (résultat) ; la subvention d'exploitation aussi.
    const totalE = complet ? (invest as number) + capital + (augmentationBfr as number) : null;
    const variation = totalR !== null && totalE !== null ? totalR - totalE : null;
    const finale = variation !== null && tresoPrecedente !== null ? tresoPrecedente + variation : null;
    planAnnuel.push({
      an: a.an,
      tresorerieInitiale: tresoPrecedente === null ? null : fcfa(tresoPrecedente),
      ressources: {
        caf: caf === null ? null : fcfa(caf),
        apportsCapital: fcfa(apportsCapital),
        subventionsInvestissement: fcfa(subvInvest),
        emprunts: fcfa(emprunts),
        reductionBfr: reductionBfr === null ? null : fcfa(reductionBfr),
        total: totalR === null ? null : fcfa(totalR),
      },
      emplois: {
        acquisitionsImmobilisations: invest === null ? null : fcfa(invest),
        remboursementEmprunts: fcfa(capital),
        augmentationBfr: augmentationBfr === null ? null : fcfa(augmentationBfr),
        total: totalE === null ? null : fcfa(totalE),
      },
      variationTresorerie: variation === null ? null : fcfa(variation),
      tresorerieFinale: finale === null ? null : fcfa(finale),
    });
    tresoPrecedente = finale;
  }

  // --- Lecture en langage simple
  lecture.push(`Ton projet coûte ${fcfa(coutProjet)} FCFA au démarrage : ${fcfa(e.emploisInitiaux.investissement)} FCFA d'investissements et ${fcfa(e.emploisInitiaux.bfr)} FCFA de fonds de roulement.`);
  if (coutProjet > 0) lecture.push(`Ton apport compte pour ${Math.round((apportTotal / coutProjet) * 1000) / 10} % du coût (${fcfa(e.apportEspeces)} FCFA en espèces, ${fcfa(retenu)} FCFA en nature avec pièce).`);
  if (e.taxeInterets) lecture.push(`La ${e.taxeInterets.nom} de ${Math.round(e.taxeInterets.taux * 1000) / 10} % sur les intérêts est comptée (source : ${e.taxeInterets.source}).`);
  if (maxEncours.montant > 0) lecture.push(`Ta dette de financement culmine à ${fcfa(maxEncours.montant)} FCFA au mois ${maxEncours.mois}.`);
  if (campagneNonVerifiee) lecture.push("Le plafond du crédit de campagne n'est pas connu : le montant demandé n'est pas vérifié.");
  if (!ex) lecture.push("Le plan de financement annuel est partiel : la CAF, les investissements et la variation du besoin en fonds de roulement viennent du moteur financier et n'ont pas été fournis.");

  return {
    versionMoteur: VERSION_MOTEURS,
    horizonMois: H,
    mois: g.map((x) => ({
      mois: x.mois, entrees: fcfa(x.entrees), sorties: fcfa(x.sorties), flux: fcfa(x.flux), apportEspeces: fcfa(x.apportEspeces),
      tiragesPrets: fcfa(x.tiragesPrets), tiragesCampagne: fcfa(x.tiragesCampagne), tiragesChaine: fcfa(x.tiragesChaine),
      subventionsEncaissees: fcfa(x.subventionsEncaissees), avancesRecues: fcfa(x.avancesRecues), capitalPrets: fcfa(x.capitalPrets),
      interetsPrets: fcfa(x.interetsPrets), remboursementsCampagne: fcfa(x.remboursementsCampagne), interetsCampagne: fcfa(x.interetsCampagne),
      retenuesAcheteur: fcfa(x.retenuesAcheteur), interetsChaine: fcfa(x.interetsChaine), remboursementsAvances: fcfa(x.remboursementsAvances),
      interetsAvances: fcfa(x.interetsAvances), taxeInterets: fcfa(x.taxeInterets), repriseSubventions: fcfa(x.repriseSubventions), encours: fcfa(x.encours),
    })),
    annees,
    planInitial,
    planAnnuel,
    apport: {
      especes: fcfa(e.apportEspeces),
      natureRetenu: fcfa(retenu),
      natureNonRetenu: fcfa(nonRetenu),
      sansPiece,
      total: fcfa(apportTotal),
      partApport: coutProjet > 0 ? taux(apportTotal / coutProjet) : null,
    },
    campagnes,
    chaines,
    subventions,
    encoursMaximum: { montant: fcfa(maxEncours.montant), mois: maxEncours.mois },
    controles,
    lecture,
  };
}

/** Plafond d'un crédit de campagne d'après le barème par spéculation de `ref` : plafond par unité d'échelle × taille de l'atelier. */
export function plafondCampagne(bareme: { plafondParUnite: number; source: string; statut?: string }, tailleAtelier: number): { montant: number; source: string; statut?: string } {
  return { montant: dec(bareme.plafondParUnite * tailleAtelier), source: bareme.source, ...(bareme.statut ? { statut: bareme.statut } : {}) };
}

/**
 * Passe le financement détaillé à la grille de M1 (`calculerFinances({ financement })`) : les mois du moteur, classés selon ce que la grille en fait
 * (apport, tirages, subventions, intérêts, taxe, capital). La retenue de l'acheteur est déjà dans `capital` et `interets` : elle ne se retranche pas
 * une seconde fois des ventes. Le plan ne doit pas passer en plus son `credit` ni son `apport` à la grille (le moteur financier les ignore alors).
 */
export function financementPourMoteur(mois: readonly MoisFinancement[]) {
  return {
    origine: "financement détaillé (M6)",
    mois: mois.map((x) => ({
      mois: x.mois,
      apportEspeces: x.apportEspeces,
      tirages: x.tiragesPrets + x.tiragesCampagne + x.tiragesChaine + x.avancesRecues,
      subventionsEncaissees: x.subventionsEncaissees,
      interets: x.interetsPrets + x.interetsCampagne + x.interetsChaine + x.interetsAvances,
      taxeInterets: x.taxeInterets,
      capital: x.capitalPrets + x.remboursementsCampagne + x.remboursementsAvances + x.retenuesAcheteur - x.interetsChaine,
      repriseSubventions: x.repriseSubventions,
    })),
  };
}
