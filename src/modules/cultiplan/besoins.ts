// Existant contre besoins (R10, M13) : confronte le profil du porteur et son existant (R9) à ce que le référentiel dit
// que la production demande (modèles de charges et de revenus, bornes de rendement).
// Service PUR : aucune lecture de base, aucun appel au modèle. Rien n'est inventé : quand le référentiel ne donne pas
// la donnée, ou que le porteur n'a pas répondu, l'écart est « non évalué » et la phrase dit ce qui manque.
// Les montants viennent des lignes du générateur de budget (src/moteurs/budget.ts), les comptes rendus des moteurs ne sont pas refaits ici.
import type { LigneChargeBudget, LigneRevenuBudget } from "@/moteurs/budget";
import type { Feu } from "@/referentiel";
import { valeur, type ProfilPorteur } from "./profil";

export type FeuEcart = Feu | "non_evalue";
export type DimensionBesoin = "terre" | "eau" | "travail" | "argent" | "materiel" | "rendement";

export interface EcartBesoin {
  /** Nom stable de l'écart. */
  code: "TERRE_SURFACE" | "EAU_BESOIN" | "TRAVAIL_JOURS" | "ARGENT_INVESTISSEMENT" | "MATERIEL_EXISTANT" | "RENDEMENT_BORNES";
  dimension: DimensionBesoin;
  feu: FeuEcart;
  /** Une phrase simple, à dire telle quelle. */
  phrase: string;
  /** Ce que demande le projet d'après le référentiel (texte avec unité), si connu. */
  besoin: string | null;
  /** Ce que le porteur a, si connu. */
  disponible: string | null;
}

export interface AtelierBesoin {
  speculationCode: string;
  taille: number;
}
export interface SpeculationBesoin {
  code: string;
  nom: string;
  uniteEchelle: string;
}

export interface EntreeBesoins {
  profil: ProfilPorteur;
  ateliers: AtelierBesoin[];
  speculations: SpeculationBesoin[];
  /** Lignes du générateur de budget pour ces ateliers (quantités déjà mises à la taille). */
  charges: LigneChargeBudget[];
  revenus: LigneRevenuBudget[];
  /**
   * Durée d'un jour de travail, en heures. Le référentiel ne la donne pas : sans elle, le travail n'est pas évalué
   * (on ne devine pas qu'un jour fait 8 heures). À fournir seulement si une source la donne.
   */
  heuresParJourTravail?: number;
}

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const n = (v: number) => nombre.format(v).replace(/\s/g, " ");
const fcfa = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v).replace(/\s/g, " ")} FCFA`;
const SEMAINES_PAR_AN = 52;

const normaliser = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MOTS_VIDES = new Set(["pour", "dans", "avec", "sans", "des", "les", "une", "unite", "type", "grand", "petit", "neuf"]);
const mots = (t: string) => new Set(normaliser(t).split(/[^a-z0-9]+/).filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)));

/** Nombre de périodes par an d'une ligne : une ligne « par cycle » se répète à chaque cycle de l'année. */
const parAn = (l: { base?: "cycle" | "an"; cyclesParAn?: number }) => ((l.base ?? "cycle") === "cycle" ? (l.cyclesParAn ?? 1) : 1);

const nomDe = (e: EntreeBesoins, code: string) => e.speculations.find((s) => s.code === code)?.nom ?? code;
const surfacesEnHa = (e: EntreeBesoins) => e.ateliers.filter((a) => normaliser(e.speculations.find((s) => s.code === a.speculationCode)?.uniteEchelle ?? "") === "ha");

function ecartTerre(e: EntreeBesoins): EcartBesoin {
  const enHa = surfacesEnHa(e);
  const hors = e.ateliers.filter((a) => !enHa.includes(a));
  const surface = valeur<number>(e.profil, "terreSurfaceHa");
  if (enHa.length === 0) {
    return {
      code: "TERRE_SURFACE", dimension: "terre", feu: "non_evalue", besoin: null, disponible: surface === null ? null : `${n(surface)} ha`,
      phrase: "Le référentiel ne dit pas quelle surface de terre demande cette production, car sa taille ne se compte pas en hectares. La surface n'est donc pas évaluée.",
    };
  }
  const besoinHa = enHa.reduce((somme, a) => somme + a.taille, 0);
  const besoin = `${n(besoinHa)} ha`;
  const reserve = hors.length > 0 ? ` Les productions qui ne se comptent pas en hectares (${hors.map((a) => nomDe(e, a.speculationCode)).join(", ")}) ne sont pas incluses.` : "";
  if (surface === null) {
    const inconnu = e.profil.inconnus.includes("terreSurfaceHa");
    return {
      code: "TERRE_SURFACE", dimension: "terre", feu: "non_evalue", besoin, disponible: null,
      phrase: `Ton projet demande ${besoin}. ${inconnu ? "Tu ne sais pas encore quelle surface tu peux utiliser : à mesurer avant de t'engager." : "Tu n'as pas encore donné ta surface."}${reserve}`,
    };
  }
  const extension = valeur<boolean>(e.profil, "terreExtensionPossible") === true ? (valeur<number>(e.profil, "terreExtensionHa") ?? 0) : 0;
  const disponible = `${n(surface)} ha`;
  const entete = `Ton projet demande ${besoin} et tu disposes de ${disponible}.`;
  const prudence = " Les chemins, la jachère et la rotation ne sont pas comptés dans ce besoin.";
  if (besoinHa <= surface) return { code: "TERRE_SURFACE", dimension: "terre", feu: "vert", besoin, disponible, phrase: `${entete} Ta surface suffit.${prudence}${reserve}` };
  if (besoinHa <= surface + extension) {
    return { code: "TERRE_SURFACE", dimension: "terre", feu: "orange", besoin, disponible, phrase: `${entete} Il faudra utiliser l'extension possible (${n(extension)} ha) ou réduire la taille.${prudence}${reserve}` };
  }
  return { code: "TERRE_SURFACE", dimension: "terre", feu: "rouge", besoin, disponible, phrase: `${entete} Elle est trop petite : réduis la taille du projet ou trouve de la terre en plus.${prudence}${reserve}` };
}

