// Calendrier et profil pluriannuel d'un plan (R1, R4, M2) : à la génération, les lignes d'un atelier reçoivent le profil mensuel de leur cycle
// (ref.itineraire_mensuel) et la déclaration obligatoire de la période improductive (ref.profils_speculation) ; la montée en production
// (ref.profil_pluriannuel) devient `hypotheses.montee`. Rien n'est deviné : une donnée absente laisse la ligne telle quelle (ancien
// calendrier `mois`), une année manquante dans un profil le fait écarter, plusieurs variantes sans choix ne sont pas arbitrées.
// Le service PUR `appliquerCalendrier` ne lit rien ; `lireCalendrierReferentiel` lit la base et tolère l'absence des tables (migration non appliquée).
import type { ClientBase } from "@/core/exploitation";
import type { Montee } from "@/moteurs/calendrier";
import type { LigneChargeBudget, LigneRevenuBudget } from "@/moteurs/budget";
import { lireItinerairesMensuels, lireProfilsPluriannuels, type ItineraireMensuel, type ProfilPluriannuel } from "@/referentiel/calendrier";

export interface AtelierCalendrier {
  atelierId: string;
  speculationCode: string;
  /** Mois de la grille où démarre le premier cycle (1 par défaut). */
  debutMois?: number;
}

export interface CalendrierReferentiel {
  itineraires: Record<string, ItineraireMensuel[]>;
  profils: Record<string, ProfilPluriannuel[]>;
  /** Lectures impossibles (tables absentes, droits) : dites à l'utilisateur, jamais silencieuses. */
  indisponibles: string[];
}

export interface ChoixVariante {
  speculationCode: string;
  type: "itineraire" | "profil";
  variantes: string[];
}

export interface ResultatCalendrier {
  /** Montée en production à ranger dans `hypotheses.montee`. */
  montee: Montee[];
  /** Phrases simples sur ce qui a été appliqué ou pas, au tutoiement. */
  notes: string[];
  /** Spéculations qui ont plusieurs variantes : le plan n'en choisit pas, l'appelant doit le faire. */
  aChoisir: ChoixVariante[];
}

const origine = (v: { variante: string; statut: string }) => `ref, variante ${v.variante} (${v.statut})`;

function choisir<T extends { variante: string }>(liste: T[] | undefined, voulue: string | undefined): { retenu: T | null; plusieurs: boolean } {
  if (!liste || liste.length === 0) return { retenu: null, plusieurs: false };
  if (voulue) return { retenu: liste.find((v) => v.variante === voulue) ?? null, plusieurs: false };
  if (liste.length === 1) return { retenu: liste[0], plusieurs: false };
  return { retenu: null, plusieurs: true };
}

/** Années 1 à k sans trou : le tableau par année du moteur ; null s'il manque une année ou s'il n'y en a aucune. */
function tableauParAnnee(parAnnee: Record<number, number>): number[] | null {
  const annees = Object.keys(parAnnee).map(Number).sort((a, b) => a - b);
  if (annees.length === 0) return null;
  return annees.every((a, i) => a === i + 1) ? annees.map((a) => parAnnee[a]) : null;
}

/**
 * Applique le référentiel calendaire aux lignes d'un budget généré (les lignes sont modifiées sur place) et renvoie la montée en production.
 * `variantes` : choix explicite d'une variante par spéculation quand le référentiel en a plusieurs.
 */
