"use client";

import { Alert } from "antd";
import { useCallback, useEffect, useState } from "react";
import type { RegleFinanceur } from "@/moteurs/controles";
import { versRegleMoteur, type RegleFinanceurRef } from "@/referentiel";
import type { Plan } from "@/modules/cultiplan";
import { appeler } from "../appeler";
import { ChoixFinanceur } from "../ChoixFinanceur";
import { IndicateurExplique } from "../IndicateurExplique";
import { Carte, Section, fcfa, pourcent } from "../commun";
import { PlanFinancement } from "./PlanFinancement";
import { usePlan } from "./PlanContext";

const memeRegle = (a: RegleFinanceur | null | undefined, b: RegleFinanceur): boolean => JSON.stringify(a ?? null) === JSON.stringify(b);

/** Financement : l'argent à trouver, l'apport, le financeur choisi et ce que ses règles contrôlent. */
export function FinancementPlan() {
  const { plan, remplacer } = usePlan();
  const [financeurs, setFinanceurs] = useState<RegleFinanceurRef[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    appeler<RegleFinanceurRef[]>("/api/cultiplan/financeurs")
      .then((f) => !annule && setFinanceurs(f))
      .catch((e: unknown) => !annule && setErreur(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      annule = true;
    };
  }, []);

  const choisir = useCallback(
    async (regle: RegleFinanceurRef | null) => {
      setEnCours(true);
      setErreur(null);
      try {
        const corps = JSON.stringify({ financement: { regleFinanceur: regle ? versRegleMoteur(regle) : null } });
        remplacer(await appeler<Plan>(`/api/cultiplan/plans/${plan.id}`, { method: "PATCH", body: corps }));
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      } finally {
        setEnCours(false);
      }
    },
    [plan.id, remplacer],
  );

  const regle = plan.financement.regleFinanceur;
  const choisi = regle ? (financeurs.find((f) => memeRegle(regle, versRegleMoteur(f))) ?? null) : null;
  const r = plan.resultats?.scenarios.realiste;
  const fige = plan.statut !== "brouillon";
  const controlesFinancement = r?.controles.filter((c) => ["APPORT_INSUFFISANT", "DUREE_HORS_REGLE", "DIFFERE_HORS_REGLE", "BFR_NON_FINANCE"].includes(c.code)) ?? [];

  return (
    <>
      {erreur && <Alert type="error" showIcon title={erreur} closable onClose={() => setErreur(null)} />}
      {plan.resultats && r && (
        <Section id="argent" titre="L'argent à trouver" intro="Scénario réaliste.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <IndicateurExplique cle="coutProjet" valeur={fcfa(r.ratios.coutProjet)} />
            <IndicateurExplique cle="partApport" valeur={r.ratios.partApport === null ? "non calculable" : pourcent(r.ratios.partApport)} />
            <IndicateurExplique cle="investissementTotal" valeur={fcfa(plan.resultats.investissementTotal)} />
          </div>
          <Carte>
            <p className="m-0 text-sm">
              Après ton apport, il reste <strong>{fcfa(plan.resultats.besoinFinancement)}</strong> à trouver. Monte ton plan de financement plus bas.
            </p>
          </Carte>
        </Section>
      )}

      <Section id="financeur" titre="Le financeur">
        <ChoixFinanceur financeurs={financeurs} choisi={choisi} onChoisir={choisir} desactive={fige} enCours={enCours} />
        {regle && !choisi && financeurs.length > 0 && (
          <Alert type="info" showIcon title={`Financeur enregistré : ${regle.nom}. Il n'est plus dans le référentiel actuel, ou ses règles ont changé.`} />
        )}
      </Section>

      <PlanFinancement />

      {regle && (
        <Section id="regles" titre={`Ce que ${regle.nom} contrôle`}>
          {controlesFinancement.length === 0 ? (
            <p className="m-0 text-sm">Aucun contrôle de financement n&apos;a été calculé pour ce plan.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {controlesFinancement.map((c, i) => (
                <li key={`${c.code}-${i}`} className="rounded-card border border-border bg-surface p-3 text-sm">
                  <strong>{c.niveau === "ok" ? "Respecté" : "À corriger"} :</strong> {c.message}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </>
  );
}
