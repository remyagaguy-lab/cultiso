// Atelier animal à bandes (M14) : courbes mensuelles par âge (mortalité, consommation, production), phase improductive,
// réforme et vente des réformées, coût de l'animal prêt à produire, seuil technique (seuil de ponte), bandes décalées,
// autofinancement du renouvellement. Généralise le modèle d'une bande de pondeuses du DOC-00686 (Burkina Faso).
// Code pur : aucune courbe, aucun prix, aucune durée n'est écrit ici. Les courbes viennent du référentiel (ref.courbes_age, avec
// source, date et statut), les prix et les effectifs de l'appelant. Une courbe qui n'a pas de valeur à un âge de la bande n'est
// pas prolongée : le moteur refuse la simulation et dit quel âge manque.
//
// Conventions (celles du modèle source) : les morts, la consommation et la production d'un mois se calculent sur l'effectif présent
// en DÉBUT de mois ; le mois compte `joursParMois` jours ; les réformées sont l'effectif qui reste à la fin du dernier mois de la bande.
// Mois de grille : 1 = premier mois de la première bande ; le mois 0 porte l'investissement et l'apport.
import { z } from "zod";
import { ErreurMoteur, fcfa, taux, valider, VERSION_MOTEURS } from "./commun";

const age = z.number().int().min(1);
const courbe = z.array(z.object({ age, valeur: z.number().min(0) })).min(1);
const montant = z.number().min(0);

export const schemaBandes = z.object({
  courbes: z.object({
    /** Part de l'effectif présent en début de mois qui meurt dans le mois (0,04 = 4 %). */
    mortalite: courbe,
    /** Aliment en grammes par sujet et par jour. */
    consommation: courbe,
    /** Production par sujet et par jour (0,75 = 0,75 œuf par poule et par jour). Zéro pendant la phase improductive. */
    production: courbe,
  }),
  /** Jours comptés par mois (convention du modèle source, fournie avec sa source). */
  joursParMois: z.number().positive().max(31),
  /** Âge, en mois, auquel la bande est réformée : elle vit `dureeBandeMois` mois et est vendue à la fin du dernier. */
  dureeBandeMois: z.number().int().min(1).max(60),
  /** Bandes mises en place : le mois de la grille où chacune démarre et son effectif (bandes décalées : plusieurs). */
  bandes: z
    .array(z.object({ id: z.string().min(1).optional(), debutMois: z.number().int().min(1).max(120), effectif: z.number().positive() }))
    .min(1)
    .max(12),
  prix: z.object({
    /** FCFA par sujet mis en place (poussin, poulette). */
    animal: montant,
    /** FCFA par kilo d'aliment. */
    aliment: montant,
    /** FCFA par unité produite (un œuf). */
    produit: montant,
    /** FCFA par sujet réformé vendu. */
    reforme: montant,
  }),
  /** Charges par sujet présent et par mois (santé, litière...). */
  chargesParSujetMois: z.array(z.object({ libelle: z.string().min(1), montant })).default([]),
  /** Charges fixes mensuelles (salaires, eau, électricité), payées chaque mois de la grille à partir de `aPartirDuMois` (1 par défaut). */
  chargesFixesMensuelles: z.array(z.object({ libelle: z.string().min(1), montant, aPartirDuMois: z.number().int().min(1).optional() })).default([]),
  /** Bâtiments et équipements, payés au mois 0. */
  investissement: montant.default(0),
  /** Apport mis en caisse au mois 0. */
  apport: montant.default(0),
});
export type EntreeBandes = z.input<typeof schemaBandes>;

export interface MoisBandes {
  /** 0 = démarrage ; 1 à N = mois de la grille. */
  mois: number;
  effectifDebut: number;
  morts: number;
  /** Effectif des bandes qui produisent ce mois-là (début de mois). */
  effectifProducteur: number;
  alimentKg: number;
  production: number;
  ventesProduit: number;
  ventesReformees: number;
  achatsAnimaux: number;
  alimentFcfa: number;
  chargesParSujet: number;
  chargesFixes: number;
  investissement: number;
  entrees: number;
  sorties: number;
  /** entrées − sorties. */
  solde: number;
  /** Trésorerie cumulée, apport compris. */
  cumul: number;
}

