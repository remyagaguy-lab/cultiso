// Verdict en une phrase : la phrase est assemblée à partir de ce que le moteur a déjà décidé (statut, trésorerie, ménage, prix minimum).
// Aucun calcul ici : on ne fait que dire les chiffres du moteur.
import type { ResultatFinance, Scenario } from "@/moteurs";

/** Un scénario du moteur (le type n'est pas exporté par l'index des moteurs). */
export type ResultatScenario = ResultatFinance["scenarios"][Scenario];

const fcfa = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v).replace(/\s/g, " ")} FCFA`;

export type TeinteVerdict = "vert" | "orange" | "rouge";

export interface VerdictSimple {
  teinte: TeinteVerdict;
  /** Une phrase de lecture. */
  phrase: string;
  /** Le prix minimum, si le moteur en donne un. */
  prixMinimum: string | null;
}

export function verdictEnUnePhrase(s: ResultatScenario): VerdictSimple {
  const { verdict, pointBasTresorerie: bas, seuilCommercialisation: seuil } = s;
  const ligne = seuil.parLigne[0] ?? null;
  const prixMinimum = ligne ? `${ligne.libelle} : vends à ${fcfa(ligne.prixSeuil)} au minimum` : null;
  const prix = ligne ? ` Pour ne pas perdre, vends ${ligne.libelle.toLowerCase()} à ${fcfa(ligne.prixSeuil)} au minimum.` : "";

  if (verdict.rentabilite === "deficitaire") {
    return { teinte: "rouge", phrase: `Avec ces hypothèses, ton projet perd de l'argent.${prix}`, prixMinimum };
  }
  const reserves: string[] = [];
  if (!verdict.tresorerieToujoursPositive) reserves.push(`ta caisse devient négative (au plus bas : ${fcfa(bas.montant)}, mois ${bas.mois})`);
  if (verdict.menageCouvert === false) reserves.push("l'argent ne suffit pas à couvrir les dépenses de ta famille et le crédit");
  if (verdict.rentabilite === "limite" && reserves.length === 0) reserves.push("le gain est très faible");
  if (reserves.length > 0) {
    return { teinte: "orange", phrase: `Ton projet tient à peine : ${reserves.join(", et ")}.${prix}`, prixMinimum };
  }
  const famille = verdict.menageCouvert === true ? " et couvre les dépenses de ta famille" : "";
  return { teinte: "vert", phrase: `Ton projet est rentable${famille}, et ta caisse reste positive la première année.${prix}`, prixMinimum };
}
