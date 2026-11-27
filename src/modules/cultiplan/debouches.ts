// Débouchés (R3) : table des circuits de vente (bord champ, marché local, grossiste, transformateur, export, contrat), prix par circuit et
// par saison, répartition des volumes, volume non vendu, débouché contractuel (prix et volume fixés d'avance, services déduits du paiement,
// risque de vente parallèle) et saisonnalité des prix.
//
// Service PUR : aucune base, aucun réseau. La liste des circuits vient de `ref.circuits_commercialisation` (passée par l'appelant) ; les prix et
// les parts de volume viennent du porteur, de l'étude de marché ou d'un contrat, avec leur source. Rien n'est deviné : une part non répartie est
// du « volume non vendu », pas une vente ; un mois de vente sans prix est refusé.
//
// Branchement sur le reste : `lignesRevenu` produit une ligne de revenu par circuit et par saison de prix, avec `client` et `debouche`,
// que `calculerFinances` contrôle (VOLUME_HORS_DEBOUCHE, CONCENTRATION_CLIENT) ; `debouchePourDimensionnement` donne à M13 le volume vendable.
import { z } from "zod";
import { ErreurMoteur, type LigneRevenu } from "@/moteurs";
import { valider } from "@/moteurs/commun";
import type { ParametresDimensionnement } from "./dimensionnement";

const mois = z.number().int().min(1).max(12);
const source = z.string().trim().min(2, "la source est obligatoire");
const volumes = z.object({ pessimiste: z.number().min(0), realiste: z.number().min(0), optimiste: z.number().min(0) });

export const schemaCircuit = z
  .object({
    /** Code du circuit dans `ref.circuits_commercialisation`. */
    circuit: z.string().trim().min(1),
    /** Part du volume vendable confiée à ce circuit (0 à 1). */
    part: z.number().min(0).max(1),
    /** Acheteur nommé (pour la concentration) : un grossiste, une coopérative, un transformateur... Sans nom, la part n'est pas attribuée. */
    client: z.string().trim().min(1).optional(),
    /** Prix du circuit (FCFA par unité), unique toute l'année ou par saison. Obligatoire sauf pour un contrat (prix fixé d'avance). */
    prix: z.union([z.number().min(0), z.array(z.object({ mois: z.array(mois).min(1), prix: z.number().min(0) })).min(1)]).optional(),
    sourcePrix: source.optional(),
    /** Volume annuel que ce circuit peut absorber (même unité que le volume vendable). Absent : capacité inconnue, rien n'est contrôlé. */
    volumeAbsorbable: z.number().min(0).optional(),
    contrat: z
      .object({
        /** Volume fixé d'avance, par an. */
        volumeFixe: z.number().positive(),
        /** Prix fixé d'avance (FCFA par unité), avant les services déduits. */
        prixFixe: z.number().min(0),
        /** Services intégrés au contrat (intrants, transport, encadrement), déduits du paiement : FCFA par unité vendue. */
        servicesDeduits: z.array(z.object({ libelle: z.string().min(1), montantParUnite: z.number().min(0) })).default([]),
        acheteur: z.string().trim().min(1),
        source,
      })
      .optional(),
  })
  .refine((c) => c.prix !== undefined || c.contrat !== undefined, { message: "donne un prix (ou un contrat) pour ce circuit", path: ["prix"] });

export const schemaDebouches = z.object({
  produit: z.string().trim().min(1),
  unite: z.string().trim().min(1),
  /** Volume vendable de l'année (après pertes), par scénario, dans `unite`. */
  volumeAn: volumes,
  /** Mois de vente (1 à 12) ; le volume se répartit à parts égales sur ces mois, comme dans le moteur financier. 12 mois sinon. */
  moisVente: z.array(mois).min(1).optional(),
  circuits: z.array(schemaCircuit).min(1, "au moins un circuit"),
  /** Type de revenu des lignes produites (`principal` par défaut). */
  typeRevenu: z.string().min(1).default("principal"),
  /** Identifiant des lignes produites. */
  idProduit: z.string().trim().min(1).optional(),
});
export type EntreeDebouches = z.input<typeof schemaDebouches>;

export interface CircuitRef {
  code: string;
  libelle: string;
  /** Circuit à contrat (prix et volume fixés d'avance). */
  contractuel: boolean;
}

export type CodeControleDebouches =
  | "VOLUME_NON_VENDU"
  | "PARTS_SUPERIEURES_A_UN"
  | "AU_DESSUS_DU_DEBOUCHE"
  | "CONTRAT_NON_COUVERT"
  | "RISQUE_VENTE_PARALLELE"
  | "SERVICES_DEDUITS_A_RETIRER_DES_CHARGES"
  | "CIRCUIT_SANS_NOM_DE_CLIENT";