export interface CoutAnimalPretAProduire {
  /** Bande de référence : la première. */
  bande: string;
  moisImproductifs: number;
  effectifMisEnPlace: number;
  /** Survivants au début du premier mois de production. */
  effectifPretAProduire: number;
  achatAnimaux: number;
  aliment: number;
  chargesParSujet: number;
  total: number;
  parSujetMisEnPlace: number;
  parSujetPretAProduire: number;
  /** Charges fixes payées pendant la phase par tout l'atelier : montrées, pas imputées au sujet (elles sont partagées entre bandes). */
  chargesFixesDeLaPhase: number;
}

export interface SeuilTechnique {
  /** Production par sujet et par jour qui couvre juste les charges d'exploitation (aliment, charges par sujet, charges fixes) des mois de production. */
  seuilMoyen: number | null;
  /** Production par sujet et par jour prévue par les courbes sur les mêmes mois. */
  prevuMoyen: number;
  /** prévu − seuil ; négatif : les charges ne sont pas couvertes. */
  margeSecurite: number | null;
  seuilAtteint: boolean | null;
  parMois: { mois: number; seuil: number | null; prevu: number }[];
}

export interface Renouvellement {
  /** Trésorerie cumulée à la fin, sans l'apport ni l'investissement. */
  autofinancement: number;
  /** Argent à avancer pour redémarrer une bande identique (point bas de sa trésorerie, charges d'exploitation seules). */
  besoinRedemarrage: number;
  autofinance: boolean;
  /** Ce qui reste une fois la bande suivante payée, jamais négatif. */
  retraitPossible: number;
  /** Retrait possible étalé sur la durée d'une bande (convention du DOC-00686). */
  retraitPossibleParMois: number;
}

export interface ResultatBandes {
  versionMoteur: string;
  horizonMois: number;
  mois: MoisBandes[];
  totalProduction: number;
  totalVentes: number;
  coutAnimalPretAProduire: CoutAnimalPretAProduire | null;
  seuilTechnique: SeuilTechnique;
  /** Point bas de la trésorerie cumulée (apport et investissement compris), mois 0 à N. */
  pointBasTresorerie: { montant: number; mois: number };
  /** Point bas sans l'apport : l'argent à trouver pour mener l'atelier jusqu'au bout. */
  besoinFinancement: number;
  apportSuffisant: boolean;
  renouvellement: Renouvellement;
  /** Phrases simples : ce que les chiffres veulent dire, et ce qui n'est pas évalué. */
  lecture: string[];
}

interface Courbes {
  mortalite: Map<number, number>;
  consommation: Map<number, number>;
  production: Map<number, number>;
}

function lireCourbes(e: z.output<typeof schemaBandes>): Courbes {
  const noms = { mortalite: "de mortalité", consommation: "de consommation", production: "de production" } as const;
  const courbes = {} as Courbes;
  for (const cle of ["mortalite", "consommation", "production"] as const) {
    const m = new Map<number, number>();
    for (const p of e.courbes[cle]) {
      if (m.has(p.age)) throw new ErreurMoteur(`La courbe ${noms[cle]} donne deux valeurs pour le mois ${p.age}.`);
      m.set(p.age, p.valeur);
    }
    for (let a = 1; a <= e.dureeBandeMois; a++) {
      if (!m.has(a)) throw new ErreurMoteur(`La courbe ${noms[cle]} n'a pas de valeur pour le mois ${a} de vie de la bande : elle n'est pas prolongée, la simulation est refusée. Fais compléter la courbe dans le référentiel ou raccourcis la bande.`);
    }
    if (cle !== "consommation") for (const [a, v] of m) if (v > 1) throw new ErreurMoteur(`La courbe ${noms[cle]} dépasse 100 % au mois ${a}.`);
    courbes[cle] = m;
  }
  return courbes;
}

interface Sim {
  grille: MoisBandes[];
  premierMoisProduction: number | null;
  /** Par bande : mois d'âge → effectif début et morts, pour le coût de l'animal prêt à produire. */
  ageDebut: Map<number, number>;
}

