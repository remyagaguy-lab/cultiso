"use client";

import Link from "next/link";
import type { PointFaisabilite as Point } from "@/modules/cultiplan";
import { FEU } from "./reponse";

const FOND: Record<keyof typeof FEU, string> = {
  vert: "bg-[#e8f5ec] text-[#14532d]",
  orange: "bg-[#fdf1e1] text-[#7c3d06]",
  rouge: "bg-[#fdeceb] text-[#7a1b14]",
  gris: "bg-[#eef0f2] text-[#374151]",
};

/** Le point de faisabilité : un feu par dimension, avec le mot, un symbole et une phrase (la couleur ne porte jamais seule le sens). */
export function PointFaisabilite({ point, hrefConsultation }: { point: Point; hrefConsultation?: string }) {
  const global = FEU[point.feuGlobal];
  return (
    <section aria-labelledby="titre-point" className="flex flex-col gap-4">
      <div>
        <h2 id="titre-point" className="m-0 text-lg font-semibold">
          Le point sur ton projet
        </h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Ensemble : <strong>{global.mot}</strong> ({global.sens}). Tu as répondu à {point.essentielles.traitees} questions essentielles sur {point.essentielles.total}.
        </p>
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
        {point.dimensions.map((d) => {
          const f = FEU[d.feu];
          return (
            <li key={d.dimension} className={`rounded-card border border-border bg-surface p-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-base font-semibold">{d.libelle}</h3>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${FOND[d.feu]}`}>
                  <span aria-hidden="true">{f.symbole}</span>
                  {f.mot} : {f.sens}
                </span>
              </div>
              <p className="m-0 mt-2 text-sm">{d.phrase}</p>
              {d.points.filter((p) => p.phrase !== d.phrase).length > 0 && (
                <ul className="m-0 mt-2 list-disc pl-5 text-sm text-muted">
                  {d.points
                    .filter((p) => p.phrase !== d.phrase)
                    .map((p) => (
                      <li key={p.phrase}>{p.phrase}</li>
                    ))}
                </ul>
              )}
              {hrefConsultation && d.feu !== "vert" && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium">Que faire ?</summary>
                  <p className="m-0 mt-2">
                    {d.manques.length + d.inconnus.length > 0
                      ? `Réponds à ce qui manque : ${[...d.manques, ...d.inconnus].join(", ")}.`
                      : "Regarde les options avec ton conseiller : louer, réduire la taille, te former, chercher un acheteur ou t'associer."}{" "}
                    <Link href={hrefConsultation}>Reprendre la consultation</Link>
                  </p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {point.aValider && (
        <p className="m-0 text-sm text-muted">
          Ces feux sont des repères. Les règles qui les décident sont des brouillons en cours de relecture par un expert : ils ne remplacent pas l&apos;avis d&apos;un technicien. Aucun calcul d&apos;argent n&apos;est fait ici : les chiffres viennent du plan.
        </p>
      )}
    </section>
  );
}
