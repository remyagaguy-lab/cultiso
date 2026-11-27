// Mise en forme des nombres du dossier. Espace insécable simple (U+00A0, présent dans l'alphabet de la police PDF de base) comme séparateur de milliers.
const NBSP = " ";

export function nombre(x: number | null | undefined, decimales = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "n.d.";
  const arrondi = decimales === 0 ? Math.round(x) : Math.round(x * 10 ** decimales) / 10 ** decimales;
  const [entier, dec] = Math.abs(arrondi).toFixed(decimales).split(".");
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${arrondi < 0 ? "-" : ""}${groupes}${dec ? `,${dec}` : ""}`;
}

export const fcfa = (x: number | null | undefined): string => (x === null || x === undefined ? "n.d." : `${nombre(x)}${NBSP}FCFA`);
/** Pourcentage depuis un taux décimal (0,2 → 20 %). */
export const pct = (x: number | null | undefined, decimales = 1): string => (x === null || x === undefined ? "n.d." : `${nombre(x * 100, decimales)}${NBSP}%`);

const MOIS_CALENDRIER = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** Les mois du plan sont relatifs au démarrage (mois 1 = le premier mois du projet), pas des mois du calendrier : on ne les nomme donc pas janvier, février... */
export const nomMois = (m: number): string => `mois ${m}`;
export const dateFr = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getUTCDate()} ${MOIS_CALENDRIER[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

export const STATUTS_LISIBLES: Record<string, string> = { brouillon_ia: "brouillon (à valider par un expert)", a_valider: "à valider", validee: "validée" };

/** « le démarrage » ou « le mois N » : un mois de la grille, sans le confondre avec un mois du calendrier quand l'horizon dépasse un an. */
export const moisN = (m: number): string => (m === 0 ? "le démarrage" : `le mois ${m}`);
