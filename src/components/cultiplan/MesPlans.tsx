"use client";

import { Alert, Empty, Skeleton, Tag } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlanDeLaListe } from "@/modules/cultiplan";
import { appeler } from "./appeler";

const STATUT: Record<PlanDeLaListe["statut"], { libelle: string; couleur: string }> = {
  brouillon: { libelle: "Brouillon", couleur: "default" },
  lance: { libelle: "Lancé", couleur: "success" },
  archive: { libelle: "Archivé", couleur: "default" },
};

const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso));

/** Liste des plans de l'utilisateur : chaque plan ouvre son diagnostic (chiffres clés, financeur, contrôles). */
export function MesPlans() {
  const [plans, setPlans] = useState<PlanDeLaListe[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    appeler<PlanDeLaListe[]>("/api/cultiplan/plans")
      .then((p) => !annule && setPlans(p))
      .catch((e: unknown) => {
        if (!annule) setErreur(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      annule = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="m-0 font-title text-2xl font-bold">Mes plans</h1>
        <p className="m-0 mt-1 text-sm text-muted">Chaque plan garde ses chiffres, son financeur et ses points d&apos;attention.</p>
      </header>

      {erreur && <Alert type="error" showIcon title={erreur} />}
      {!plans && !erreur && <Skeleton active paragraph={{ rows: 5 }} aria-label="Chargement de tes plans" />}
      {plans && plans.length === 0 && (
        <Empty description="Tu n'as pas encore de plan. Commence par décrire ton projet à Cultisia, dans Cultiplan." />
      )}
      {plans && plans.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Liste de tes plans">
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/cultiplan/plans/${p.id}`}
                className="block rounded-[var(--ork-use-radius-card,12px)] border border-border bg-surface p-4 no-underline transition-all hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <strong className="text-foreground">{p.titre}</strong>
                  <Tag color={STATUT[p.statut].couleur} className="m-0">
                    {STATUT[p.statut].libelle}
                  </Tag>
                  {p.varianteDe && (
                    <Tag className="m-0">Et si ?</Tag>
                  )}
                </div>
                <p className="m-0 text-sm text-muted">
                  {p.exploitationNom ? `${p.exploitationNom} · ` : ""}version {p.version} · modifié le {date(p.majLe)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
