"use client";

import { Alert, Button, Collapse, Input, InputNumber, Select } from "antd";
import { useEffect, useId, useState } from "react";
import type { Chiffre, ResultatDimensionnement, TailleProposee } from "@/modules/cultiplan";
import type { EcartBesoin } from "@/modules/cultiplan/besoins";
import type { Speculation } from "@/referentiel";
import { appeler } from "../appeler";
import { Carte, Feu, Section, fcfa, nb, type Teinte } from "../commun";

const FEU_ECART: Record<EcartBesoin["feu"], Teinte> = { vert: "vert", orange: "orange", rouge: "rouge", non_evalue: "gris" };
const NIVEAU: Record<string, string> = { bloquant: "À régler", alerte: "À surveiller", info: "Pour information", ok: "Rien à signaler" };
const ORIGINES = [
  { value: "marche", label: "Le marché (je connais les ventes possibles)" },
  { value: "contrat", label: "Un contrat avec un acheteur" },
  { value: "promesse_achat", label: "Une promesse d'achat" },
  { value: "enquete", label: "Mon enquête de terrain" },
];

const valeurChiffre = (c: Chiffre, formater: (v: number) => string = nb): string => (c.valeur === null ? "non évalué" : `${formater(c.valeur)} ${c.unite && formater === nb ? c.unite : ""}`.trim());

function LigneChiffre({ nom, c, formater }: { nom: string; c: Chiffre; formater?: (v: number) => string }) {
  return (
    <>
      <dt className="text-muted">{nom}</dt>
      <dd className="m-0 text-right tabular-nums">
        {valeurChiffre(c, formater)}
        <span className="block text-xs text-muted">Origine : {c.origine}</span>
      </dd>
    </>
  );
}