function ecartEau(e: EntreeBesoins): EcartBesoin {
  const source = valeur<string>(e.profil, "eauSource");
  const debit = valeur<number>(e.profil, "eauDebitM3Jour");
  const dispo = debit !== null ? `${n(debit)} m³ par jour` : source !== null ? `source : ${source}` : null;
  return {
    code: "EAU_BESOIN", dimension: "eau", feu: "non_evalue", besoin: null, disponible: dispo,
    phrase:
      "Le référentiel ne donne pas encore le besoin en eau de cette production : l'eau n'est pas confrontée à ton débit." +
      (debit === null ? " Quand tu connaîtras ton débit, on pourra le comparer." : ` Ton débit déclaré est de ${n(debit)} m³ par jour.`),
  };
}

function ecartTravail(e: EntreeBesoins): EcartBesoin {
  const lignes = e.charges.filter((c) => c.typeCharge === "main_oeuvre" && normaliser(c.unite) === "jour");
  if (lignes.length === 0) {
    return { code: "TRAVAIL_JOURS", dimension: "travail", feu: "non_evalue", besoin: null, disponible: null, phrase: "Le référentiel ne donne pas les jours de travail de cette production : le travail n'est pas évalué." };
  }
  const jours = lignes.reduce((s, c) => s + c.quantite * (c.frequence ?? 1) * parAn(c), 0);
  const besoin = `${n(jours)} jours de travail par an`;
  const heures = valeur<number>(e.profil, "tempsHeuresSemaine");
  const famille = valeur<number>(e.profil, "familleHeuresSemaine");
  const familleActifs = valeur<number>(e.profil, "familleActifs");
  const dispoHeures = heures === null ? null : heures + (famille ?? 0);
  const disponible = dispoHeures === null ? null : `${n(dispoHeures)} heures par semaine${famille ? ` (dont ${n(famille)} de ta famille)` : ""}`;
  if (dispoHeures === null || (famille === null && (familleActifs ?? 0) > 0)) {
    return { code: "TRAVAIL_JOURS", dimension: "travail", feu: "non_evalue", besoin, disponible, phrase: `D'après le référentiel, ce projet demande ${besoin}. Dis-nous combien d'heures par semaine toi et ta famille pouvez y consacrer pour comparer.` };
  }
  if (e.heuresParJourTravail === undefined) {
    return {
      code: "TRAVAIL_JOURS", dimension: "travail", feu: "non_evalue", besoin, disponible,
      phrase: `D'après le référentiel, ce projet demande ${besoin}. Tu peux donner ${disponible}. Le référentiel ne dit pas combien d'heures dure un jour de travail : la comparaison est à faire avec un technicien.`,
    };
  }
  const heuresNecessaires = jours * e.heuresParJourTravail;
  const heuresDisponibles = dispoHeures * SEMAINES_PAR_AN;
  const ok = heuresDisponibles >= heuresNecessaires;
  return {
    code: "TRAVAIL_JOURS", dimension: "travail", feu: ok ? "vert" : "orange", besoin, disponible,
    phrase: ok
      ? `Le projet demande ${besoin} et tu as ${disponible} : vous pouvez faire le travail vous-mêmes, hors périodes de pointe.`
      : `Le projet demande ${besoin} et tu as ${disponible} : il faudra payer de la main d'œuvre en plus.`,
  };
}