/** Simule des bandes sur la grille mensuelle. Sans investissement ni apport : charges et ventes d'exploitation seules. */
function simuler(e: z.output<typeof schemaBandes>, c: Courbes, bandes: z.output<typeof schemaBandes>["bandes"], avec: { investissement: boolean; apport: boolean }): Sim {
  const horizon = Math.max(...bandes.map((b) => b.debutMois + e.dureeBandeMois - 1));
  const grille: MoisBandes[] = Array.from({ length: horizon + 1 }, (_, mois) => ({
    mois, effectifDebut: 0, morts: 0, effectifProducteur: 0, alimentKg: 0, production: 0, ventesProduit: 0, ventesReformees: 0, achatsAnimaux: 0,
    alimentFcfa: 0, chargesParSujet: 0, chargesFixes: 0, investissement: 0, entrees: 0, sorties: 0, solde: 0, cumul: 0,
  }));
  const parSujet = e.chargesParSujetMois.reduce((s, l) => s + l.montant, 0);
  const ageDebut = new Map<number, number>();
  bandes.forEach((b, indice) => {
    let effectif = b.effectif;
    for (let a = 1; a <= e.dureeBandeMois; a++) {
      const m = grille[b.debutMois + a - 1];
      const morts = effectif * (c.mortalite.get(a) as number);
      const tauxProduction = c.production.get(a) as number;
      const kg = (effectif * (c.consommation.get(a) as number) * e.joursParMois) / 1000;
      const unites = effectif * tauxProduction * e.joursParMois;
      m.effectifDebut += effectif;
      m.morts += morts;
      if (tauxProduction > 0) m.effectifProducteur += effectif;
      m.alimentKg += kg;
      m.production += unites;
      m.ventesProduit += unites * e.prix.produit;
      m.alimentFcfa += kg * e.prix.aliment;
      m.chargesParSujet += effectif * parSujet;
      if (a === 1) m.achatsAnimaux += effectif * e.prix.animal;
      if (a === e.dureeBandeMois) m.ventesReformees += (effectif - morts) * e.prix.reforme;
      if (indice === 0) ageDebut.set(a, effectif);
      effectif -= morts;
    }
  });
  for (const m of grille) {
    if (m.mois >= 1) m.chargesFixes = e.chargesFixesMensuelles.filter((l) => m.mois >= (l.aPartirDuMois ?? 1)).reduce((s, l) => s + l.montant, 0);
  }
  if (avec.investissement) grille[0].investissement = e.investissement;
  let cumul = 0;
  for (const m of grille) {
    m.entrees = m.ventesProduit + m.ventesReformees + (m.mois === 0 && avec.apport ? e.apport : 0);
    m.sorties = m.achatsAnimaux + m.alimentFcfa + m.chargesParSujet + m.chargesFixes + m.investissement;
    m.solde = m.entrees - m.sorties;
    cumul += m.solde;
    m.cumul = cumul;
  }
  const premier = [...c.production.entries()].filter(([a, v]) => a <= e.dureeBandeMois && v > 0).map(([a]) => a);
  return { grille, premierMoisProduction: premier.length > 0 ? Math.min(...premier) : null, ageDebut };
}

