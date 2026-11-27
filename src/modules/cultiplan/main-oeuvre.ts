// Main d'oeuvre d'une exploitation (R2) : relie le moteur (src/moteurs/main-oeuvre.ts) au profil du porteur (R9).
// Les besoins en heures par mois viennent de l'appelant (calendrier de travail R1/M1 ou saisie) ; les membres de la famille,
// du profil quand l'appelant n'en donne pas. Aucun calcul ici : le moteur fait tout.
import { z } from "zod";
import type { ClientBase } from "@/core/exploitation";
import { calculerMainOeuvre, schemaMainOeuvre, type EntreeMainOeuvre, type ResultatMainOeuvre } from "@/moteurs";
import { verifier } from "./lignes";
import { lireProfil, valeur, type ProfilPorteur } from "./profil";

/** Semaines par an divisées par douze : passe des heures par semaine du profil aux heures par mois. */
const SEMAINES_PAR_MOIS = 52 / 12;

export const schemaDemandeMainOeuvre = schemaMainOeuvre.extend({ membres: schemaMainOeuvre.shape.membres.optional() });
export type DemandeMainOeuvre = z.input<typeof schemaDemandeMainOeuvre>;

export interface ResultatMainOeuvreExploitation {
  exploitationId: string;
  mainOeuvre: ResultatMainOeuvre;
  /** D'où viennent les membres de la famille (profil ou saisie) ; vide si l'appelant les a donnés. */
  origines: string[];
}

/** Pur : les membres de la famille d'après le profil (nombre d'actifs et heures par semaine), ou une liste vide si le profil ne le dit pas. */
export function membresDepuisProfil(profil: ProfilPorteur): { membres: NonNullable<EntreeMainOeuvre["membres"]>; origine: string | null } {
  const actifs = valeur<number>(profil, "familleActifs");
  const heuresSemaine = valeur<number>(profil, "familleHeuresSemaine");
  if (actifs === null || actifs <= 0 || heuresSemaine === null) return { membres: [], origine: null };
  const heuresMoisParActif = (heuresSemaine / actifs) * SEMAINES_PAR_MOIS;
  return {
    membres: Array.from({ length: actifs }, (_, i) => ({
      id: `famille-${i + 1}`,
      libelle: `Actif familial ${i + 1}`,
      type: "famille" as const,
      heuresParMois: Math.round(heuresMoisParActif * 10) / 10,
      equivalentActif: 1,
    })),
    origine: `Famille : ${actifs} actif(s) et ${heuresSemaine} heures par semaine au total, d'après ton profil (heures partagées à parts égales, un actif compte pour un).`,
  };
}

export async function evaluerMainOeuvre(client: ClientBase, exploitationId: string, corps: unknown): Promise<ResultatMainOeuvreExploitation> {
  const demande = verifier(schemaDemandeMainOeuvre, corps);
  const origines: string[] = [];
  let membres = demande.membres;
  if (!membres) {
    const profil = await lireProfil(client, exploitationId, { tolerant: true });
    const depuis = membresDepuisProfil(profil);
    if (depuis.membres.length === 0) {
      verifier(schemaMainOeuvre, { ...demande, membres: [] }); // lève l'erreur « au moins un membre » avec le message du moteur
    }
    membres = depuis.membres;
    if (depuis.origine) origines.push(depuis.origine);
  }
  return { exploitationId, mainOeuvre: calculerMainOeuvre({ ...demande, membres }), origines };
}
