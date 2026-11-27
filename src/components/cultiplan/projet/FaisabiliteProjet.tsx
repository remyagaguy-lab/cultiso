"use client";

import { Alert, Skeleton } from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";
import { appeler } from "../appeler";
import { PointFaisabilite } from "../consultation/PointFaisabilite";
import type { VueConsultation } from "../consultation/ConsultationPorteur";
import { Carte, Section } from "../commun";

/** Faisabilité : un feu par dimension, une phrase, et ce qu'il faut faire. Aucun chiffre d'argent ici : ils viennent du plan. */
export function VueFaisabilite({ vue, exploitationId }: { vue: VueConsultation; exploitationId: string }) {
  const essentiels = vue.manques.filter((m) => m.question.essentielle);
  const hrefConsultation = `/cultiplan/projets/${exploitationId}/consultation`;
  return (
    <>
      <PointFaisabilite point={vue.point} hrefConsultation={hrefConsultation} />
      <Section id="reste" titre="Ce qu'il reste à dire">
        {essentiels.length === 0 ? (
          <p className="m-0 text-sm">Tu as répondu à toutes les questions essentielles.</p>
        ) : (
          <Carte>
            <ul className="m-0 pl-5 text-sm">
              {essentiels.map((m) => (
                <li key={m.question.cle}>
                  {m.question.court} {m.etat === "inconnue" ? "(tu as répondu « je ne sais pas »)" : ""}
                </li>
              ))}
            </ul>
          </Carte>
        )}
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href={hrefConsultation}>Reprendre la consultation</Link>
          <Link href={`/cultiplan/projets/${exploitationId}/proposition`}>Passer à la proposition de taille</Link>
        </div>
      </Section>
    </>
  );
}

export function FaisabiliteProjet({ exploitationId }: { exploitationId: string }) {
  const [vue, setVue] = useState<VueConsultation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    let annule = false;
    appeler<VueConsultation>(`/api/cultiplan/exploitations/${exploitationId}/entretien`)
      .then((v) => !annule && setVue(v))
      .catch((e: unknown) => !annule && setErreur(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      annule = true;
    };
  }, [exploitationId]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="m-0 font-title text-2xl font-bold">Le point sur ta faisabilité</h1>
        <p className="m-0 mt-1 text-sm text-muted">Terre, eau, travail, argent, marché, savoir-faire, règles : où tu en es, dimension par dimension.</p>
      </header>
      {erreur && <Alert type="error" showIcon title={erreur} />}
      {!vue && !erreur && <Skeleton active paragraph={{ rows: 6 }} aria-label="Chargement de ta faisabilité" />}
      {vue && <VueFaisabilite vue={vue} exploitationId={exploitationId} />}
    </div>
  );
}
