"use client";

import { Alert, Button, Collapse, Input, InputNumber } from "antd";
import { useId, useState } from "react";
import type { ResultatFinancement } from "@/moteurs";
import { appeler } from "../appeler";
import { Carte, Feu, Section, fcfa, pourcent, type Teinte } from "../commun";
import { usePlan } from "./PlanContext";

/** Ce que renvoie POST /api/cultiplan/plans/:id/financement (voir ResultatFinancementPlan côté service). */
export interface ReponseFinancement {
  planId: string;
  financement: ResultatFinancement;
  origines: string[];
  manques: string[];
}

const NIVEAU: Record<string, { mot: string; teinte: Teinte }> = {
  bloquant: { mot: "À régler", teinte: "rouge" },
  alerte: { mot: "À surveiller", teinte: "orange" },
  info: { mot: "Pour information", teinte: "gris" },
};

/** Le plan de financement vu par le porteur : ressources contre emplois, apport, contrôles, phrases du moteur. */
export function VuePlanFinancement({ r }: { r: ReponseFinancement }) {
  const f = r.financement;
  const p = f.planInitial;
  return (
    <>
      <Carte className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Feu teinte={p.equilibre ? "vert" : "rouge"} texte={p.equilibre ? "Ça s'équilibre" : p.ecart < 0 ? "Il manque de l'argent" : "Il y a un surplus"} />
          <span className="text-sm text-muted">Au démarrage</span>
        </div>
        {f.lecture.map((l) => (
          <p key={l} className="m-0">
            {l}
          </p>
        ))}
      </Carte>

      <Section id="emplois-ressources" titre="Ce dont tu as besoin, d'où ça vient">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Carte>
            <h3 className="m-0 mb-2 text-base font-semibold">Emplois : ce que tu paies</h3>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {p.emplois.map((e) => (
                <li key={e.libelle} className="flex justify-between gap-3">
                  <span>{e.libelle}</span>
                  <span className="tabular-nums">{fcfa(e.montant)}</span>
                </li>
              ))}
              <li className="mt-1 flex justify-between gap-3 border-t border-border pt-1 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{fcfa(p.totalEmplois)}</span>
              </li>
            </ul>
          </Carte>
          <Carte>
            <h3 className="m-0 mb-2 text-base font-semibold">Ressources : d&apos;où vient l&apos;argent</h3>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
              {p.ressources.map((e) => {
                const part = p.partsRessources.find((x) => x.libelle === e.libelle)?.part;
                return (
                  <li key={e.libelle} className="flex justify-between gap-3">
                    <span>
                      {e.libelle}
                      {part !== undefined && <span className="text-muted"> ({pourcent(part)})</span>}
                    </span>
                    <span className="tabular-nums">{fcfa(e.montant)}</span>
                  </li>
                );
              })}
              <li className="mt-1 flex justify-between gap-3 border-t border-border pt-1 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{fcfa(p.totalRessources)}</span>
              </li>
            </ul>
          </Carte>
        </div>
        <p className="m-0 text-sm">
          Ton apport total : <strong>{fcfa(f.apport.total)}</strong>
          {f.apport.partApport !== null && <> ({pourcent(f.apport.partApport)} du coût du projet)</>}.
          {f.apport.sansPiece.length > 0 && <> Sans pièce justificative, ces apports en nature ne comptent pas : {f.apport.sansPiece.join(", ")}.</>}
        </p>
      </Section>

      {f.controles.length > 0 && (
        <Section id="controles-fin" titre="Ce qu'il faut vérifier">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {f.controles.map((c, i) => (
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

      <Collapse
        items={[
          {
            key: "annuel",
            label: "Le plan de financement année par année",
            children: (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm tabular-nums">
                  <caption className="sr-only">Ressources, emplois et trésorerie par année</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="p-2 text-left font-medium text-muted">Année</th>
                      <th scope="col" className="p-2 text-right font-medium">Argent dégagé</th>
                      <th scope="col" className="p-2 text-right font-medium">Apports et emprunts</th>
                      <th scope="col" className="p-2 text-right font-medium">Crédit remboursé</th>
                      <th scope="col" className="p-2 text-right font-medium">Caisse en fin d&apos;année</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.planAnnuel.map((a) => (
                      <tr key={a.an} className="border-t border-border">
                        <th scope="row" className="p-2 text-left font-medium">{a.an}</th>
                        <td className="p-2 text-right">{a.ressources.caf === null ? "non évalué" : fcfa(a.ressources.caf)}</td>
                        <td className="p-2 text-right">{fcfa(a.ressources.apportsCapital + a.ressources.emprunts)}</td>
                        <td className="p-2 text-right">{fcfa(a.emplois.remboursementEmprunts)}</td>
                        <td className="p-2 text-right">{a.tresorerieFinale === null ? "non évalué" : fcfa(a.tresorerieFinale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            key: "origine",
            label: "D'où viennent ces chiffres",
            children: (
              <div className="text-sm">
                <ul className="m-0 pl-5">
                  {r.origines.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
                {r.manques.length > 0 && (
                  <>
                    <p className="m-0 mt-2 font-medium">Ce qui n&apos;a pas pu être évalué</p>
                    <ul className="m-0 pl-5">
                      {r.manques.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="m-0 mt-2 text-muted">Ce plan de financement est calculé à la demande : il n&apos;est pas encore enregistré avec le plan.</p>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

/** Formulaire : le porteur dit son apport et un prêt éventuel ; Cultiplan monte le plan de financement. */
export function PlanFinancement() {
  const { plan } = usePlan();
  const id = useId();
  const [especes, setEspeces] = useState<number | null>(null);
  const [natureLibelle, setNatureLibelle] = useState("");
  const [natureValeur, setNatureValeur] = useState<number | null>(null);
  const [naturePiece, setNaturePiece] = useState("");
  const [pret, setPret] = useState<number | null>(null);
  const [taux, setTaux] = useState<number | null>(null);
  const [duree, setDuree] = useState<number | null>(null);
  const [differe, setDiffere] = useState<number | null>(0);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reponse, setReponse] = useState<ReponseFinancement | null>(null);

  const pretComplet = pret !== null && pret > 0 && taux !== null && duree !== null && duree > 0;
  const pretPartiel = (pret ?? 0) > 0 || taux !== null || duree !== null;
  const peutCalculer = Boolean(plan.resultats) && (!pretPartiel || pretComplet);

  async function calculer() {
    setEnCours(true);
    setErreur(null);
    try {
      const corps = {
        apportEspeces: especes ?? 0,
        apportsNature: natureLibelle.trim() && natureValeur ? [{ libelle: natureLibelle.trim(), valeur: natureValeur, ...(naturePiece.trim() ? { piece: naturePiece.trim() } : {}) }] : [],
        prets: pretComplet
          ? [{ id: "pret-1", libelle: "Prêt", moisTirage: 0, credit: { montant: pret, tauxAnnuel: (taux ?? 0) / 100, dureeMois: duree, differeMois: differe ?? 0 } }]
          : [],
      };
      setReponse(await appeler<ReponseFinancement>(`/api/cultiplan/plans/${plan.id}/financement`, { method: "POST", body: JSON.stringify(corps) }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Calcul impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const champ = (cle: string, libelle: string, element: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${cle}`} className="font-medium">
        {libelle}
      </label>
      {element}
    </div>
  );

  return (
    <Section id="plan-fin" titre="Ton plan de financement" intro="Dis ce que tu mets et ce que tu empruntes. Cultiplan monte le plan et vérifie qu'il s'équilibre.">
      <Carte>
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (peutCalculer) void calculer();
          }}
        >
          {champ("esp", "Ton apport en argent (FCFA)", <InputNumber id={`${id}-esp`} min={0} className="w-full" value={especes} onChange={setEspeces} />)}
          <div className="hidden md:block" />
          {champ("nl", "Un apport en nature (terre, matériel) : lequel ?", <Input id={`${id}-nl`} value={natureLibelle} onChange={(e) => setNatureLibelle(e.target.value)} />)}
          {champ("nv", "Sa valeur (FCFA)", <InputNumber id={`${id}-nv`} min={0} className="w-full" value={natureValeur} onChange={setNatureValeur} />)}
          {champ("np", "Pièce qui le prouve (titre, bail, facture)", <Input id={`${id}-np`} value={naturePiece} onChange={(e) => setNaturePiece(e.target.value)} />)}
          <div className="hidden md:block" />
          {champ("pm", "Prêt : montant (FCFA)", <InputNumber id={`${id}-pm`} min={0} className="w-full" value={pret} onChange={setPret} />)}
          {champ("pt", "Taux par an (%)", <InputNumber id={`${id}-pt`} min={0} max={100} className="w-full" value={taux} onChange={setTaux} />)}
          {champ("pd", "Durée (mois)", <InputNumber id={`${id}-pd`} min={1} max={360} className="w-full" value={duree} onChange={setDuree} />)}
          {champ("pf", "Différé (mois)", <InputNumber id={`${id}-pf`} min={0} className="w-full" value={differe} onChange={setDiffere} />)}
          <div className="flex flex-col gap-1 md:col-span-2">
            <Button type="primary" htmlType="submit" loading={enCours} disabled={!peutCalculer} className="self-start">
              Monter le plan de financement
            </Button>
            {pretPartiel && !pretComplet && <span className="text-xs text-muted">Pour un prêt, il faut le montant, le taux et la durée.</span>}
            {!plan.resultats && <span className="text-xs text-muted">Calcule d&apos;abord le plan.</span>}
          </div>
        </form>
      </Carte>
      {erreur && <Alert type="error" showIcon title={erreur} closable onClose={() => setErreur(null)} />}
      {reponse && <VuePlanFinancement r={reponse} />}
    </Section>
  );
}
