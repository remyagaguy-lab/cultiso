"use client";

import { Alert, Button, Collapse, Input, InputNumber } from "antd";
import { useId, useState } from "react";
import type { ResultatMainOeuvre } from "@/moteurs";
import { appeler } from "../appeler";
import { Carte, Feu, Section, fcfa, nb, pourcent, type Teinte } from "../commun";

export interface ReponseMainOeuvre {
  exploitationId: string;
  mainOeuvre: ResultatMainOeuvre;
  origines: string[];
}

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const NIVEAU: Record<string, { mot: string; teinte: Teinte }> = {
  bloquant: { mot: "À régler", teinte: "rouge" },
  alerte: { mot: "À surveiller", teinte: "orange" },
  info: { mot: "Pour information", teinte: "gris" },
};

/** Main d'oeuvre : où le travail dépasse les bras disponibles, et ce que vaut le travail de la famille. */
export function VueMainOeuvre({ r }: { r: ReponseMainOeuvre }) {
  const m = r.mainOeuvre;
  const pointe = m.pointes.length > 0;
  return (
    <>
      <Carte className="flex flex-col gap-2">
        <Feu teinte={pointe ? "orange" : "vert"} texte={pointe ? `${m.pointes.length} mois en pointe` : "Les bras suffisent"} />
        {m.lecture.map((l) => (
          <p key={l} className="m-0">
            {l}
          </p>
        ))}
      </Carte>

      <Section id="pointes" titre="Le travail, mois par mois" intro="Heures nécessaires contre heures disponibles.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm tabular-nums">
            <caption className="sr-only">Besoin et capacité de travail par mois</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left font-medium text-muted">Mois</th>
                <th scope="col" className="p-2 text-right font-medium">Besoin</th>
                <th scope="col" className="p-2 text-right font-medium">Disponible</th>
                <th scope="col" className="p-2 text-right font-medium">Il manque</th>
              </tr>
            </thead>
            <tbody>
              {m.mois.map((x) => (
                <tr key={x.mois} className="border-t border-border">
                  <th scope="row" className="p-2 text-left font-medium">{MOIS[x.mois - 1] ?? x.mois}</th>
                  <td className="p-2 text-right">{nb(x.besoinHeures)} h</td>
                  <td className="p-2 text-right">{nb(x.capaciteTotaleHeures)} h</td>
                  <td className="p-2 text-right font-semibold">{x.heuresManquantes > 0 ? `${nb(x.heuresManquantes)} h${x.joursManquants !== null ? ` (${nb(x.joursManquants)} j)` : ""}` : "rien"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pointe && (
          <ul className="m-0 pl-5 text-sm">
            {m.pointes.map((p) => (
              <li key={p.mois}>
                {MOIS[p.mois - 1]} : {nb(p.heuresManquantes)} heures de trop{p.tachePrincipale ? `, surtout pour « ${p.tachePrincipale} »` : ""}.
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="norme" titre="La surface que ta famille peut conduire">
        <Carte className="text-sm">
          {m.norme.statut === "non_evalue" ? (
            <p className="m-0">Non évalué : il manque la surface ou la norme par actif, avec sa source.</p>
          ) : (
            <p className="m-0">
              {nb(m.norme.actifs ?? 0)} actif(s) peuvent conduire jusqu&apos;à <strong>{nb(m.norme.surfaceMaxHa ?? 0)} ha</strong>. Tu en prévois {nb(m.norme.surfaceHa ?? 0)} ha
              {m.norme.ratio !== null && <> ({pourcent(m.norme.ratio)} de ce maximum)</>}. Source : {m.norme.source ?? "non donnée"}.
            </p>
          )}
        </Carte>
      </Section>

      <Section id="famille" titre="Ce que vaut le travail de ta famille" intro="Cette valeur ne sort pas de ta caisse : elle sert à calculer ton vrai coût de revient.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Carte>
            <p className="m-0 text-sm text-muted">Travail de la famille</p>
            <p className="m-0 my-1 text-2xl font-bold tabular-nums">{m.valorisationFamille.montantAn === null ? "Non évalué" : fcfa(m.valorisationFamille.montantAn)}</p>
            <p className="m-0 text-sm">
              {nb(m.valorisationFamille.heures)} heures{m.valorisationFamille.prixHeure !== null ? ` à ${fcfa(m.valorisationFamille.prixHeure)} l'heure` : ", prix de l'heure non donné"}.
            </p>
          </Carte>
          <Carte>
            <p className="m-0 text-sm text-muted">Coût de revient par unité vendue</p>
            <p className="m-0 my-1 text-2xl font-bold tabular-nums">{m.coutRevient.parUniteVendue === null ? "Non évalué" : fcfa(m.coutRevient.parUniteVendue)}</p>
            <p className="m-0 text-sm">{m.coutRevient.parUniteVendueSansFamille === null ? "Sans le travail de la famille : non évalué." : `Sans le travail de la famille : ${fcfa(m.coutRevient.parUniteVendueSansFamille)}.`}</p>
          </Carte>
        </div>
      </Section>

      {m.controles.length > 0 && (
        <Section id="controles-mo" titre="Ce qu'il faut vérifier">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {m.controles.map((c, i) => (
              <li key={`${c.code}-${i}`} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3 text-sm">
                <div>
                  <Feu teinte={(NIVEAU[c.niveau] ?? NIVEAU.info).teinte} texte={(NIVEAU[c.niveau] ?? NIVEAU.info).mot} />
                </div>
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.origines.length > 0 && (
        <Collapse items={[{ key: "o", label: "D'où viennent ces chiffres", children: <ul className="m-0 pl-5 text-sm">{r.origines.map((o) => <li key={o}>{o}</li>)}</ul> }]} />
      )}
    </>
  );
}

/** Le porteur donne les heures de travail du projet mois par mois ; la famille vient de son profil. */
export function MainOeuvre({ exploitationId }: { exploitationId: string }) {
  const id = useId();
  const [heures, setHeures] = useState<(number | null)[]>(() => Array<number | null>(12).fill(null));
  const [surface, setSurface] = useState<number | null>(null);
  const [prixHeure, setPrixHeure] = useState<number | null>(null);
  const [sourcePrix, setSourcePrix] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reponse, setReponse] = useState<ReponseMainOeuvre | null>(null);

  const complet = heures.every((h) => h !== null);
  const prixOk = prixHeure === null || sourcePrix.trim().length >= 2;

  async function calculer() {
    setEnCours(true);
    setErreur(null);
    try {
      const corps = {
        besoinsHeuresParMois: heures.map((h) => h ?? 0),
        ...(surface ? { surfaceHa: surface } : {}),
        ...(prixHeure !== null ? { prixHeure: { valeur: prixHeure, source: sourcePrix.trim() } } : {}),
      };
      setReponse(await appeler<ReponseMainOeuvre>(`/api/cultiplan/exploitations/${exploitationId}/main-oeuvre`, { method: "POST", body: JSON.stringify(corps) }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Calcul impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="m-0 font-title text-2xl font-bold">Le travail de ton projet</h1>
        <p className="m-0 mt-1 text-sm text-muted">Dis combien d&apos;heures de travail demande chaque mois. Cultiplan compare à ce que ta famille peut faire (d&apos;après ton profil). Le calendrier de travail remplacera cette saisie.</p>
      </header>
      <Carte>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (complet && prixOk) void calculer();
          }}
        >
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 font-medium">Heures de travail nécessaires, par mois</legend>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {MOIS.map((nom, i) => (
                <div key={nom} className="flex flex-col gap-1">
                  <label htmlFor={`${id}-${i}`} className="text-sm text-muted">
                    {nom}
                  </label>
                  <InputNumber id={`${id}-${i}`} min={0} className="w-full" value={heures[i]} onChange={(v) => setHeures((h) => h.map((x, j) => (j === i ? v : x)))} />
                </div>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-s`} className="font-medium">Surface cultivée (ha, facultatif)</label>
              <InputNumber id={`${id}-s`} min={0} className="w-full" value={surface} onChange={setSurface} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-p`} className="font-medium">Prix d&apos;une heure de travail (FCFA, facultatif)</label>
              <InputNumber id={`${id}-p`} min={0} className="w-full" value={prixHeure} onChange={setPrixHeure} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-sp`} className="font-medium">D&apos;où vient ce prix ?</label>
              <Input id={`${id}-sp`} value={sourcePrix} onChange={(e) => setSourcePrix(e.target.value)} />
            </div>
          </div>
          <div>
            <Button type="primary" htmlType="submit" loading={enCours} disabled={!complet || !prixOk}>
              Évaluer le travail
            </Button>
            {!complet && <span className="ml-3 text-xs text-muted">Remplis les douze mois (0 si rien).</span>}
          </div>
        </form>
      </Carte>
      {erreur && <Alert type="error" showIcon title={erreur} closable onClose={() => setErreur(null)} />}
      {reponse && <VueMainOeuvre r={reponse} />}
    </div>
  );
}