export interface ControleDebouches {
  code: CodeControleDebouches;
  niveau: "info" | "alerte" | "bloquant";
  valeurs: Record<string, number | string | null>;
  message: string;
}

export interface CircuitResultat {
  circuit: string;
  libelle: string;
  client: string | null;
  contractuel: boolean;
  part: number;
  /** Volume du scénario réaliste confié à ce circuit. */
  volume: number;
  /** Prix moyen pondéré par les mois de vente, net des services déduits pour un contrat. */
  prixMoyen: number;
  recettes: number;
  partRecettes: number;
  /** Prix par mois (1 à 12) ; null hors des mois de vente. Montre la saisonnalité du circuit. */
  prixParMois: (number | null)[];
  prixMin: number;
  prixMax: number;
  volumeAbsorbable: number | null;
  sourcePrix: string | null;
}

export interface ContratResultat {
  circuit: string;
  acheteur: string;
  volumeFixe: number;
  prixFixe: number;
  servicesDeduitsParUnite: number;
  /** Ce que le producteur reçoit réellement par unité : prix fixé moins les services déduits. */
  paiementNetParUnite: number;
  paiementNetAn: number;
  deductionsAn: number;
  /** Volume confié au contrat (réaliste) moins le volume fixé : négatif = contrat non couvert. */
  margeVolume: number;
  /** Plus grand écart, parmi les autres circuits, entre leur prix et le paiement net du contrat, sur les mêmes mois (en part du paiement net) ; null si aucun autre prix. */
  ecartPrixMarche: number | null;
}

export interface ResultatDebouches {
  produit: string;
  unite: string;
  volumeVendableAn: number;
  /** Part du volume confiée à un circuit. */
  partRepartie: number;
  volumeVendu: number;
  volumeNonVendu: number;
  partNonVendue: number;
  recettesAn: number;
  prixMoyen: number | null;
  circuits: CircuitResultat[];
  contrats: ContratResultat[];
  /** Part des recettes du premier client nommé ; `partNonAttribuee` = recettes sans nom de client. */
  concentration: { premierClient: string | null; partPremierClient: number | null; partNonAttribuee: number };
  /** Lignes de revenu pour `calculerFinances` : une par circuit et par saison de prix, avec `client` et `debouche`. */
  lignesRevenu: LigneRevenu[];
  controles: ControleDebouches[];
  lecture: string[];
}

const arrondi = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const fcfa = (x: number) => Math.round(x);

/** Blocs de prix d'un circuit sur les mois de vente : { mois, prix }. Refuse un mois de vente sans prix. */
function blocsDePrix(c: z.output<typeof schemaCircuit>, moisVente: number[]): { mois: number[]; prix: number }[] {
  if (c.contrat && c.prix === undefined) {
    const net = c.contrat.prixFixe - c.contrat.servicesDeduits.reduce((s, x) => s + x.montantParUnite, 0);
    return [{ mois: moisVente, prix: Math.max(net, 0) }];
  }
  if (typeof c.prix === "number") return [{ mois: moisVente, prix: c.prix }];
  const blocs: { mois: number[]; prix: number }[] = [];
  const couverts = new Set<number>();
  for (const b of c.prix ?? []) {
    const dedans = b.mois.filter((m) => moisVente.includes(m) && !couverts.has(m));
    dedans.forEach((m) => couverts.add(m));
    if (dedans.length > 0) blocs.push({ mois: dedans, prix: b.prix });
  }
  const manquants = moisVente.filter((m) => !couverts.has(m));
  if (manquants.length > 0) {
    throw new ErreurMoteur(`Le circuit « ${c.circuit} » n'a pas de prix pour les mois de vente ${manquants.join(", ")}.`, [`circuits.${c.circuit}.prix : mois sans prix ${manquants.join(", ")}`]);
  }
  return blocs;
}

