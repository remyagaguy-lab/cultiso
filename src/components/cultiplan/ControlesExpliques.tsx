"use client";

import { Collapse, Tag, Typography } from "antd";
import type { Controle, NiveauControle } from "@/moteurs/controles";
import { expliquerControles, type ControleExplique } from "@/moteurs/explications";

const NIVEAUX: Record<NiveauControle, { libelle: string; couleur: string; ordre: number }> = {
  ok: { libelle: "Rien à signaler", couleur: "success", ordre: 3 },
  bloquant: { libelle: "À régler avant de continuer", couleur: "error", ordre: 0 },
  alerte: { libelle: "À surveiller", couleur: "warning", ordre: 1 },
  info: { libelle: "Pour information", couleur: "processing", ordre: 2 },
};

const formater = (v: Controle["valeurs"][string]): string => (Array.isArray(v) ? v.join(", ") : v === null ? "non renseigné" : String(v));

/** Détail technique : version du moteur et chiffres qui fondent le contrôle. Les chiffres viennent du moteur, jamais de l'IA. */
function Technique({ c }: { c: ControleExplique }) {
  const valeurs = Object.entries(c.valeurs);
  return (
    <div className="text-sm">
      <p className="m-0 mb-3">{c.technique}</p>
      {valeurs.length > 0 && (
        <dl className="m-0 grid grid-cols-[minmax(0,max-content)_1fr] gap-x-4 gap-y-1">
          {valeurs.map(([cle, v]) => (
            <div key={cle} className="contents">
              <dt className="text-muted font-medium">{cle}</dt>
              <dd className="m-0 break-words">{formater(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="m-0 mt-3 text-muted">Code : {c.code}</p>
    </div>
  );
}


/** Un contrôle : niveau en toutes lettres, phrase du moteur, explication simple, détail technique dépliable. */
export function CarteControle({ c }: { c: ControleExplique }) {
  const n = NIVEAUX[c.niveau];
  return (
    <div className="rounded-card border border-border bg-surface p-4 transition-shadow hover:shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Tag color={n.couleur} className="m-0">
          {n.libelle}
        </Tag>
        <Typography.Text strong>{c.nom}</Typography.Text>
      </div>
      <p className="m-0 mb-1 font-medium">{c.message}</p>
      <p className="m-0 mb-3 text-sm text-muted">{c.simple}</p>
      <Collapse ghost size="small" items={[{ key: c.code, label: "Détail technique", children: <Technique c={c} /> }]} />
    </div>
  );
}

/**
 * Contrôles et alertes d'un plan : la phrase simple est toujours visible, la version technique se déplie au clavier ou au toucher.
 * Le niveau est dit en toutes lettres (jamais par la couleur seule).
 */
export function ControlesExpliques({ controles }: { controles: Controle[] }) {
  const expliques = expliquerControles(controles.filter((c) => c.niveau !== "ok")).sort(
    (a, b) => NIVEAUX[a.niveau].ordre - NIVEAUX[b.niveau].ordre,
  );

  if (expliques.length === 0) {
    return (
      <p className="m-0 text-sm" role="status">
        Aucun point d&apos;attention sur ce plan avec les règles connues. Cela ne remplace pas l&apos;avis d&apos;un conseiller.
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Contrôles et alertes du plan">
      {expliques.map((c, i) => (
        <li key={`${c.code}-${i}`}>
          <CarteControle c={c} />
        </li>
      ))}
    </ul>
  );
}
