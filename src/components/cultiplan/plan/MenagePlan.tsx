"use client";

import { Collapse } from "antd";
import type { ResultatScenario } from "./verdict";
import { Carte, Feu, Section, fcfa } from "../commun";
import { IndicateurExplique } from "../IndicateurExplique";
import { usePlan } from "./PlanContext";

/** Courbe de la caisse mois par mois, point bas marqué. Seul le dessin est calculé ici (échelle) : les montants viennent du moteur. */
export function CourbeTresorerie({ mois, pointBas }: { mois: { mois: number; cumul: number }[]; pointBas: { montant: number; mois: number } }) {
  const L = 600;
  const H = 180;
  const marge = 24;
  const valeurs = mois.map((m) => m.cumul);
  const min = Math.min(0, ...valeurs);
  const max = Math.max(0, ...valeurs);
  const etendue = max - min || 1;
  const x = (i: number) => marge + (i * (L - 2 * marge)) / Math.max(1, mois.length - 1);
  const y = (v: number) => H - marge - ((v - min) * (H - 2 * marge)) / etendue;
  const trace = mois.map((m, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(m.cumul).toFixed(1)}`).join(" ");
  const iBas = mois.findIndex((m) => m.mois === pointBas.mois);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`Caisse mois par mois. Point le plus bas : ${fcfa(pointBas.montant)} au mois ${pointBas.mois}.`} className="h-auto w-full">
        <line x1={marge} x2={L - marge} y1={y(0)} y2={y(0)} stroke="var(--ork-use-border-default)" strokeDasharray="4 4" />
        <path d={trace} fill="none" stroke="var(--ork-use-data-1-mark)" strokeWidth="2.5" strokeLinejoin="round" />
        {iBas >= 0 && (
          <g>
            <circle cx={x(iBas)} cy={y(pointBas.montant)} r="5" fill="var(--ork-use-background-danger-bold)" />
            <text x={Math.min(Math.max(x(iBas), 90), L - 90)} y={y(pointBas.montant) + 18} textAnchor="middle" fontSize="12" fill="var(--ork-use-text-default)">
              Mois {pointBas.mois}
            </text>
          </g>
        )}
        <text x={marge} y={H - 6} fontSize="11" fill="var(--ork-use-text-subtle)">
          Mois 0
        </text>
        <text x={L - marge} y={H - 6} textAnchor="end" fontSize="11" fill="var(--ork-use-text-subtle)">
          Mois {mois[mois.length - 1]?.mois ?? 12}
        </text>
      </svg>
      <figcaption className="mt-1 text-xs text-muted">La ligne pointillée est le zéro. Sous cette ligne, ta caisse est vide.</figcaption>
    </figure>
  );
}

export function VueMenage({ scenario }: { scenario: ResultatScenario }) {
  const an1 = scenario.annees[0];
  const couvert = scenario.verdict.menageCouvert;
  return (
    <>
      <Carte className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {couvert === null ? <Feu teinte="gris" texte="Pas renseigné" /> : couvert ? <Feu teinte="vert" texte="Couvert" /> : <Feu teinte="rouge" texte="Pas couvert" />}
          <span className="text-sm text-muted">Dépenses de la famille et crédit</span>
        </div>
        <p className="m-0 text-lg font-semibold" role="status">
          {couvert === null
            ? "Tu n'as pas encore dit combien ta famille dépense : Cultiso ne peut pas dire si le projet la fait vivre."
            : couvert
              ? "Chaque année, ce que le projet dégage couvre le crédit et les dépenses de ta famille."
              : "Une année au moins, le projet ne couvre pas à la fois le crédit et les dépenses de ta famille."}
        </p>
      </Carte>

      <Section id="annees" titre="Année après année" intro="Ce que le projet rapporte, ce que prend la famille, ce qui reste.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm tabular-nums">
            <caption className="sr-only">Capacité de remboursement et solde résiduel par année</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left font-medium text-muted">Année</th>
                <th scope="col" className="p-2 text-right font-medium">Argent pris pour la famille</th>
                <th scope="col" className="p-2 text-right font-medium">Capacité de remboursement</th>
                <th scope="col" className="p-2 text-right font-medium">Crédit sur l&apos;année</th>
                <th scope="col" className="p-2 text-right font-medium">Ce qui reste</th>
              </tr>
            </thead>
            <tbody>
              {scenario.annees.map((a) => (
                <tr key={a.an} className="border-t border-border">
                  <th scope="row" className="p-2 text-left font-medium">{a.an}</th>
                  <td className="p-2 text-right">{fcfa(a.prelevementsNets)}</td>
                  <td className="p-2 text-right">{fcfa(a.capaciteRemboursement)}</td>
                  <td className="p-2 text-right">{fcfa(a.annuites)}</td>
                  <td className="p-2 text-right font-semibold">{fcfa(a.soldeResiduel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <IndicateurExplique cle="capaciteRemboursement" valeur={fcfa(an1.capaciteRemboursement)} />
          <IndicateurExplique cle="soldeResiduel" valeur={fcfa(an1.soldeResiduel)} />
          <IndicateurExplique cle="prelevementsNets" valeur={fcfa(an1.prelevementsNets)} />
        </div>
      </Section>

      <Section id="caisse" titre="Ta caisse, mois par mois" intro="Première année. Le mois le plus difficile est marqué.">
        <Carte>
          <CourbeTresorerie mois={scenario.tresorerieMensuelleAn1} pointBas={scenario.pointBasTresorerie} />
          <p className="m-0 mt-2 text-sm">
            {scenario.moisDeficitaires.length > 0
              ? `Tu dépenses plus que tu ne reçois les mois ${scenario.moisDeficitaires.join(", ")}.`
              : "Tu reçois plus que tu ne dépenses chaque mois."}{" "}
            {scenario.moisTresorerieNegative.length > 0 ? `Ta caisse est négative les mois ${scenario.moisTresorerieNegative.join(", ")}.` : "Ta caisse ne passe jamais sous zéro."}
          </p>
        </Carte>
        <Collapse
          items={[
            {
              key: "mois",
              label: "Le détail mois par mois",
              children: (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm tabular-nums">
                    <caption className="sr-only">Trésorerie mensuelle de la première année</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="p-2 text-left font-medium text-muted">Mois</th>
                        <th scope="col" className="p-2 text-right font-medium">Entrées</th>
                        <th scope="col" className="p-2 text-right font-medium">Sorties</th>
                        <th scope="col" className="p-2 text-right font-medium">Famille</th>
                        <th scope="col" className="p-2 text-right font-medium">Caisse</th>
                        <th scope="col" className="p-2 text-right font-medium">Retrait possible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenario.tresorerieMensuelleAn1.map((m) => (
                        <tr key={m.mois} className="border-t border-border">
                          <th scope="row" className="p-2 text-left font-medium">{m.mois}</th>
                          <td className="p-2 text-right">{fcfa(m.entrees)}</td>
                          <td className="p-2 text-right">{fcfa(m.sorties)}</td>
                          <td className="p-2 text-right">{fcfa(m.prelevementsNets)}</td>
                          <td className="p-2 text-right">{fcfa(m.cumul)}</td>
                          <td className="p-2 text-right">{fcfa(m.retraitPossible)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="m-0 mt-2 text-xs text-muted">« Retrait possible » : l&apos;argent que ta famille peut retirer ce mois-ci sans que la caisse passe sous zéro d&apos;ici la fin de l&apos;année.</p>
                </div>
              ),
            },
          ]}
        />
      </Section>
    </>
  );
}

export function MenagePlan() {
  const { plan } = usePlan();
  if (!plan.resultats) return <p className="m-0">Ce plan n&apos;est pas encore calculé.</p>;
  return <VueMenage scenario={plan.resultats.scenarios.realiste} />;
}
