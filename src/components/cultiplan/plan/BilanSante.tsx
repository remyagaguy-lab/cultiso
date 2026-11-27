"use client";

import type { Controle } from "@/moteurs";
import { expliquerControles } from "@/moteurs";
import { CarteControle } from "../ControlesExpliques";
import { Feu, Section, type Teinte } from "../commun";
import { usePlan } from "./PlanContext";

type Groupe = "coherence" | "menage" | "tresorerie" | "financement" | "marche" | "technique";

const TITRE_GROUPE: Record<Groupe, string> = {
  coherence: "Cohérence des chiffres",
  menage: "Revenu du ménage",
  tresorerie: "Trésorerie",
  financement: "Financement",
  marche: "Marché",
  technique: "Production et risques",
};

/** Un code nouveau du moteur n'a pas besoin d'être listé ici pour s'afficher : il tombe dans « Cohérence des chiffres ». */
const GROUPE_DU_CODE: Record<string, Groupe> = {
  HORIZON_INSUFFISANT: "tresorerie",
  POSTE_EN_DOUBLE: "coherence",
  UNITE_PERIODE: "coherence",
  VARIATION_BFR: "coherence",
  BFR_AMORTI: "coherence",
  RESSOURCE_EN_DOUBLE: "coherence",
  MENAGE_NON_COUVERT: "menage",
  MENAGE_NON_RENSEIGNE: "menage",
  ALERTE_MENAGE_NON_COUVERT: "menage",
  MASSE_SALARIALE: "menage",
  TRESORERIE_NEGATIVE: "tresorerie",
  ALERTE_MOIS_DEFICITAIRES_NON_FINANCES: "tresorerie",
  ALERTE_POINT_BAS_NON_COUVERT: "tresorerie",
  BFR_NON_FINANCE: "tresorerie",
  APPORT_INSUFFISANT: "financement",
  ALERTE_APPORT_SOUS_SEUIL: "financement",
  DUREE_HORS_REGLE: "financement",
  DIFFERE_HORS_REGLE: "financement",
  VOLUME_HORS_DEBOUCHE: "marche",
  CONCENTRATION_CLIENT: "marche",
  CONCENTRATION_FOURNISSEUR: "marche",
  ALERTE_EXPOSITION_PRIX: "marche",
  DERNIERES_ANNEES_DEFICITAIRES: "technique",
  RENDEMENT_HORS_BORNES: "technique",
  INTRANTS_ECART_ITINERAIRE: "technique",
  CONSOMMATION_BANDE: "technique",
  PERIODE_IMPRODUCTIVE: "technique",
  MAIN_OEUVRE_SAISONNIERE: "technique",
};

const ORDRE_GROUPES: Groupe[] = ["coherence", "menage", "tresorerie", "financement", "marche", "technique"];
const RANG = { bloquant: 0, alerte: 1, info: 2, ok: 3 } as const;

/** Le pire niveau d'un groupe donne son feu. */
const feuDuGroupe = (liste: Controle[]): Teinte =>
  liste.some((c) => c.niveau === "bloquant") ? "rouge" : liste.some((c) => c.niveau === "alerte") ? "orange" : liste.some((c) => c.niveau === "info") ? "gris" : "vert";
const MOT_FEU: Record<Teinte, string> = { rouge: "À régler", orange: "À surveiller", gris: "Pour information", vert: "Tout va bien" };

export function VueBilan({ controles }: { controles: Controle[] }) {
  const groupes = ORDRE_GROUPES.map((g) => ({ g, liste: controles.filter((c) => (GROUPE_DU_CODE[c.code] ?? "coherence") === g) })).filter((x) => x.liste.length > 0);
  const nbAttention = controles.filter((c) => c.niveau === "bloquant" || c.niveau === "alerte").length;
  return (
    <>
      <p className="m-0 text-lg font-semibold" role="status">
        {nbAttention === 0
          ? "Aucun point à régler avec les règles connues. Cela ne remplace pas l'avis d'un conseiller."
          : `${nbAttention} point${nbAttention > 1 ? "s" : ""} à regarder avant de présenter ton plan.`}
      </p>
      {groupes.map(({ g, liste }) => {
        const feu = feuDuGroupe(liste);
        const expliques = expliquerControles([...liste].sort((a, b) => RANG[a.niveau] - RANG[b.niveau]));
        return (
          <Section key={g} id={`groupe-${g}`} titre={TITRE_GROUPE[g]}>
            <div>
              <Feu teinte={feu} texte={MOT_FEU[feu]} />
            </div>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {expliques.map((c, i) => (
                <li key={`${c.code}-${i}`}>
                  <CarteControle c={c} />
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </>
  );
}

export function BilanSante() {
  const { plan } = usePlan();
  if (!plan.resultats) return <p className="m-0">Ce plan n&apos;est pas encore calculé.</p>;
  return <VueBilan controles={plan.resultats.scenarios.realiste.controles} />;
}
