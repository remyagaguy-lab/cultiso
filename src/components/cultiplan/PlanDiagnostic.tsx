"use client";

import { Alert, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { enFcfa, type RegleFinanceur } from "@/moteurs/controles";
import { versRegleMoteur, type RegleFinanceurRef } from "@/referentiel";
import type { Plan } from "@/modules/cultiplan";
import { appeler } from "./appeler";
import { ChoixFinanceur } from "./ChoixFinanceur";
import { ControlesExpliques } from "./ControlesExpliques";
import { IndicateurExplique } from "./IndicateurExplique";

const memeRegle = (a: RegleFinanceur | null | undefined, b: RegleFinanceur): boolean => JSON.stringify(a ?? null) === JSON.stringify(b);

/** Écran du verdict d'un plan : chiffres clés, choix du financeur, contrôles et alertes en langage simple. */
export function PlanDiagnostic({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [financeurs, setFinanceurs] = useState<RegleFinanceurRef[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    let annule = false;
    Promise.all([appeler<Plan>(`/api/cultiplan/plans/${planId}`), appeler<RegleFinanceurRef[]>("/api/cultiplan/financeurs")])
      .then(([p, f]) => {
        if (annule) return;
        setPlan(p);
        setFinanceurs(f);
      })
      .catch((e: unknown) => {
        if (!annule) setErreur(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      annule = true;
    };
  }, [planId]);

  const choisir = useCallback(
    async (regle: RegleFinanceurRef | null) => {
      setEnregistrement(true);
      setErreur(null);
      try {
        const corps = JSON.stringify({ financement: { regleFinanceur: regle ? versRegleMoteur(regle) : null } });
        setPlan(await appeler<Plan>(`/api/cultiplan/plans/${planId}`, { method: "PATCH", body: corps }));
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      } finally {
        setEnregistrement(false);
      }
    },
    [planId],
  );

  if (!plan && !erreur) return <Skeleton active paragraph={{ rows: 8 }} aria-label="Chargement du plan" />;
  if (!plan) return <Alert type="error" showIcon title={erreur} />;

  const realiste = plan.resultats?.scenarios.realiste;
  const an1 = realiste?.annees[0];
  const regle = plan.financement.regleFinanceur;
  const choisi = regle ? (financeurs.find((f) => memeRegle(regle, versRegleMoteur(f))) ?? null) : null;
  const fige = plan.statut !== "brouillon";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 sm:p-8">
      <header>
        <h1 className="m-0 font-title text-2xl font-bold">{plan.titre}</h1>
        <p className="m-0 mt-1 text-sm text-muted">
          Version {plan.version}, moteur {plan.versionMoteur ?? "non calculé"}. Chaque chiffre vient du moteur de calcul de Cultiso.
        </p>
      </header>

      {erreur && <Alert type="error" showIcon title={erreur} closable onClose={() => setErreur(null)} />}

      <section aria-labelledby="financeur">
        <h2 id="financeur" className="mb-3 mt-0 text-lg font-semibold">
          Le financeur
        </h2>
        <ChoixFinanceur financeurs={financeurs} choisi={choisi} onChoisir={choisir} desactive={fige} enCours={enregistrement} />
        {fige && <p className="m-0 mt-2 text-sm text-muted">Ce plan est lancé : fais-en une variante « Et si ? » pour changer de financeur.</p>}
        {regle && !choisi && (
          <Alert
            className="mt-3"
            type="info"
            showIcon
            title={`Financeur enregistré : ${regle.nom}. Il n'est plus dans le référentiel actuel, ou ses règles ont changé.`}
          />
        )}
      </section>

      {realiste && an1 && (
        <section aria-labelledby="chiffres">
          <h2 id="chiffres" className="mb-3 mt-0 text-lg font-semibold">
            Les chiffres clés (scénario réaliste, première année)
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <IndicateurExplique cle="chiffreAffaires" valeur={enFcfa(an1.chiffreAffaires)} />
            <IndicateurExplique cle="resultat" valeur={enFcfa(an1.resultat)} />
            <IndicateurExplique cle="besoinFondsRoulement" valeur={enFcfa(realiste.besoinFondsRoulement)} />
            <IndicateurExplique cle="pointBasTresorerie" valeur={enFcfa(realiste.pointBasTresorerie.montant)} />
          </div>
        </section>
      )}

      <section aria-labelledby="controles">
        <h2 id="controles" className="mb-3 mt-0 text-lg font-semibold">
          Ce qu&apos;il faut vérifier
        </h2>
        {realiste ? <ControlesExpliques controles={realiste.controles} /> : <p className="m-0">Ce plan n&apos;est pas encore calculé.</p>}
      </section>
    </div>
  );
}