export function appliquerCalendrier(
  charges: LigneChargeBudget[],
  revenus: LigneRevenuBudget[],
  ateliers: AtelierCalendrier[],
  ref: CalendrierReferentiel,
  variantes: Record<string, string> = {},
): ResultatCalendrier {
  const resultat: ResultatCalendrier = { montee: [], notes: [], aChoisir: [] };
  for (const mot of ref.indisponibles) resultat.notes.push(mot);
  for (const a of ateliers) {
    const debutMois = a.debutMois ?? 1;
    const delesLignes = <T extends { atelierId: string }>(l: T[]) => l.filter((x) => x.atelierId === a.atelierId);

    // R1 : profil mensuel du cycle.
    const it = choisir(ref.itineraires[a.speculationCode], variantes[a.speculationCode]);
    if (it.plusieurs) resultat.aChoisir.push({ speculationCode: a.speculationCode, type: "itineraire", variantes: ref.itineraires[a.speculationCode].map((v) => v.variante) });
    if (it.retenu) {
      const i = it.retenu;
      for (const note of i.avertissements) resultat.notes.push(note);
      let appliques = 0;
      for (const c of delesLignes(charges)) {
        if (c.classe !== "exploitation" || c.base !== "cycle" || c.serieMensuelle) continue;
        const parts = (i.partCouts.find((p) => p.typeCharge === c.typeCharge) ?? i.partCouts.find((p) => p.typeCharge === null))?.parts;
        if (!parts) continue;
        c.calendrier = { debutMois, parts, origine: origine(i) };
        appliques++;
      }
      if (i.partRecolte) {
        for (const r of delesLignes(revenus)) {
          if (r.base !== "cycle" || r.serieMensuelle) continue;
          r.calendrier = { debutMois, parts: i.partRecolte, origine: origine(i) };
          appliques++;
        }
      }
      if (appliques > 0) resultat.notes.push(`Atelier ${a.atelierId} : le calendrier des dépenses et des ventes suit l'itinéraire du référentiel (${origine(i)}).`);
    }

    // R4 : déclaration obligatoire de la période improductive, montée en production.
    const pr = choisir(ref.profils[a.speculationCode], variantes[a.speculationCode]);
    if (pr.plusieurs) resultat.aChoisir.push({ speculationCode: a.speculationCode, type: "profil", variantes: ref.profils[a.speculationCode].map((v) => v.variante) });
    if (pr.retenu) {
      const p = pr.retenu;
      if (p.declarationObligatoire) {
        // Entrée en production déduite de la source quand elle donne des mois improductifs ; sinon la déclaration reste à faire (alerte du contrôle).
        const annee = p.moisImproductifs === undefined ? undefined : Math.floor(p.moisImproductifs / 12) + 1;
        for (const r of delesLignes(revenus)) if (!r.perenne) r.perenne = annee === undefined ? {} : { anneeEntreeProduction: annee };
        resultat.notes.push(
          annee === undefined
            ? `Atelier ${a.atelierId} : cette production a une période sans vente (${p.type === "cheptel" ? "constitution du cheptel" : "plantation"}) ; dis à partir de quelle année elle produit.`
            : `Atelier ${a.atelierId} : la source donne ${p.moisImproductifs} mois sans production, donc la production est comptée à partir de l'an ${annee} (${origine(p)}).`,
        );
      }
      const rendement = tableauParAnnee(p.coefficientRendement);
      const utilisation = tableauParAnnee(p.tauxUtilisation);
      if (Object.keys(p.coefficientRendement).length > 0 && !rendement) resultat.notes.push(`Atelier ${a.atelierId} : le profil de rendement du référentiel a des années manquantes ; il n'est pas appliqué.`);
      if (Object.keys(p.tauxUtilisation).length > 0 && !utilisation) resultat.notes.push(`Atelier ${a.atelierId} : le profil d'utilisation du référentiel a des années manquantes ; il n'est pas appliqué.`);
      if (rendement || utilisation) {
        resultat.montee.push({ atelierId: a.atelierId, ...(rendement ? { coefficientsRendement: rendement } : {}), ...(utilisation ? { tauxUtilisation: utilisation } : {}), origine: origine(p) });
      }
    } else if (!pr.plusieurs && !ref.profils[a.speculationCode]?.length) {
      resultat.notes.push(`Atelier ${a.atelierId} : le référentiel ne dit pas si cette production met du temps à produire ; le plan la compte dès la première année.`);
    }
  }
  return resultat;
}

/** Lit le référentiel calendaire des spéculations données ; une table absente (migration non appliquée) est notée, pas fatale. */
export async function lireCalendrierReferentiel(client: ClientBase, speculationCodes: string[]): Promise<CalendrierReferentiel> {
  const ref: CalendrierReferentiel = { itineraires: {}, profils: {}, indisponibles: [] };
  for (const code of [...new Set(speculationCodes)]) {
    try {
      ref.itineraires[code] = await lireItinerairesMensuels(client, code);
      ref.profils[code] = await lireProfilsPluriannuels(client, code);
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      ref.indisponibles.push(`Le référentiel calendaire n'est pas lisible pour ${code} (${message}) : le plan garde l'ancien calendrier.`);
    }
  }
  return ref;
}
