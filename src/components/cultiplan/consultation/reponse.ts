// Logique pure de l'écran de consultation : brouillon d'une réponse, contrôle simple avant l'envoi, construction de la réponse.
// Rien n'est calculé ici : on vérifie seulement que la saisie est complète. Le serveur revalide tout.
import type { PointFaisabilite, QuestionAffichee } from "@/modules/cultiplan";

export type Brouillon = unknown;

export interface LigneExistantBrouillon {
  categorie?: "materiel" | "batiment" | "animaux" | "plants";
  libelle?: string;
  quantite?: number | null;
  etat?: "neuf" | "bon" | "moyen" | "mauvais" | null;
  annee?: number | null;
  valeurEstimeeFcfa?: number | null;
}
export interface CreditBrouillon {
  creancier?: string | null;
  capitalRestantFcfa?: number | null;
  mensualiteFcfa?: number | null;
  moisRestants?: number | null;
}

/** Point de départ du formulaire : la réponse déjà donnée, sinon une saisie vide. */
export function brouillonInitial(q: QuestionAffichee): Brouillon {
  if (q.etat === "repondue" && q.valeur !== null && q.valeur !== undefined) return q.valeur;
  if (q.type === "choix_multiple") return [];
  if (q.type === "liste") return [];
  if (q.type === "texte") return "";
  return null;
}

export type Controle = { ok: true; valeur: unknown } | { ok: false; message: string };

const nombreOk = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const retirerVides = <T extends Record<string, unknown>>(ligne: T): T =>
  Object.fromEntries(Object.entries(ligne).filter(([, v]) => v !== null && v !== undefined && v !== "")) as T;

/** Contrôle la saisie et en tire la valeur à envoyer. Une liste vide est une réponse valable (« aucun »). */
export function reponseDepuisBrouillon(q: QuestionAffichee, b: Brouillon): Controle {
  switch (q.type) {
    case "choix":
      return typeof b === "string" && q.reponses.some((r) => r.valeur === b) ? { ok: true, valeur: b } : { ok: false, message: "Choisis une réponse, ou dis que tu ne sais pas." };
    case "choix_multiple":
      return Array.isArray(b) && b.length > 0 ? { ok: true, valeur: b } : { ok: false, message: "Choisis au moins une réponse, ou dis que tu ne sais pas." };
    case "nombre":
    case "montant":
      return nombreOk(b) ? { ok: true, valeur: b } : { ok: false, message: "Écris un nombre, de zéro ou plus, ou dis que tu ne sais pas." };
    case "oui_non":
      return typeof b === "boolean" ? { ok: true, valeur: b } : { ok: false, message: "Réponds par oui ou par non, ou dis que tu ne sais pas." };
    case "texte": {
      const t = typeof b === "string" ? b.trim() : "";
      if (t.length === 0) return { ok: false, message: "Écris quelques mots, ou dis que tu ne sais pas." };
      return t.length <= 200 ? { ok: true, valeur: t } : { ok: false, message: "C'est un peu long : 200 caractères au plus." };
    }
    case "liste": {
      const lignes = Array.isArray(b) ? (b as Record<string, unknown>[]) : [];
      if (q.cible === "credits") {
        const manque = lignes.findIndex((l) => !nombreOk(l.mensualiteFcfa));
        if (manque >= 0) return { ok: false, message: `Crédit ${manque + 1} : dis combien tu rembourses par mois.` };
      } else {
        const manque = lignes.findIndex((l) => !l.categorie || typeof l.libelle !== "string" || l.libelle.trim().length < 2);
        if (manque >= 0) return { ok: false, message: `Ligne ${manque + 1} : choisis ce que c'est et donne-lui un nom.` };
      }
      return { ok: true, valeur: lignes.map((l) => retirerVides({ ...l, ...(typeof l.libelle === "string" ? { libelle: l.libelle.trim() } : {}) })) };
    }
  }
}

/** Texte lisible d'une réponse donnée, pour la liste « Mes réponses ». */
export function texteDeReponse(q: QuestionAffichee): string {
  if (q.etat === "inconnue") return "Tu ne sais pas encore";
  if (q.etat !== "repondue") return "Pas encore répondu";
  const v = q.valeur;
  const libelle = (valeur: unknown) => q.reponses.find((r) => r.valeur === valeur)?.libelle ?? String(valeur);
  if (q.type === "choix") return libelle(v);
  if (q.type === "choix_multiple") return Array.isArray(v) ? v.map(libelle).join(", ") : String(v);
  if (q.type === "oui_non") return v === true ? "Oui" : "Non";
  if (q.type === "nombre" || q.type === "montant") return `${new Intl.NumberFormat("fr-FR").format(Number(v)).replace(/\s/g, " ")}${q.unite ? ` ${q.unite}` : ""}`;
  if (q.type === "liste") return Array.isArray(v) && v.length > 0 ? `${v.length} élément${v.length > 1 ? "s" : ""}` : "Aucun";
  return String(v);
}

export type FeuAffiche = PointFaisabilite["dimensions"][number]["feu"];

/** Mot et symbole du feu : la couleur ne porte jamais seule l'information. */
export const FEU: Record<FeuAffiche, { mot: string; sens: string; symbole: string }> = {
  vert: { mot: "Vert", sens: "ça va", symbole: "✔" },
  orange: { mot: "Orange", sens: "à surveiller", symbole: "!" },
  rouge: { mot: "Rouge", sens: "ça bloque", symbole: "✖" },
  gris: { mot: "Gris", sens: "on ne sait pas encore", symbole: "?" },
};