function ColonneTaille({ t }: { t: TailleProposee }) {
  const d = t.detail;
  return (
    <Carte className="flex flex-col gap-3">
      <div>
        <h3 className="m-0 text-base font-semibold">{t.titre}</h3>
        <p className="m-0 mt-1 text-2xl font-bold tabular-nums">{t.taille === null ? (t.statut === "impossible" ? "Pas possible" : "Non évaluée") : `${nb(t.taille)} ${t.uniteEchelle}`}</p>
      </div>
      <p className="m-0 text-sm">{t.phrase}</p>
      {d && (
        <>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
            <LigneChiffre nom="Ce que tu vends par an" c={d.volumeVendableAn} />
            <LigneChiffre nom="Surface à prévoir" c={d.surfaceAPrevoirHa} />
            <LigneChiffre nom="Jours de travail par an" c={d.joursTravailAn} />
            <LigneChiffre nom="Investissement" c={d.investissement} formater={fcfa} />
            <LigneChiffre nom="Gain d'exploitation par an" c={d.margeExploitationAn} formater={fcfa} />
          </dl>
          {d.depasseLeDebouche && <p className="m-0 text-sm font-medium">Cette taille dépasse ce que ton débouché absorbe.</p>}
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: "ecarts",
                label: "Ce que tu as, ce qu'il faut",
                children: (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                    {d.ecarts.map((e) => (
                      <li key={e.code} className="flex flex-col gap-1">
                        <Feu teinte={FEU_ECART[e.feu]} />
                        <span>{e.phrase}</span>
                        {(e.besoin || e.disponible) && (
                          <span className="text-xs text-muted">
                            {e.besoin ? `Besoin : ${e.besoin}. ` : ""}
                            {e.disponible ? `Tu as : ${e.disponible}.` : ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ),
              },
              {
                key: "finances",
                label: "Argent et famille",
                children: (
                  <div className="text-sm">
                    <p className="m-0">
                      Verdict : <strong>{d.finances.statut}</strong>.{" "}
                      {d.finances.menageCouvert === null ? "Famille non renseignée." : d.finances.menageCouvert ? "Les dépenses de la famille sont couvertes." : "Les dépenses de la famille ne sont pas couvertes."}
                    </p>
                    <p className="m-0 mt-1">Mois le plus difficile : {fcfa(d.finances.pointBasTresorerie)}.</p>
                    {d.finances.controles.length > 0 && (
                      <ul className="m-0 mt-2 pl-5">
                        {d.finances.controles.map((c) => (
                          <li key={c.code}>
                            <strong>{NIVEAU[c.niveau] ?? c.niveau} :</strong> {c.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
    </Carte>
  );
}

export function VueProposition({ resultat }: { resultat: ResultatDimensionnement }) {
  return (
    <>
      {resultat.donneesNonValidees && (
        <Alert type="info" showIcon title="Une partie des chiffres de référence est encore un brouillon, en attente d'un expert. Les tailles sont des repères." />
      )}
      <Section id="tailles" titre="Trois tailles possibles" intro={`Pour ${resultat.speculation}, scénario ${resultat.scenario}. Compare, puis choisis.`}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {resultat.tailles.map((t) => (
            <ColonneTaille key={t.cle} t={t} />
          ))}
        </div>
      </Section>
      <Section id="plafonds" titre="Ce que ton existant permet" intro="La taille maximale que chaque dimension autorise.">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {resultat.plafonds.map((p) => (
            <li key={p.dimension} className="rounded-card border border-border bg-surface p-3 text-sm">
              <strong>{p.statut === "non_evalue" ? "Non évalué" : p.statut === "non_limitant" ? "Pas limitant" : p.tailleMax === null ? "" : `Jusqu'à ${nb(p.tailleMax)} ${resultat.uniteEchelle}`}</strong> : {p.phrase}
            </li>
          ))}
        </ul>
      </Section>
      {resultat.manques.length > 0 && (
        <Section id="manques" titre="Ce qui manque pour évaluer plus">
          <ul className="m-0 pl-5 text-sm">
            {resultat.manques.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

interface Props {
  exploitationId: string;
}

/** Proposition : le porteur dit ce qu'il sait (quoi, combien il peut vendre, d'où il le tient) ; Cultiplan propose les tailles. */
export function PropositionProjet({ exploitationId }: Props) {
  const idSpec = useId();
  const [catalogue, setCatalogue] = useState<Speculation[]>([]);
  const [speculation, setSpeculation] = useState<string | undefined>();
  const [volume, setVolume] = useState<number | null>(null);
  const [mois, setMois] = useState<number | null>(12);
  const [unite, setUnite] = useState("");
  const [origine, setOrigine] = useState<string>("marche");
  const [source, setSource] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatDimensionnement | null>(null);

  useEffect(() => {
    let annule = false;
    appeler<Speculation[]>("/api/cultiplan/speculations")
      .then((s) => !annule && setCatalogue(s))
      .catch((e: unknown) => !annule && setErreur(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      annule = true;
    };
  }, []);

  const complet = Boolean(speculation && volume && volume > 0 && mois && unite.trim() && source.trim().length >= 2);

  async function proposer() {
    setEnCours(true);
    setErreur(null);
    try {
      const corps = { speculation, debouche: { volumeParMois: volume, moisParAn: mois, unite: unite.trim(), origine, source: source.trim() } };
      setResultat(await appeler<ResultatDimensionnement>(`/api/cultiplan/exploitations/${exploitationId}/dimensionnement`, { method: "POST", body: JSON.stringify(corps) }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Calcul impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="m-0 font-title text-2xl font-bold">Ta proposition de projet</h1>
        <p className="m-0 mt-1 text-sm text-muted">Dis ce que tu veux produire et ce que tu peux vendre. Cultiplan propose trois tailles, tu choisis.</p>
      </header>

      <Carte>
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (complet) void proposer();
          }}
        >
          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor={idSpec} className="font-medium">
              Que veux-tu produire ?
            </label>
            <Select
              id={idSpec}
              showSearch={{ optionFilterProp: "label" }}
              placeholder="Choisis une production"
              value={speculation}
              onChange={setSpeculation}
              options={catalogue.map((s) => ({ value: s.code, label: s.nom }))}
              notFoundContent="Aucune production dans le référentiel"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idSpec}-v`} className="font-medium">
              Combien peux-tu vendre par mois ?
            </label>
            <InputNumber id={`${idSpec}-v`} min={0} className="w-full" value={volume} onChange={setVolume} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idSpec}-u`} className="font-medium">
              En quelle unité ? (kg, tonne, oeuf, tête)
            </label>
            <Input id={`${idSpec}-u`} value={unite} onChange={(e) => setUnite(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idSpec}-m`} className="font-medium">
              Pendant combien de mois par an ?
            </label>
            <InputNumber id={`${idSpec}-m`} min={1} max={12} className="w-full" value={mois} onChange={setMois} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idSpec}-o`} className="font-medium">
              D&apos;où le sais-tu ?
            </label>
            <Select id={`${idSpec}-o`} value={origine} onChange={setOrigine} options={ORIGINES} />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor={`${idSpec}-s`} className="font-medium">
              Explique en quelques mots (nom de l&apos;acheteur, marché, date)
            </label>
            <Input id={`${idSpec}-s`} value={source} onChange={(e) => setSource(e.target.value)} />
            <span className="text-xs text-muted">Cultiplan ne devine jamais ce que tu peux vendre : cette phrase est gardée comme origine du chiffre.</span>
          </div>
          <div className="md:col-span-2">
            <Button type="primary" htmlType="submit" loading={enCours} disabled={!complet}>
              Proposer des tailles
            </Button>
          </div>
        </form>
      </Carte>

      {erreur && <Alert type="error" showIcon title={erreur} closable onClose={() => setErreur(null)} />}
      {resultat && <VueProposition resultat={resultat} />}
    </div>
  );
}
