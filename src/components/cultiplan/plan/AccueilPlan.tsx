"use client";

import Link from "next/link";
import type { ResultatFinance } from "@/moteurs";
import { Carte, Feu, Section, fcfa, type Teinte } from "../commun";
import { IndicateurExplique } from "../IndicateurExplique";
import { usePlan } from "./PlanContext";
import { verdictEnUnePhrase } from "./verdict";

const MOT_VERDICT: Record<"vert" | "orange" | "rouge", string> = { vert: "Ça tient", orange: "Ça tient à peine", rouge: "Ça ne tient pas" };

/** Lecture simple en haut (une phrase, un feu, trois chiffres) ; détail technique dépliable sous chaque chiffre. */
export function VueAccueil({ resultats }: { resultats: ResultatFinance }) {
  const r = resultats.scenarios.realiste;
  const an1 = r.annees[0];
  const verdict = verdictEnUnePhrase(r);
  return (
    <>
      <Carte className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Feu teinte={verdict.teinte as Teinte} texte={MOT_VERDICT[verdict.teinte]} />
          <span className="text-sm text-muted">Scénario réaliste</span>
        </div>
        <p className="m-0 text-xl font-semibold" role="status">
          {verdict.phrase}
        </p>
      </Carte>
      <Section id="trois-chiffres" titre="Les trois chiffres à retenir" intro="Première année, scénario réaliste.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <IndicateurExplique cle="coutProjet" valeur={fcfa(resultats.besoinFinancement)} />
          <IndicateurExplique cle="cafDisponible" valeur={fcfa(an1.cafDisponible)} />
          <IndicateurExplique cle="pointBasTresorerie" valeur={`${fcfa(r.pointBasTresorerie.montant)} (mois ${r.pointBasTresorerie.mois})`} />
        </div>
        <p className="m-0 text-sm text-muted">Le premier chiffre est l&apos;argent à trouver, une fois ton apport déduit.</p>
      </Section>
    </>
  );
}

export function AccueilPlan() {
  const { plan } = usePlan();
  if (!plan.resultats) return <p className="m-0">Ce plan n&apos;est pas encore calculé. Utilise « Recalculer ».</p>;
  return (
    <>
      <VueAccueil resultats={plan.resultats} />
      <Carte className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm">Étape suivante : regarde ce qui se passe si les prix baissent ou si la récolte est moins bonne.</p>
        <Link href={`/cultiplan/plans/${plan.id}/scenarios`} className="font-semibold">
          Voir « Et si ça tourne mal ? »
        </Link>
      </Carte>
    </>
  );
}
