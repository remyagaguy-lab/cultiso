"use client";

import { Alert, Skeleton } from "antd";
import { useEffect, useState } from "react";
import type { EntreeLexique } from "@/moteurs";

/** Le lexique des mots du plan d'affaires, en langage simple. Texte public : pas de connexion nécessaire. */
export function Lexique() {
  const [entrees, setEntrees] = useState<EntreeLexique[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    let annule = false;
    fetch("/api/cultiplan/lexique")
      .then(async (r) => {
        if (!r.ok) throw new Error("Le lexique est momentanément indisponible.");
        return (await r.json()) as { lexique: EntreeLexique[] };
      })
      .then((c) => !annule && setEntrees(c.lexique))
      .catch((e: unknown) => !annule && setErreur(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      annule = true;
    };
  }, []);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="m-0 font-title text-2xl font-bold">Lexique</h1>
        <p className="m-0 mt-1 text-sm text-muted">Les mots d&apos;un plan d&apos;affaires, expliqués simplement.</p>
      </header>
      {erreur && <Alert type="error" showIcon title={erreur} />}
      {!entrees && !erreur && <Skeleton active paragraph={{ rows: 8 }} aria-label="Chargement du lexique" />}
      {entrees && (
        <dl className="m-0 flex flex-col gap-4">
          {entrees.map((e) => (
            <div key={e.terme} className="rounded-card border border-border bg-surface p-4">
              <dt className="font-semibold">{e.terme}</dt>
              <dd className="m-0 mt-1 text-sm">{e.definition}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
