"use client";

import { Collapse } from "antd";
import { expliquerIndicateur } from "@/moteurs/explications";

/** Un chiffre du plan avec son nom, sa phrase simple et sa version technique dépliable. `valeur` est déjà formatée (FCFA, %, mois). */
export function IndicateurExplique({ cle, valeur }: { cle: string; valeur: string }) {
  const f = expliquerIndicateur(cle);
  if (!f) return null;
  return (
    <div className="rounded-[var(--ork-use-radius-card,12px)] border border-border bg-surface p-4">
      <p className="m-0 text-sm text-muted">{f.nom}</p>
      <p className="m-0 my-1 text-2xl font-bold tabular-nums">{valeur}</p>
      <p className="m-0 mb-2 text-sm">{f.simple}</p>
      <Collapse ghost size="small" items={[{ key: cle, label: "Détail technique", children: <p className="m-0 text-sm">{f.technique}</p> }]} />
    </div>
  );
}
