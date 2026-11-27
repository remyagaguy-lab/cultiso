// Raccord des moteurs autonomes à la grille mensuelle de M1.
// `simulerBandes` (atelier à bandes) et `simulerTroupeau` (cheptel en flux) ont leur propre grille mois 0 à N. Ces adaptateurs purs
// les traduisent en lignes du moteur financier (charges et revenus à série mensuelle exacte, voir `schemaSerieMensuelle`) :
// `calculerFinances` les additionne alors aux autres ateliers et en tire la trésorerie pluriannuelle, la VAN, le ménage (M3) et les contrôles (M4).
// Aucune valeur n'est ajoutée : seulement ce que les moteurs ont calculé. Les montants du mois 0 (investissement) deviennent une ligne d'investissement.
import type { ResultatBandes } from "./bandes";
import type { LigneCharge, LigneRevenu } from "./finance";
import type { ResultatTroupeau } from "./troupeau";

export interface OptionsRaccord {
  /** Atelier du plan que ces lignes alimentent (montée en production, analytique). */
  atelierId?: string;
  /** Décalage : le mois 1 du moteur autonome tombe au mois `decalageMois + 1` de la grille (0 par défaut). */
  decalageMois?: number;
  /** Préfixe des identifiants de ligne (unique dans le plan). */
  prefixe: string;
}

export interface LignesRaccordees {
  charges: LigneCharge[];
  revenus: LigneRevenu[];
  /** Ce qui n'a pas pu être raccordé. */
  avertissements: string[];
}

const total = (v: readonly number[]) => v.reduce((t, x) => t + x, 0);

/** Série mensuelle des mois 1 à N d'un moteur autonome, décalée ; null si la série est nulle. */
function serie(valeurs: readonly number[], decalage: number, origine: string) {
  const montants = valeurs.slice(1);
  if (total(montants) === 0) return null;
  return { debutMois: decalage + 1, montants: [...montants], origine };
}

const ligneCharge = (o: OptionsRaccord, cle: string, libelle: string, typeCharge: string, nature: "fixe" | "variable", valeurs: readonly number[], decalage: number, origine: string): LigneCharge | null => {
  const s = serie(valeurs, decalage, origine);
  if (!s) return null;
  return { id: `${o.prefixe}:${cle}`, libelle, typeCharge, quantite: 1, prixUnitaire: total(s.montants), nature, classe: "exploitation", atelierId: o.atelierId, serieMensuelle: s };
};
const ligneRevenu = (o: OptionsRaccord, cle: string, libelle: string, typeRevenu: string, valeurs: readonly number[], decalage: number, origine: string): LigneRevenu | null => {
  const s = serie(valeurs, decalage, origine);
  if (!s) return null;
  const t = total(s.montants);
  return {
    id: `${o.prefixe}:${cle}`,
    libelle,
    typeRevenu,
    quantite: { pessimiste: 1, realiste: 1, optimiste: 1 },
    prixUnitaire: t,
    atelierId: o.atelierId,
    serieMensuelle: s,
  };
};

/**
 * Atelier à bandes → lignes du plan. Charges : achat des animaux, aliment, charges par sujet, charges fixes ; revenus : ventes du produit et des réformées ;
 * investissement du mois 0 : ligne d'investissement amortie sur `dureeVieAns` (obligatoire pour l'amortir ; sans elle, l'achat est une charge d'exploitation du mois 1
 * et le moteur le dit dans `avertissements`, car on n'invente pas une durée de vie).
 */
export function lignesDepuisBandes(r: ResultatBandes, o: OptionsRaccord & { dureeVieAns?: number; libelleInvestissement?: string }): LignesRaccordees {
  const d = o.decalageMois ?? 0;
  const col = (champ: "achatsAnimaux" | "alimentFcfa" | "chargesParSujet" | "chargesFixes" | "ventesProduit" | "ventesReformees") => r.mois.map((m) => m[champ]);
  const avertissements: string[] = [];
  const charges = [
    ligneCharge(o, "achat-animaux", "Achat des animaux", "intrants", "variable", col("achatsAnimaux"), d, "bandes"),
    ligneCharge(o, "aliment", "Aliment", "intrants", "variable", col("alimentFcfa"), d, "bandes"),
    ligneCharge(o, "charges-sujet", "Charges par sujet (santé, litière, autres)", "sanitaire", "variable", col("chargesParSujet"), d, "bandes"),
    ligneCharge(o, "charges-fixes", "Charges fixes de l'atelier", "infrastructures", "fixe", col("chargesFixes"), d, "bandes"),
  ].filter((l): l is LigneCharge => l !== null);
  const revenus = [
    ligneRevenu(o, "ventes-produit", "Ventes du produit", "principal", col("ventesProduit"), d, "bandes"),
    ligneRevenu(o, "ventes-reformees", "Vente des réformées", "coproduit", col("ventesReformees"), d, "bandes"),
  ].filter((l): l is LigneRevenu => l !== null);
  const investissement = r.mois[0]?.investissement ?? 0;
  if (investissement > 0) {
    if (o.dureeVieAns !== undefined) {
      charges.push({
        id: `${o.prefixe}:investissement`,
        libelle: o.libelleInvestissement ?? "Bâtiment et équipement de l'atelier",
        typeCharge: "infrastructures",
        quantite: 1,
        prixUnitaire: investissement,
        nature: "fixe",
        classe: "investissement",
        dureeVieAns: o.dureeVieAns,
        moisAcquisition: d,
        atelierId: o.atelierId,
      });
    } else {
      avertissements.push("Investissement de l'atelier à bandes compté comme une charge du mois 1 : aucune durée de vie fournie, donc pas d'amortissement ni de renouvellement.");
      charges.push({
        id: `${o.prefixe}:investissement`,
        libelle: o.libelleInvestissement ?? "Bâtiment et équipement de l'atelier (non amorti)",
        typeCharge: "infrastructures",
        quantite: 1,
        prixUnitaire: investissement,
        nature: "fixe",
        classe: "exploitation",
        atelierId: o.atelierId,
        serieMensuelle: { debutMois: d + 1, montants: [investissement], origine: "bandes" },
      });
    }
  }
  return { charges, revenus, avertissements };
}

/** Cheptel en flux → lignes du plan : achats d'animaux (charge) et ventes d'animaux (revenu), aux prix donnés au moteur du cheptel. */
export function lignesDepuisTroupeau(r: ResultatTroupeau, o: OptionsRaccord): LignesRaccordees {
  const d = o.decalageMois ?? 0;
  const parMois = (champ: "achats" | "ventes") => [0, ...r.tresorerie.map((t) => t[champ])];
  const charges = [ligneCharge(o, "achats-animaux", "Achats d'animaux", "intrants", "variable", parMois("achats"), d, "troupeau")].filter((l): l is LigneCharge => l !== null);
  const revenus = [ligneRevenu(o, "ventes-animaux", "Ventes d'animaux", "principal", parMois("ventes"), d, "troupeau")].filter((l): l is LigneRevenu => l !== null);
  const avertissements = r.mouvementsSansPrix > 0 ? [`${r.mouvementsSansPrix} mouvement(s) du cheptel sans prix : leur argent n'est pas dans la grille.`] : [];
  return { charges, revenus, avertissements };
}