function ecartArgent(e: EntreeBesoins): EcartBesoin {
  const investissements = e.charges.filter((c) => c.classe === "investissement");
  const apportEspeces = valeur<number>(e.profil, "apportEspecesFcfa");
  const apportNature = valeur<number>(e.profil, "apportNatureFcfa");
  const apport = apportEspeces === null && apportNature === null ? null : (apportEspeces ?? 0) + (apportNature ?? 0);
  const disponible = apport === null ? null : `${fcfa(apport)} d'apport (espèces et nature)`;
  if (investissements.length === 0) {
    return { code: "ARGENT_INVESTISSEMENT", dimension: "argent", feu: "non_evalue", besoin: null, disponible, phrase: "Le référentiel ne prévoit pas d'investissement de départ pour cette production : rien à confronter à ton apport." };
  }
  const total = investissements.reduce((s, c) => s + c.quantite * c.prixUnitaire * (c.frequence ?? 1), 0);
  const besoin = `${fcfa(total)} d'investissements de départ`;
  const reserve = " Cela ne compte pas les dépenses courantes ni l'argent à avancer avant les premières ventes : le plan complet les calcule.";
  if (apport === null) {
    return { code: "ARGENT_INVESTISSEMENT", dimension: "argent", feu: "non_evalue", besoin, disponible, phrase: `D'après le référentiel, il faut ${besoin}. Tu n'as pas encore dit combien tu peux mettre.${reserve}` };
  }
  if (apport >= total) return { code: "ARGENT_INVESTISSEMENT", dimension: "argent", feu: "vert", besoin, disponible, phrase: `Il faut ${besoin} et ton apport est de ${fcfa(apport)} : les investissements sont couverts.${reserve}` };
  return {
    code: "ARGENT_INVESTISSEMENT", dimension: "argent", feu: "orange", besoin, disponible,
    phrase: `Il faut ${besoin} et ton apport est de ${fcfa(apport)} : il manque ${fcfa(total - apport)} à financer, ou à réduire en changeant la taille.${reserve}`,
  };
}

function ecartMateriel(e: EntreeBesoins): EcartBesoin {
  const investissements = e.charges.filter((c) => c.classe === "investissement");
  const p = e.profil;
  const declare = p.existant.length > 0 || p.sansExistant;
  if (investissements.length === 0) {
    return { code: "MATERIEL_EXISTANT", dimension: "materiel", feu: "non_evalue", besoin: null, disponible: null, phrase: "Le référentiel ne liste pas de matériel ni de bâtiment pour cette production : rien à confronter à ton existant." };
  }
  const besoin = investissements.map((c) => c.libelle).join(", ");
  if (!declare) {
    return { code: "MATERIEL_EXISTANT", dimension: "materiel", feu: "non_evalue", besoin, disponible: null, phrase: `Le référentiel prévoit : ${besoin}. Tu n'as pas encore dit ce que tu possèdes déjà.` };
  }
  const trouves: string[] = [];
  const aRemplacer: string[] = [];
  const manquants: string[] = [];
  for (const c of investissements) {
    const mc = mots(c.libelle);
    const item = p.existant.find((x) => [...mots(x.libelle)].some((m) => mc.has(m)));
    if (!item) manquants.push(c.libelle);
    else if (item.etat === "mauvais") aRemplacer.push(`${c.libelle} (ton ${item.libelle} est en mauvais état)`);
    else trouves.push(`${c.libelle} (tu as : ${item.libelle})`);
  }
  const disponible = p.existant.length > 0 ? p.existant.map((x) => x.libelle).join(", ") : "rien pour l'instant";
  const parties = [
    trouves.length > 0 ? `Tu as déjà : ${trouves.join(" ; ")}.` : "",
    aRemplacer.length > 0 ? `À remplacer : ${aRemplacer.join(" ; ")}.` : "",
    manquants.length > 0 ? `À prévoir : ${manquants.join(", ")}.` : "",
  ].filter(Boolean);
  const reserve = " Le rapprochement se fait sur les noms : vérifie-le avec ton existant.";
  const feu: Feu = manquants.length === 0 && aRemplacer.length === 0 ? "vert" : "orange";
  return { code: "MATERIEL_EXISTANT", dimension: "materiel", feu, besoin, disponible, phrase: `${parties.join(" ")}${reserve}` };
}

function ecartRendement(e: EntreeBesoins): EcartBesoin {
  const avec = e.revenus.filter((r) => r.bornesQuantite !== undefined);
  if (avec.length === 0) {
    return { code: "RENDEMENT_BORNES", dimension: "rendement", feu: "non_evalue", besoin: null, disponible: null, phrase: "Le référentiel n'a pas encore de bornes de rendement pour ces productions : les quantités prévues ne sont pas comparées à une norme." };
  }
  const brouillon = avec.some((r) => r.bornesQuantite?.statut !== "validee");
  return {
    code: "RENDEMENT_BORNES", dimension: "rendement", feu: "vert", besoin: null, disponible: null,
    phrase: `Le référentiel a des bornes de rendement pour ${avec.map((r) => r.libelle).join(", ")} : le plan les contrôle.${brouillon ? " Ces bornes sont encore des brouillons à valider." : ""}`,
  };
}

/** Existant contre besoins : un écart nommé par dimension, avec un feu et une phrase. */
export function confronterExistant(entree: EntreeBesoins): EcartBesoin[] {
  return [ecartTerre(entree), ecartEau(entree), ecartTravail(entree), ecartArgent(entree), ecartMateriel(entree), ecartRendement(entree)];
}