export function analyserDebouches(entree: EntreeDebouches, circuitsRef: readonly CircuitRef[]): ResultatDebouches {
  const e = valider(schemaDebouches, entree, "débouchés");
  const moisVente = [...new Set(e.moisVente ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])].sort((a, b) => a - b);
  const controles: ControleDebouches[] = [];
  const lecture: string[] = [];
  const idProduit = e.idProduit ?? e.produit.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const inconnus = e.circuits.filter((c) => !circuitsRef.some((r) => r.code === c.circuit)).map((c) => c.circuit);
  if (inconnus.length > 0) {
    throw new ErreurMoteur(`Circuit inconnu du référentiel : ${inconnus.join(", ")}. Disponibles : ${circuitsRef.map((r) => r.code).join(", ") || "aucun"}.`, inconnus.map((c) => `circuits : ${c} inconnu`));
  }
  const doublons = e.circuits.map((c) => c.circuit).filter((c, i, l) => l.indexOf(c) !== i);
  if (doublons.length > 0) throw new ErreurMoteur(`Un circuit est donné deux fois : ${[...new Set(doublons)].join(", ")}. Regroupe-les ou nomme deux acheteurs dans deux circuits différents.`);
  const contratSurNonContractuel = e.circuits.filter((c) => c.contrat && !circuitsRef.find((r) => r.code === c.circuit)?.contractuel).map((c) => c.circuit);
  if (contratSurNonContractuel.length > 0) {
    throw new ErreurMoteur(`Un contrat est posé sur un circuit qui n'est pas contractuel : ${contratSurNonContractuel.join(", ")}.`);
  }

  const partRepartie = e.circuits.reduce((s, c) => s + c.part, 0);
  if (partRepartie > 1 + 1e-9) {
    controles.push({
      code: "PARTS_SUPERIEURES_A_UN",
      niveau: "bloquant",
      valeurs: { partRepartie: arrondi(partRepartie, 4) },
      message: `Tu as réparti ${arrondi(partRepartie * 100, 1)} % du volume entre les circuits : on ne peut pas vendre plus que ce qu'on produit. Ramène le total à 100 % au plus.`,
    });
  }

  const volume = e.volumeAn.realiste;
  const circuits: CircuitResultat[] = [];
  const lignes: LigneRevenu[] = [];
  const contrats: ContratResultat[] = [];

  for (const c of e.circuits) {
    const ref = circuitsRef.find((r) => r.code === c.circuit)!;
    const blocs = blocsDePrix(c, moisVente);
    const prixParMois: (number | null)[] = Array.from({ length: 12 }, () => null);
    for (const b of blocs) b.mois.forEach((m) => (prixParMois[m - 1] = b.prix));
    const volCircuit = volume * c.part;
    const moyen = blocs.reduce((s, b) => s + b.prix * b.mois.length, 0) / moisVente.length;
    const prixVus = blocs.map((b) => b.prix);
    circuits.push({
      circuit: c.circuit,
      libelle: ref.libelle,
      client: c.client ?? c.contrat?.acheteur ?? null,
      contractuel: c.contrat !== undefined,
      part: arrondi(c.part, 4),
      volume: arrondi(volCircuit),
      prixMoyen: arrondi(moyen),
      recettes: fcfa(volCircuit * moyen),
      partRecettes: 0,
      prixParMois,
      prixMin: Math.min(...prixVus),
      prixMax: Math.max(...prixVus),
      volumeAbsorbable: c.contrat ? c.contrat.volumeFixe : (c.volumeAbsorbable ?? null),
      sourcePrix: c.sourcePrix ?? c.contrat?.source ?? null,
    });
    blocs.forEach((b, k) => {
      const part = b.mois.length / moisVente.length;
      const absorbable = c.contrat ? c.contrat.volumeFixe : c.volumeAbsorbable;
      const client = c.client ?? c.contrat?.acheteur;
      lignes.push({
        id: blocs.length === 1 ? `${idProduit}-${c.circuit}` : `${idProduit}-${c.circuit}-${k + 1}`,
        libelle: `${e.produit}, ${ref.libelle.toLowerCase()}${blocs.length > 1 ? ` (mois ${b.mois.join(", ")})` : ""}`,
        typeRevenu: e.typeRevenu,
        quantite: {
          pessimiste: e.volumeAn.pessimiste * c.part * part,
          realiste: e.volumeAn.realiste * c.part * part,
          optimiste: e.volumeAn.optimiste * c.part * part,
        },
        prixUnitaire: b.prix,
        pertes: 0,
        base: "an",
        moisVente: b.mois,
        ...(client ? { client } : {}),
        // Le plafond du circuit se répartit comme son volume entre les saisons de prix.
        ...(absorbable !== undefined ? { debouche: { volumeAbsorbable: absorbable * part, source: c.sourcePrix ?? c.contrat?.source ?? `circuit ${ref.libelle}` } } : {}),
      });
    });

    if (c.contrat) {
      const services = c.contrat.servicesDeduits.reduce((s, x) => s + x.montantParUnite, 0);
      const net = Math.max(c.contrat.prixFixe - services, 0);
      const autres = e.circuits.filter((o) => o !== c && !o.contrat);
      const ecarts: number[] = [];
      for (const o of autres) {
        for (const b of blocsDePrix(o, moisVente)) {
          if (net > 0) ecarts.push((b.prix - net) / net);
        }
      }
      const ecartMax = ecarts.length > 0 ? Math.max(...ecarts) : null;
      const dispo = volCircuit;
      contrats.push({
        circuit: c.circuit,
        acheteur: c.contrat.acheteur,
        volumeFixe: c.contrat.volumeFixe,
        prixFixe: c.contrat.prixFixe,
        servicesDeduitsParUnite: arrondi(services),
        paiementNetParUnite: arrondi(net),
        paiementNetAn: fcfa(c.contrat.volumeFixe * net),
        deductionsAn: fcfa(c.contrat.volumeFixe * services),
        margeVolume: arrondi(dispo - c.contrat.volumeFixe),
        ecartPrixMarche: ecartMax === null ? null : arrondi(ecartMax, 4),
      });
      if (dispo < c.contrat.volumeFixe) {
        controles.push({
          code: "CONTRAT_NON_COUVERT",
          niveau: "alerte",
          valeurs: { circuit: c.circuit, volumeFixe: c.contrat.volumeFixe, volumeConfie: arrondi(dispo), manque: arrondi(c.contrat.volumeFixe - dispo) },
          message: `Ton contrat avec ${c.contrat.acheteur} prévoit ${c.contrat.volumeFixe} ${e.unite} par an, mais tu n'en confies que ${arrondi(dispo)} ${e.unite} à ce circuit : il manque ${arrondi(c.contrat.volumeFixe - dispo)} ${e.unite}. Un contrat non tenu peut coûter la confiance de l'acheteur.`,
        });
      } else if (e.volumeAn.pessimiste * c.part < c.contrat.volumeFixe) {
        controles.push({
          code: "CONTRAT_NON_COUVERT",
          niveau: "info",
          valeurs: { circuit: c.circuit, volumeFixe: c.contrat.volumeFixe, volumeConfiePessimiste: arrondi(e.volumeAn.pessimiste * c.part) },
          message: `Dans un mauvais scénario, tu ne livrerais que ${arrondi(e.volumeAn.pessimiste * c.part)} ${e.unite} à ${c.contrat.acheteur} au lieu des ${c.contrat.volumeFixe} ${e.unite} du contrat.`,
        });
      }
      if (ecartMax !== null && ecartMax > 0) {
        controles.push({
          code: "RISQUE_VENTE_PARALLELE",
          niveau: "alerte",
          valeurs: { circuit: c.circuit, ecartPrixMarche: arrondi(ecartMax, 4), paiementNet: arrondi(net) },
          message: `Un autre circuit paie jusqu'à ${arrondi(ecartMax * 100, 1)} % de plus que ce que tu reçois net de ton contrat avec ${c.contrat.acheteur} : la tentation de vendre ailleurs une partie de la récolte est réelle, et c'est le risque numéro un d'un contrat.`,
        });
      }
      if (services > 0) {
        controles.push({
          code: "SERVICES_DEDUITS_A_RETIRER_DES_CHARGES",
          niveau: "info",
          valeurs: { circuit: c.circuit, servicesParUnite: arrondi(services), deductionsAn: fcfa(c.contrat.volumeFixe * services) },
          message: `${c.contrat.acheteur} déduit ${arrondi(services)} FCFA par ${e.unite} de ton paiement pour les services du contrat (${c.contrat.servicesDeduits.map((s) => s.libelle).join(", ")}). Ton prix de vente est déjà net : retire ces postes de tes charges pour ne pas les compter deux fois.`,
        });
      }
    }
    if (!c.client && !c.contrat) {
      controles.push({
        code: "CIRCUIT_SANS_NOM_DE_CLIENT",
        niveau: "info",
        valeurs: { circuit: c.circuit },
        message: `Le circuit « ${ref.libelle} » n'a pas de nom d'acheteur : il ne compte pas dans le contrôle de dépendance à un seul client.`,
      });
    }
  }

  const recettesAn = circuits.reduce((s, c) => s + c.recettes, 0);
  circuits.forEach((c) => (c.partRecettes = recettesAn > 0 ? arrondi(c.recettes / recettesAn, 4) : 0));
  const volumeVendu = Math.min(volume, volume * Math.min(partRepartie, 1));
  const volumeNonVendu = Math.max(volume - volumeVendu, 0);
  if (volumeNonVendu > 1e-9 && volume > 0) {
    controles.push({
      code: "VOLUME_NON_VENDU",
      niveau: "alerte",
      valeurs: { volumeNonVendu: arrondi(volumeNonVendu), partNonVendue: arrondi(volumeNonVendu / volume, 4) },
      message: `${arrondi((volumeNonVendu / volume) * 100, 1)} % de ta production (${arrondi(volumeNonVendu)} ${e.unite}) n'a aucun débouché : elle ne rapporte rien dans ce plan. Trouve un circuit pour ce volume, ou produis moins.`,
    });
  }
  for (const c of circuits) {
    if (c.volumeAbsorbable !== null && c.volume > c.volumeAbsorbable + 1e-9) {
      controles.push({
        code: "AU_DESSUS_DU_DEBOUCHE",
        niveau: "alerte",
        valeurs: { circuit: c.circuit, volume: c.volume, volumeAbsorbable: c.volumeAbsorbable },
        message: `Le circuit « ${c.libelle} » ne peut absorber que ${c.volumeAbsorbable} ${e.unite} par an et tu lui en confies ${c.volume}. Le moteur financier le signale aussi (VOLUME_HORS_DEBOUCHE).`,
      });
    }
  }

  const nommes = circuits.filter((c) => c.client !== null);
  const parClient = new Map<string, number>();
  nommes.forEach((c) => parClient.set(c.client as string, (parClient.get(c.client as string) ?? 0) + c.recettes));
  const premier = [...parClient.entries()].sort((a, b) => b[1] - a[1])[0];
  const recettesNommees = [...parClient.values()].reduce((s, x) => s + x, 0);

  lecture.push(
    `Tu vends ${arrondi(volumeVendu)} ${e.unite} sur ${e.volumeAn.realiste ? arrondi(volume) : 0} ${e.unite} produits, par ${circuits.length} circuit(s), pour ${fcfa(recettesAn)} FCFA par an.`,
  );
  if (volumeNonVendu > 1e-9) lecture.push(`${arrondi(volumeNonVendu)} ${e.unite} n'ont pas de débouché : ils ne sont pas comptés dans les recettes.`);
  if (premier && recettesAn > 0) lecture.push(`Ton premier client, ${premier[0]}, pèse ${arrondi((premier[1] / recettesAn) * 100, 1)} % des recettes.`);
  for (const k of circuits) {
    if (k.prixMax > k.prixMin) lecture.push(`Au circuit « ${k.libelle} », le prix varie de ${fcfa(k.prixMin)} à ${fcfa(k.prixMax)} FCFA selon la saison.`);
  }

  return {
    produit: e.produit,
    unite: e.unite,
    volumeVendableAn: arrondi(volume),
    partRepartie: arrondi(partRepartie, 4),
    volumeVendu: arrondi(volumeVendu),
    volumeNonVendu: arrondi(volumeNonVendu),
    partNonVendue: volume > 0 ? arrondi(volumeNonVendu / volume, 4) : 0,
    recettesAn: fcfa(recettesAn),
    prixMoyen: volumeVendu > 0 ? arrondi(recettesAn / volumeVendu) : null,
    circuits,
    contrats,
    concentration: {
      premierClient: premier ? premier[0] : null,
      partPremierClient: premier && recettesAn > 0 ? arrondi(premier[1] / recettesAn, 4) : null,
      partNonAttribuee: recettesAn > 0 ? arrondi((recettesAn - recettesNommees) / recettesAn, 4) : 0,
    },
    lignesRevenu: lignes,
    controles,
    lecture,
  };
}

/**
 * Pour M13 (dimensionnement à rebours) : le volume vendable par mois que les débouchés absorbent. Le volume vendu (non le volume produit)
 * est réparti sur les mois de vente. L'origine est « contrat » si tout le volume vendu est sous contrat, sinon « marche » (à moins que
 * l'appelant en choisisse une autre : promesse d'achat, enquête). La source est celle que l'appelant donne : sans elle, M13 refuse.
 */
export function debouchePourDimensionnement(
  resultat: ResultatDebouches,
  options: { moisVente?: number[]; origine?: "marche" | "contrat" | "promesse_achat" | "enquete"; source: string },
): NonNullable<ParametresDimensionnement["debouche"]> {
  const moisParAn = new Set(options.moisVente ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).size;
  const sousContrat = resultat.circuits.filter((c) => c.contractuel).reduce((s, c) => s + c.volume, 0);
  const origine = options.origine ?? (resultat.volumeVendu > 0 && Math.abs(sousContrat - resultat.volumeVendu) < 1e-6 ? "contrat" : "marche");
  return {
    volumeParMois: resultat.volumeVendu / moisParAn,
    moisParAn,
    unite: resultat.unite,
    origine,
    source: options.source,
  };
}
