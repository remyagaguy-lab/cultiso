"use client";

import type { ReactNode } from "react";

/** Carte du design system : fond relevé, bordure neutre (jamais de bordure colorée latérale ou supérieure). */
export function Carte({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-border bg-surface p-4 ${className}`}>{children}</div>;
}

export type Teinte = "vert" | "orange" | "rouge" | "gris";

const TEINTES: Record<Teinte, { mot: string; symbole: string; classes: string }> = {
  vert: { mot: "Vert", symbole: "✓", classes: "bg-[var(--ork-use-background-success-subtle)] text-[var(--ork-use-text-success)]" },
  orange: { mot: "Orange", symbole: "!", classes: "bg-[var(--ork-use-background-warning-subtle)] text-[var(--ork-use-text-warning)]" },
  rouge: { mot: "Rouge", symbole: "✕", classes: "bg-[var(--ork-use-background-danger-subtle)] text-[var(--ork-use-text-danger)]" },
  gris: { mot: "Pas encore évalué", symbole: "?", classes: "bg-sunken text-muted" },
};

/** Un feu : le mot et un symbole disent le sens, la couleur ne porte jamais seule. */
export function Feu({ teinte, texte }: { teinte: Teinte; texte?: string }) {
  const t = TEINTES[teinte];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.classes}`}>
      <span aria-hidden="true">{t.symbole}</span>
      {texte ?? t.mot}
    </span>
  );
}

/** Titre de section avec une lecture simple, puis le contenu. */
export function Section({ id, titre, intro, children }: { id: string; titre: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h2 id={id} className="m-0 text-lg font-semibold">
          {titre}
        </h2>
        {intro && <p className="m-0 mt-1 text-sm text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
/** Mise en forme seulement : le nombre vient du moteur. */
export const nb = (v: number): string => nombre.format(v).replace(/\s/g, " ");
export const pourcent = (v: number): string => `${nombre.format(Math.round(v * 1000) / 10)} %`;
export const fcfa = (v: number): string => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v).replace(/\s/g, " ")} FCFA`;

/** Une phrase d'origine en petit : d'où vient le chiffre. */
export function Origine({ children }: { children: ReactNode }) {
  return <p className="m-0 mt-1 text-xs text-muted">Origine : {children}</p>;
}