export function simulerBandes(entree: EntreeBandes): ResultatBandes {
  const e = valider(schemaBandes, entree, "bandes");
  const c = lireCourbes(e);
  const plein = simuler(e, c, e.bandes, { investissement: true, apport: true });
  const horizon = plein.grille.length - 1;

  // Trésorerie : arrondis en sortie seulement.
  const mois: MoisBandes[] = plein.grille.map((m) => ({
    ...m,
    effectifDebut: Math.round(m.effectifDebut * 100) / 100,
    morts: Math.round(m.morts * 100) / 100,
    effectifProducteur: Math.round(m.effectifProducteur * 100) / 100,
    alimentKg: Math.round(m.alimentKg * 10) / 10,
    production: Math.round(m.production),
    ventesProduit: fcfa(m.ventesProduit),
    ventesReformees: fcfa(m.ventesReformees),
    achatsAnimaux: fcfa(m.achatsAnimaux),
    alimentFcfa: fcfa(m.alimentFcfa),
    chargesParSujet: fcfa(m.chargesParSujet),
    chargesFixes: fcfa(m.chargesFixes),
    investissement: fcfa(m.investissement),
    entrees: fcfa(m.entrees),
    sorties: fcfa(m.sorties),
    solde: fcfa(m.solde),
    cumul: fcfa(m.cumul),
  }));

  const lecture: string[] = [];
  const premier = plein.premierMoisProduction;

  // Coût de l'animal prêt à produire (première bande).
  let cout: CoutAnimalPretAProduire | null = null;
  const b0 = e.bandes[0];
  if (premier !== null) {
    const phase = premier - 1;
    let effectifPret = b0.effectif;
    let aliment = 0;
    let sanitaire = 0;
    const parSujet = e.chargesParSujetMois.reduce((s, l) => s + l.montant, 0);
    for (let a = 1; a <= phase; a++) {
      const eff = plein.ageDebut.get(a) as number;
      aliment += ((eff * (c.consommation.get(a) as number) * e.joursParMois) / 1000) * e.prix.aliment;
      sanitaire += eff * parSujet;
      effectifPret = eff * (1 - (c.mortalite.get(a) as number));
    }
    const effectifPretFinal = phase === 0 ? b0.effectif : effectifPret;
    const achat = b0.effectif * e.prix.animal;
    const total = achat + aliment + sanitaire;
    let fixes = 0;
    for (let a = 1; a <= phase; a++) fixes += plein.grille[b0.debutMois + a - 1].chargesFixes;
    cout = {
      bande: b0.id ?? "bande 1",
      moisImproductifs: phase,
      effectifMisEnPlace: b0.effectif,
      effectifPretAProduire: Math.round(effectifPretFinal * 100) / 100,
      achatAnimaux: fcfa(achat),
      aliment: fcfa(aliment),
      chargesParSujet: fcfa(sanitaire),
      total: fcfa(total),
      parSujetMisEnPlace: Math.round((total / b0.effectif) * 100) / 100,
      parSujetPretAProduire: Math.round((total / effectifPretFinal) * 100) / 100,
      chargesFixesDeLaPhase: fcfa(fixes),
    };
    lecture.push(
      `Un sujet prêt à produire te coûte ${nombre(cout.parSujetPretAProduire)} FCFA (${nombre(cout.total, 0)} FCFA d'achat, d'aliment et de soins pendant ${phase} mois, pour ${nombre(cout.effectifPretAProduire, 0)} sujets qui arrivent vivants au début de la production). Les charges fixes de ces mois (${nombre(cout.chargesFixesDeLaPhase, 0)} FCFA) ne sont pas comptées dans ce coût : elles sont partagées entre les bandes.`,
    );
  } else {
    lecture.push("Les courbes ne donnent aucune production : le coût de l'animal prêt à produire et le seuil technique ne sont pas évalués.");
  }

  // Seuil technique (seuil de ponte) : charges d'exploitation des mois où au moins une bande produit.
  const parMois: SeuilTechnique["parMois"] = [];
  let chargesTotal = 0;
  let valeurSeuil = 0;
  let prod = 0;
  let sujetsJours = 0;
  for (const m of plein.grille) {
    if (m.mois < 1 || m.effectifProducteur <= 0) continue;
    const charges = m.alimentFcfa + m.chargesParSujet + m.chargesFixes;
    const exposition = m.effectifProducteur * e.joursParMois;
    parMois.push({ mois: m.mois, seuil: e.prix.produit > 0 ? taux(charges / (e.prix.produit * exposition)) : null, prevu: taux(m.production / exposition) });
    chargesTotal += charges;
    valeurSeuil += e.prix.produit * exposition;
    prod += m.production;
    sujetsJours += exposition;
  }
  const seuilMoyen = e.prix.produit > 0 && sujetsJours > 0 ? chargesTotal / valeurSeuil : null;
  const prevuMoyen = sujetsJours > 0 ? prod / sujetsJours : 0;
  const seuilTechnique: SeuilTechnique = {
    seuilMoyen: seuilMoyen === null ? null : taux(seuilMoyen),
    prevuMoyen: taux(prevuMoyen),
    margeSecurite: seuilMoyen === null ? null : taux(prevuMoyen - seuilMoyen),
    seuilAtteint: seuilMoyen === null ? null : prevuMoyen >= seuilMoyen,
    parMois,
  };
  if (seuilMoyen !== null) {
    lecture.push(
      `Pour couvrir ses charges de fonctionnement, l'atelier doit produire ${nombre(seuilMoyen * 100)} % (par sujet et par jour) en moyenne pendant la production ; les courbes en prévoient ${nombre(prevuMoyen * 100)} %. ${prevuMoyen >= seuilMoyen ? `La marge de sécurité est de ${nombre((prevuMoyen - seuilMoyen) * 100)} points.` : "Les charges ne sont pas couvertes : revois le prix, les charges ou la taille."}`,
    );
  } else if (e.prix.produit === 0) {
    lecture.push("Le prix du produit est nul : le seuil technique n'est pas évalué.");
  }

  // Trésorerie, besoin de financement.
  let bas = plein.grille[0];
  for (const m of plein.grille) if (m.cumul < bas.cumul) bas = m;
  // Argent à trouver : le point bas de la trésorerie sans l'apport (investissement compris).
  const sansApport = simuler(e, c, e.bandes, { investissement: true, apport: false }).grille;
  const besoinFinancement = fcfa(-Math.min(0, ...sansApport.map((m) => m.cumul)));
  const apportSuffisant = e.apport >= besoinFinancement;

  // Renouvellement : la trésorerie de fin paie-t-elle de quoi redémarrer une bande identique ?
  const exploitation = simuler(e, c, e.bandes, { investissement: false, apport: false }).grille;
  const bande = simuler(e, c, [{ ...b0, debutMois: 1 }], { investissement: false, apport: false }).grille;
  const besoinRedemarrage = fcfa(-Math.min(0, ...bande.map((m) => m.cumul)));
  const autofinancement = fcfa(exploitation[exploitation.length - 1].cumul);
  const retrait = Math.max(0, autofinancement - besoinRedemarrage);
  const renouvellement: Renouvellement = {
    autofinancement,
    besoinRedemarrage,
    autofinance: autofinancement >= besoinRedemarrage,
    retraitPossible: fcfa(retrait),
    retraitPossibleParMois: fcfa(retrait / e.dureeBandeMois),
  };
  lecture.push(
    `Il faut trouver ${nombre(besoinFinancement, 0)} FCFA (investissement de ${nombre(e.investissement, 0)} FCFA compris) pour tenir jusqu'au point bas de la trésorerie ; ton apport de ${nombre(e.apport, 0)} FCFA ${apportSuffisant ? "suffit" : "ne suffit pas"}.` +
      ` À la fin, l'atelier dégage ${nombre(autofinancement, 0)} FCFA ; redémarrer une bande en demande ${nombre(besoinRedemarrage, 0)} FCFA : ${renouvellement.autofinance ? `le renouvellement est financé par l'atelier et il reste ${nombre(retrait, 0)} FCFA à retirer (${nombre(renouvellement.retraitPossibleParMois, 0)} FCFA par mois sur la durée d'une bande).` : "le renouvellement n'est pas financé par l'atelier seul."}`,
  );

  return {
    versionMoteur: VERSION_MOTEURS,
    horizonMois: horizon,
    mois,
    totalProduction: Math.round(plein.grille.reduce((s, m) => s + m.production, 0)),
    totalVentes: fcfa(plein.grille.reduce((s, m) => s + m.ventesProduit + m.ventesReformees, 0)),
    coutAnimalPretAProduire: cout,
    seuilTechnique,
    pointBasTresorerie: { montant: bas.cumul === 0 ? 0 : fcfa(bas.cumul), mois: bas.mois },
    besoinFinancement,
    apportSuffisant,
    renouvellement,
    lecture,
  };
}

const nombre = (v: number, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(v).replace(/\s/g, " ");
