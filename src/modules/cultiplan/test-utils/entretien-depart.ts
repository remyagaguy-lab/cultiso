// Entretien de cadrage construit depuis les fichiers de départ du référentiel (sans base), pour les tests.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deplier, deplierEntretien, type DonneesDepart, type DonneesEntretien } from "@/referentiel/donnees-depart";
import { construireEntretien, type Entretien } from "@/referentiel/entretien";
import { ProfilPorteurVide } from "./profil-vide";

const lire = <T>(fichier: string): T => JSON.parse(readFileSync(join(process.cwd(), "supabase", "donnees", fichier), "utf8")) as T;

export const donneesEntretien = (): DonneesEntretien => lire<DonneesEntretien>("entretien-cadrage.json");
export const donneesReferentiel = (): DonneesDepart => lire<DonneesDepart>("referentiel-depart.json");

export function entretienDeDepart(): Entretien {
  const lignes = deplierEntretien(donneesEntretien());
  const terrain = deplier(donneesReferentiel()).questions.map((q) => ({
    cle: q.cle,
    libelle: q.libelle,
    sousTitre: q.sous_titre,
    reponses: q.reponses,
    secteurs: q.secteurs,
  }));
  return construireEntretien(lignes, terrain);
}

export { ProfilPorteurVide };
