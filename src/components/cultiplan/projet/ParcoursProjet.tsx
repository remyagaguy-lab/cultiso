"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Navigation des écrans d'un projet (avant le plan) : consultation, faisabilité, proposition, atelier animal. */
export function ParcoursProjet({ exploitationId, children }: { exploitationId: string; children: ReactNode }) {
  const chemin = usePathname();
  const base = `/cultiplan/projets/${exploitationId}`;
  const etapes = [
    { libelle: "Consultation", href: `${base}/consultation` },
    { libelle: "Faisabilité", href: `${base}/faisabilite` },
    { libelle: "Débouchés", href: `${base}/debouches` },
    { libelle: "Proposition", href: `${base}/proposition` },
    { libelle: "Main d'oeuvre", href: `${base}/main-oeuvre` },
    { libelle: "Atelier animal", href: `${base}/elevage` },
  ];
  return (
    <>
      <nav aria-label="Étapes du projet" className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-8">
        <ol className="m-0 flex list-none gap-1 overflow-x-auto p-0 pb-1">
          {etapes.map((e, i) => {
            const actif = chemin === e.href;
            return (
              <li key={e.href} className="shrink-0">
                <Link
                  href={e.href}
                  aria-current={actif ? "step" : undefined}
                  className={`inline-flex items-center gap-2 rounded-button px-3 py-1.5 text-sm no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${actif ? "bg-selected font-semibold text-foreground" : "text-muted hover:bg-sunken"}`}
                >
                  <span className="text-xs tabular-nums" aria-hidden="true">
                    {i + 1}
                  </span>
                  {e.libelle}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      {children}
    </>
  );
}
