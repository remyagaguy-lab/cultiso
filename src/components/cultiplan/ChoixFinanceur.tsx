"use client";

import { Select, Tag } from "antd";
import { useId } from "react";
import type { RegleFinanceurRef } from "@/referentiel";

const cle = (r: Pick<RegleFinanceurRef, "organisme" | "produit">) => `${r.organisme}|${r.produit}`;
const pays = (code: string | null) => (code ? (new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code) : null);
const enMois = (m: number) => (m % 12 === 0 ? `${m / 12} an${m / 12 > 1 ? "s" : ""}` : `${m} mois`);
const INCONNU = "non connu";

export const STATUT_LIBELLE: Record<RegleFinanceurRef["statut"], string> = {
  brouillon_ia: "À confirmer par un expert",
  a_valider: "En cours de validation",
  validee: "Validée par un expert",
};

/** Ce que la règle dit, valeur par valeur. Une valeur absente de la source est dite « non connue », jamais remplacée. */
function Resume({ r }: { r: RegleFinanceurRef }) {
  const lignes: [string, string][] = [
    ["Apport minimum", r.apportMinimum === null ? INCONNU : `${Math.round(r.apportMinimum * 1000) / 10} % du coût du projet`],
    ["Durée maximale", r.dureeMaxMois === null ? INCONNU : `${enMois(r.dureeMaxMois)}${r.dureeInclutDiffere ? ", différé compris" : ", hors différé"}`],
    ["Différé maximal", r.differeMaxMois === null ? INCONNU : enMois(r.differeMaxMois)],
    ["Taux indicatif", r.tauxIndicatif === null ? INCONNU : `${Math.round(r.tauxIndicatif * 1000) / 10} % par an`],
  ];
  return (
    <div className="mt-3 rounded-[var(--ork-use-radius-card,12px)] border border-border bg-surface p-4" aria-live="polite">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <strong>{r.libelle}</strong>
        <Tag color={r.statut === "validee" ? "success" : "warning"} className="m-0">
          {STATUT_LIBELLE[r.statut]}
        </Tag>
      </div>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
        {lignes.map(([nom, valeur]) => (
          <div key={nom} className="contents">
            <dt className="text-muted">{nom}</dt>
            <dd className="m-0">{valeur}</dd>
          </div>
        ))}
      </dl>
      {r.piecesExigees.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">Pièces à réunir ({r.piecesExigees.length})</summary>
          <ul className="mt-2 pl-5">
            {r.piecesExigees.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}
      {r.notes && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer font-medium">Notes et limites de la source</summary>
          <p className="mt-2">{r.notes}</p>
        </details>
      )}
      {r.source && <p className="m-0 mt-2 text-xs text-muted">Source : {r.source}</p>}
    </div>
  );
}

interface Props {
  financeurs: RegleFinanceurRef[];
  /** Organisme et produit choisis, ou null. */
  choisi: Pick<RegleFinanceurRef, "organisme" | "produit"> | null;
  onChoisir: (regle: RegleFinanceurRef | null) => void;
  /** Plan lancé (figé) : le choix est bloqué. */
  desactive?: boolean;
  /** Enregistrement en cours. */
  enCours?: boolean;
}

/** Choix du financeur visé : alimente `financement.regleFinanceur` du plan, donc les contrôles d'apport, de durée et de différé. */
export function ChoixFinanceur({ financeurs, choisi, onChoisir, desactive, enCours }: Props) {
  const id = useId();
  const courant = choisi ? financeurs.find((f) => cle(f) === cle(choisi)) : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-medium">
        Quel financeur vises-tu ?
      </label>
      <Select
        id={id}
        className="w-full"
        allowClear
        showSearch={{ optionFilterProp: "label" }}
        placeholder="Choisis un financeur (facultatif)"
        value={courant ? cle(courant) : undefined}
        disabled={desactive}
        loading={enCours}
        notFoundContent="Aucun financeur dans le référentiel"
        options={financeurs.map((f) => ({
          value: cle(f),
          label: `${f.organisme}, ${f.libelle}${f.pays ? ` (${pays(f.pays)})` : ""}`,
        }))}
        onChange={(v: string | undefined) => onChoisir(v ? (financeurs.find((f) => cle(f) === v) ?? null) : null)}
      />
      <p className="m-0 mt-1 text-sm text-muted">
        Les règles du financeur servent à vérifier ton apport, la durée et le différé de ton crédit. Sans choix, ces points ne sont pas contrôlés.
      </p>
      {courant && <Resume r={courant} />}
    </div>
  );
}
