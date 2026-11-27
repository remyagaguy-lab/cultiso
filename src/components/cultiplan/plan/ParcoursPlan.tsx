"use client";

import { Alert, Button } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { appeler } from "../appeler";
import type { Plan } from "@/modules/cultiplan";
import { usePlan } from "./PlanContext";

export const ETAPES = (planId: string, exploitationId: string) => [
  { cle: "accueil", libelle: "Accueil", href: `/cultiplan/plans/${planId}` },
  { cle: "faisabilite", libelle: "Faisabilité", href: `/cultiplan/projets/${exploitationId}/faisabilite` },
  { cle: "proposition", libelle: "Proposition", href: `/cultiplan/projets/${exploitationId}/proposition` },
  { cle: "scenarios", libelle: "Et si ça tourne mal ?", href: `/cultiplan/plans/${planId}/scenarios` },
  { cle: "menage", libelle: "Ta famille", href: `/cultiplan/plans/${planId}/menage` },
  { cle: "financement", libelle: "Financement", href: `/cultiplan/plans/${planId}/financement` },
  { cle: "bilan", libelle: "Bilan de santé", href: `/cultiplan/plans/${planId}/bilan` },
];

/** En-tête du plan, navigation en parcours, et actions « Recalculer » et « Et si ? ». */
export function ParcoursPlan({ children }: { children: ReactNode }) {
  const { plan, remplacer } = usePlan();
  const chemin = usePathname();
  const router = useRouter();
  const [enCours, setEnCours] = useState<"recalcul" | "variante" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const etapes = ETAPES(plan.id, plan.exploitationId);

  async function recalculer() {
    setEnCours("recalcul");
    setErreur(null);
    try {
      remplacer(await appeler<Plan>(`/api/cultiplan/plans/${plan.id}/recalculer`, { method: "POST" }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Recalcul impossible.");
    } finally {
      setEnCours(null);
    }
  }

  async function variante() {
    setEnCours("variante");
    setErreur(null);
    try {
      const v = await appeler<Plan>(`/api/cultiplan/plans/${plan.id}/dupliquer`, { method: "POST", body: JSON.stringify({}) });
      router.push(`/cultiplan/plans/${v.id}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Copie impossible.");
      setEnCours(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 font-title text-2xl font-bold">{plan.titre}</h1>
            <p className="m-0 mt-1 text-sm text-muted">
              Version {plan.version}, moteur {plan.versionMoteur ?? "non calculé"}. Chaque chiffre vient du moteur de calcul de Cultiso.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={recalculer} loading={enCours === "recalcul"} disabled={plan.statut !== "brouillon"}>
              Recalculer
            </Button>
            <Button onClick={variante} loading={enCours === "variante"}>
              Et si ?
            </Button>
          </div>
        </div>
        <nav aria-label="Étapes du parcours">
          <ol className="m-0 flex list-none gap-1 overflow-x-auto p-0 pb-1">
            {etapes.map((e, i) => {
              const actif = chemin === e.href;
              return (
                <li key={e.cle} className="shrink-0">
                  <Link
                    href={e.href}
                    aria-current={actif ? "step" : undefined}
                    className={`inline-flex items-center gap-2 rounded-button px-3 py-1.5 text-sm no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${actif ? "bg-selected font-semibold text-foreground" : "text-muted hover:bg-sunken"}`}
                  >
                    <span className="text-xs tabular-nums" aria-hidden="true">{i + 1}</span>
                    {e.libelle}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
        {plan.statut !== "brouillon" && <Alert type="info" showIcon title="Ce plan est lancé : fais-en une variante « Et si ? » pour le modifier." />}
        {erreur && <Alert type="error" showIcon title={erreur} closable onClose={() => setErreur(null)} />}
      </header>
      {children}
    </div>
  );
}
