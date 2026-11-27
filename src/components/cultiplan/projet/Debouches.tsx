"use client";

import { Alert, Button, Input, InputNumber, Select } from "antd";
import { useEffect, useId, useState } from "react";
import type { CircuitCommercialisation } from "@/referentiel/debouches";
import type { ResultatDebouches } from "@/modules/cultiplan/debouches";
import { appeler } from "../appeler";
import { Carte, Feu, Section, fcfa, nb, pourcent, type Teinte } from "../commun";

export interface ReponseDebouches {
  exploitationId: string;
  debouches: ResultatDebouches;
}

const NIVEAU: Record<string, { mot: string; teinte: Teinte }> = {
  bloquant: { mot: "À régler", teinte: "rouge" },
  alerte: { mot: "À surveiller", teinte: "orange" },
  info: { mot: "Pour information", teinte: "gris" },
};

/** Débouchés : où part ta production, à quel prix, et ce qui reste sans acheteur. */
export function VueDebouches({ r }: { r: ResultatDebouches }) {
  const nonVendu = r.volumeNonVendu > 0;
  return (
    <>
      <Carte className="flex flex-col gap-2">
        <Feu teinte={r.controles.some((c) => c.niveau === "bloquant") ? "rouge" : nonVendu || r.controles.some((c) => c.niveau === "alerte") ? "orange" : "vert"} texte={nonVendu ? "Une part n'a pas d'acheteur" : "Tout a un acheteur"} />
        {r.lecture.map((l) => (
          <p key={l} className="m-0">
            {l}
          </p>
        ))}
      </Carte>

      <Section id="circuits" titre="Par où ça part" intro={`${r.produit}, en ${r.unite}.`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm tabular-nums">
            <caption className="sr-only">Volume, prix et recettes par circuit de vente</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left font-medium text-muted">Circuit</th>
                <th scope="col" className="p-2 text-right font-medium">Part</th>
                <th scope="col" className="p-2 text-right font-medium">Volume</th>
                <th scope="col" className="p-2 text-right font-medium">Prix moyen</th>
                <th scope="col" className="p-2 text-right font-medium">Recettes</th>
              </tr>
            </thead>
            <tbody>
              {r.circuits.map((c, i) => (
                <tr key={`${c.circuit}-${i}`} className="border-t border-border">
                  <th scope="row" className="p-2 text-left font-medium">
                    {c.libelle}
                    {c.client ? <span className="block text-xs font-normal text-muted">{c.client}</span> : null}
                    {c.sourcePrix ? <span className="block text-xs font-normal text-muted">Prix : {c.sourcePrix}</span> : null}
                  </th>
                  <td className="p-2 text-right">{pourcent(c.part)}</td>
                  <td className="p-2 text-right">{nb(c.volume)}</td>
                  <td className="p-2 text-right">{fcfa(c.prixMoyen)}</td>
                  <td className="p-2 text-right">{fcfa(c.recettes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Carte>
            <p className="m-0 text-sm text-muted">Recettes de l&apos;année</p>
            <p className="m-0 mt-1 text-2xl font-bold tabular-nums">{fcfa(r.recettesAn)}</p>
          </Carte>
          <Carte>
            <p className="m-0 text-sm text-muted">Volume vendu</p>
            <p className="m-0 mt-1 text-2xl font-bold tabular-nums">{nb(r.volumeVendu)}</p>
          </Carte>
          <Carte>
            <p className="m-0 text-sm text-muted">Sans acheteur</p>
            <p className="m-0 mt-1 text-2xl font-bold tabular-nums">{nb(r.volumeNonVendu)}</p>
            <p className="m-0 text-sm">{pourcent(r.partNonVendue)} de ta production : aucune recette comptée.</p>
          </Carte>
        </div>
      </Section>

      {r.contrats.length > 0 && (
        <Section id="contrats" titre="Tes contrats">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {r.contrats.map((c) => (
              <li key={`${c.circuit}-${c.acheteur}`} className="rounded-card border border-border bg-surface p-3 text-sm">
                <strong>{c.acheteur}</strong> : {nb(c.volumeFixe)} à {fcfa(c.prixFixe)}. Tu reçois en net {fcfa(c.paiementNetParUnite)} par unité, soit {fcfa(c.paiementNetAn)} par an.
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.controles.length > 0 && (
        <Section id="controles-deb" titre="Ce qu'il faut vérifier">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {r.controles.map((c, i) => (
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
    </>
  );
}

interface LigneCircuit {
  circuit: string | undefined;
  partPourcent: number | null;
  prix: number | null;
  client: string;
  sourcePrix: string;
}
const vide = (): LigneCircuit => ({ circuit: undefined, partPourcent: null, prix: null, client: "", sourcePrix: "" });

/** Le porteur dit à qui il pense vendre, quelle part et à quel prix. Les contrats se saisissent plus tard. */
export function Debouches({ exploitationId }: { exploitationId: string }) {
  const id = useId();
  const [circuitsRef, setCircuitsRef] = useState<CircuitCommercialisation[]>([]);
  const [produit, setProduit] = useState("");
  const [unite, setUnite] = useState("");
  const [volumes, setVolumes] = useState<{ pessimiste: number | null; realiste: number | null; optimiste: number | null }>({ pessimiste: null, realiste: null, optimiste: null });
  const [lignes, setLignes] = useState<LigneCircuit[]>([vide()]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reponse, setReponse] = useState<ReponseDebouches | null>(null);

  useEffect(() => {
    let annule = false;
    appeler<{ circuits: CircuitCommercialisation[] }>("/api/cultiplan/circuits")
      .then((c) => !annule && setCircuitsRef(c.circuits))
      .catch((e: unknown) => !annule && setErreur(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      annule = true;
    };
  }, []);

  const maj = (i: number, p: Partial<LigneCircuit>) => setLignes((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const complet =
    produit.trim() !== "" &&
    unite.trim() !== "" &&
    volumes.pessimiste !== null &&
    volumes.realiste !== null &&
    volumes.optimiste !== null &&
    lignes.every((l) => l.circuit && l.partPourcent !== null && l.prix !== null && l.sourcePrix.trim().length >= 2);

  async function calculer() {
    setEnCours(true);
    setErreur(null);
    try {
      const corps = {
        produit: produit.trim(),
        unite: unite.trim(),
        volumeAn: volumes,
        circuits: lignes.map((l) => ({
          circuit: l.circuit,
          part: (l.partPourcent ?? 0) / 100,
          prix: l.prix,
          sourcePrix: l.sourcePrix.trim(),
          ...(l.client.trim() ? { client: l.client.trim() } : {}),
        })),
      };
      setReponse(await appeler<ReponseDebouches>(`/api/cultiplan/exploitations/${exploitationId}/debouches`, { method: "POST", body: JSON.stringify(corps) }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Calcul impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="m-0 font-title text-2xl font-bold">Tes débouchés</h1>
        <p className="m-0 mt-1 text-sm text-muted">À qui vas-tu vendre, quelle part, à quel prix ? Cultiplan ne devine jamais un prix : dis d&apos;où il vient.</p>
      </header>
      <Carte>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (complet) void calculer();
          }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-p`} className="font-medium">Quel produit ?</label>
              <Input id={`${id}-p`} value={produit} onChange={(e) => setProduit(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-u`} className="font-medium">En quelle unité ? (kg, tonne, oeuf)</label>
              <Input id={`${id}-u`} value={unite} onChange={(e) => setUnite(e.target.value)} />
            </div>
          </div>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 font-medium">Combien peux-tu vendre par an ?</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["pessimiste", "realiste", "optimiste"] as const).map((k) => (
                <div key={k} className="flex flex-col gap-1">
                  <label htmlFor={`${id}-v-${k}`} className="text-sm text-muted">
                    {k === "pessimiste" ? "Mauvaise année" : k === "realiste" ? "Année normale" : "Bonne année"}
                  </label>
                  <InputNumber id={`${id}-v-${k}`} min={0} className="w-full" value={volumes[k]} onChange={(v) => setVolumes((x) => ({ ...x, [k]: v }))} />
                </div>
              ))}
            </div>
          </fieldset>
          {lignes.map((l, i) => (
            <fieldset key={i} className="m-0 grid grid-cols-1 gap-3 rounded-card border border-border p-3 md:grid-cols-2">
              <legend className="px-1 font-medium">Circuit {i + 1}</legend>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-c-${i}`} className="text-sm">Où vends-tu ?</label>
                <Select id={`${id}-c-${i}`} placeholder="Choisis un circuit" value={l.circuit} onChange={(v) => maj(i, { circuit: v })} options={circuitsRef.map((c) => ({ value: c.code, label: c.libelle }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-cn-${i}`} className="text-sm">Nom de l&apos;acheteur (facultatif)</label>
                <Input id={`${id}-cn-${i}`} value={l.client} onChange={(e) => maj(i, { client: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-cp-${i}`} className="text-sm">Part de ta production (%)</label>
                <InputNumber id={`${id}-cp-${i}`} min={0} max={100} className="w-full" value={l.partPourcent} onChange={(v) => maj(i, { partPourcent: v })} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-cx-${i}`} className="text-sm">Prix par unité (FCFA)</label>
                <InputNumber id={`${id}-cx-${i}`} min={0} className="w-full" value={l.prix} onChange={(v) => maj(i, { prix: v })} />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label htmlFor={`${id}-cs-${i}`} className="text-sm">D&apos;où vient ce prix ? (marché, date, acheteur)</label>
                <Input id={`${id}-cs-${i}`} value={l.sourcePrix} onChange={(e) => maj(i, { sourcePrix: e.target.value })} />
              </div>
              {lignes.length > 1 && (
                <div className="md:col-span-2">
                  <Button onClick={() => setLignes((x) => x.filter((_, j) => j !== i))}>Retirer ce circuit</Button>
                </div>
              )}
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setLignes((l) => [...l, vide()])} disabled={lignes.length >= 6}>
              Ajouter un circuit
            </Button>
            <Button type="primary" htmlType="submit" loading={enCours} disabled={!complet}>
              Analyser les débouchés
            </Button>
          </div>
        </form>
      </Carte>
      {erreur && <Alert type="error" showIcon title={erreur} closable onClose={() => setErreur(null)} />}
      {reponse && <VueDebouches r={reponse.debouches} />}
    </div>
  );
}
