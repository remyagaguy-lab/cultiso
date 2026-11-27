// Conversion du fichier de données de départ (supabase/donnees/referentiel-depart.json) en lignes des tables ref.
// Utilisé par le script d'import (exécuté directement par Node, d'où : aucun import d'exécution hors de node:crypto,
// aucune syntaxe TypeScript non effaçable) et par les tests de cohérence.
// Les identifiants sont déterministes (dérivés de la clé) : l'import peut être rejoué sans créer de doublons.
import { createHash } from "node:crypto";

type Statut = "brouillon_ia";

export interface DonneesDepart {
  version: string;
  speculations: {
    code: string;
    nom: string;
    secteur: string;
    sous_secteur: string;
    unite_echelle: string;
    duree_cycle_jours: number | null;
    cycles_par_an: number;
    zones: string[];
    source: string;
    charges: ChargeDepart[];
    revenus: RevenuDepart[];
  }[];
  questions: {
    cle: string;
    ordre: number;
    libelle: string;
    sous_titre: string;
    secteurs: string[];
    reponses: { valeur: string; libelle: string }[];
  }[];
  regles: RegleDepart[];
  regles_par_speculation: (Omit<RegleDepart, "cle" | "speculation_code"> & { prefixe: string; speculations: string[] })[];
}

interface ChargeDepart {
  cle: string;
  type_charge: string;
  libelle: string;
  unite: string;
  quantite: number;
  prix_reference: number;
  frequence?: number;
  base?: "cycle" | "an";
  nature: "fixe" | "variable";
  classe: "investissement" | "exploitation";
  duree_vie_ans?: number;
  mois_decaissement?: number[];
}

interface RevenuDepart {
  cle: string;
  type_revenu: string;
  libelle: string;
  unite: string;
  quantite_pessimiste: number;
  quantite_realiste: number;
  quantite_optimiste: number;
  pertes: number;
  prix_reference: number;
  mois_vente?: number[];
}

interface RegleDepart {
  cle: string;
  cle_question: string;
  valeur: string;
  speculation_code?: string;
  effet: "multiplier" | "ajouter_ligne";
  cible_sens?: "charge" | "revenu";
  cible_type?: string;
  /** Clé « spéculation.charge » du modèle visé. */
  cible_modele?: string;
  coefficient?: number;
  ligne?: Omit<ChargeDepart, "cle">;
  description: string;
  source: string;
}

/** UUID déterministe (format v5) dérivé d'un nom. */
export function uuidDe(nom: string): string {
  const h = createHash("sha1").update(`cultiso.referentiel:${nom}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

const STATUT: Statut = "brouillon_ia";

/** Déplie les données de départ en lignes prêtes à insérer dans les tables ref. */
export function deplier(d: DonneesDepart) {
  const speculations = d.speculations.map((s) => ({
    code: s.code,
    nom: s.nom,
    secteur: s.secteur,
    sous_secteur: s.sous_secteur,
    unite_echelle: s.unite_echelle,
    duree_cycle_jours: s.duree_cycle_jours,
    cycles_par_an: s.cycles_par_an,
    zones: s.zones,
    statut: STATUT,
    source: s.source,
  }));

  const modelesCharges = d.speculations.flatMap((s) =>
    s.charges.map((c, i) => ({
      id: uuidDe(`charge:${s.code}.${c.cle}`),
      speculation_code: s.code,
      type_charge: c.type_charge,
      libelle: c.libelle,
      unite: c.unite,
      quantite: c.quantite,
      prix_reference: c.prix_reference,
      produit_prix: null,
      frequence: c.frequence ?? 1,
      base: c.base ?? "cycle",
      nature: c.nature,
      classe: c.classe,
      duree_vie_ans: c.duree_vie_ans ?? null,
      mois_decaissement: c.mois_decaissement ?? null,
      ordre: i + 1,
      statut: STATUT,
      source: s.source,
    })),
  );

  const modelesRevenus = d.speculations.flatMap((s) =>
    s.revenus.map((r, i) => ({
      id: uuidDe(`revenu:${s.code}.${r.cle}`),
      speculation_code: s.code,
      type_revenu: r.type_revenu,
      libelle: r.libelle,
      unite: r.unite,
      quantite_pessimiste: r.quantite_pessimiste,
      quantite_realiste: r.quantite_realiste,
      quantite_optimiste: r.quantite_optimiste,
      pertes: r.pertes,
      prix_reference: r.prix_reference,
      produit_prix: null,
      base: "cycle",
      mois_vente: r.mois_vente ?? null,
      ordre: i + 1,
      statut: STATUT,
      source: s.source,
    })),
  );

  const questions = d.questions.map((q) => ({
    cle: q.cle,
    libelle: q.libelle,
    sous_titre: q.sous_titre,
    reponses: q.reponses,
    secteurs: q.secteurs,
    ordre: q.ordre,
    statut: STATUT,
    source: "Cultiso Brouillon, creer_simulation.php (16 clés) ; libellés et réponses rédigés par Cultiso, à valider.",
  }));

  const toutes: RegleDepart[] = [
    ...d.regles,
    ...d.regles_par_speculation.flatMap(({ prefixe, speculations: codes, ...r }) =>
      codes.map((code) => ({ ...r, cle: `${prefixe}_${code}`, speculation_code: code })),
    ),
  ];
  const regles = toutes.map((r) => ({
    id: uuidDe(`regle:${r.cle}`),
    cle_question: r.cle_question,
    valeur: r.valeur,
    speculation_code: r.speculation_code ?? null,
    effet: r.effet,
    cible_sens: r.cible_sens ?? null,
    cible_type: r.cible_type ?? null,
    cible_modele_id: r.cible_modele ? uuidDe(`charge:${r.cible_modele}`) : null,
    coefficient: r.coefficient ?? null,
    // La ligne ajoutée est lue par le moteur de budget : champs en camelCase.
    ligne: r.ligne
      ? {
          typeCharge: r.ligne.type_charge,
          libelle: r.ligne.libelle,
          unite: r.ligne.unite,
          quantite: r.ligne.quantite,
          prixReference: r.ligne.prix_reference,
          frequence: r.ligne.frequence ?? 1,
          base: r.ligne.base ?? "cycle",
          nature: r.ligne.nature,
          classe: r.ligne.classe,
          ...(r.ligne.duree_vie_ans !== undefined ? { dureeVieAns: r.ligne.duree_vie_ans } : {}),
          ...(r.ligne.mois_decaissement !== undefined ? { moisDecaissement: r.ligne.mois_decaissement } : {}),
        }
      : null,
    description: r.description,
    statut: STATUT,
    source: r.source,
  }));

  return { speculations, modelesCharges, modelesRevenus, questions, regles };
}
