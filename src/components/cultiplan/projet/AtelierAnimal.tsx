"use client";

import { Alert, Button, Collapse, InputNumber, Select } from "antd";
import { useEffect, useId, useState } from "react";
import type { ResultatAtelierAnimal } from "@/modules/cultiplan";
import type { Speculation } from "@/referentiel";
import { appeler } from "../appeler";
import { Carte, Feu, Origine, Section, fcfa, nb } from "../commun";
import { IndicateurExplique } from "../IndicateurExplique";
import { CourbeTresorerie } from "../plan/MenagePlan";

export function VueAtelier({ r }: { r: ResultatAtelierAnimal }) {
  if (r.statut === "non_evaluee" || !r.resultat) {
    return (
      <Section id="non-evalue" titre="Cet atelier n'est pas encore évalué">
        <Alert type="info" showIcon title="Cultiso ne devine ni courbe, ni durée de bande. Voici ce qui manque." />
        <ul className="m-0 pl-5 text-sm">
          {r.manques.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        {r.variantesConnues.length > 0 && <p className="m-0 text-sm text-muted">Variantes connues : {r.variantesConnues.join(", ")}.</p>}
      </Section>
    );
  }
  const x = r.resultat;
  const cout = x.coutAnimalPretAProduire;
  const seuil = x.seuilTechnique;
  const moisCourbe = x.mois.map((m) => ({ mois: m.mois, cumul: m.cumul }));
  return (
    <>
      <Carte className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Feu teinte={x.apportSuffisant ? "vert" : "rouge"} texte={x.apportSuffisant ? "Ton apport suffit" : "Il manque de l'argent"} />
          <span className="text-sm text-muted">{r.variante ?? "Courbes du référentiel"}</span>
        </div>
        {x.lecture.map((p) => (
          <p key={p} className="m-0">
            {p}
          </p>
        ))}
      </Carte>

      <Section id="chiffres" titre="Les chiffres à retenir">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <IndicateurExplique cle="pointBasTresorerie" valeur={`${fcfa(x.pointBasTresorerie.montant)} (mois ${x.pointBasTresorerie.mois})`} />
          <Carte>
            <p className="m-0 text-sm text-muted">Argent à trouver pour aller au bout</p>
            <p className="m-0 my-1 text-2xl font-bold tabular-nums">{fcfa(x.besoinFinancement)}</p>
            <p className="m-0 text-sm">Le point le plus bas de la caisse, sans ton apport.</p>
          </Carte>
          {cout && (
            <Carte>
              <p className="m-0 text-sm text-muted">Coût d&apos;un animal prêt à produire</p>
              <p className="m-0 my-1 text-2xl font-bold tabular-nums">{fcfa(cout.parSujetPretAProduire)}</p>
              <p className="m-0 text-sm">
                Achat, aliment et charges pendant {cout.moisImproductifs} mois avant la première production.
              </p>
            </Carte>
          )}
        </div>
      </Section>

      <Section id="caisse" titre="La caisse de l'atelier">
        <Carte>
          <CourbeTresorerie mois={moisCourbe} pointBas={x.pointBasTresorerie} />
        </Carte>
      </Section>

      <Section id="seuil" titre="Ce qu'il faut produire pour ne pas perdre">
        <Carte>
          {seuil.seuilMoyen === null ? (
            <p className="m-0 text-sm">Sans prix du produit, le seuil n&apos;est pas calculable.</p>
          ) : (
            <p className="m-0 text-sm">
              Il faut au moins <strong>{nb(seuil.seuilMoyen)}</strong> par sujet et par jour. Les courbes en prévoient <strong>{nb(seuil.prevuMoyen)}</strong>
              {seuil.seuilAtteint === null ? "." : seuil.seuilAtteint ? " : la marge est positive." : " : les charges ne sont pas couvertes."}
            </p>
          )}
        </Carte>
      </Section>

      <Section id="renouvellement" titre="Pour la bande suivante">
        <Carte className="text-sm">
          <p className="m-0">
            {x.renouvellement.autofinance
              ? `L'atelier finance la bande suivante lui-même (${fcfa(x.renouvellement.besoinRedemarrage)} à avancer). Tu peux retirer ${fcfa(x.renouvellement.retraitPossible)} au total, soit ${fcfa(x.renouvellement.retraitPossibleParMois)} par mois.`
              : `L'atelier ne finance pas la bande suivante : il faut avancer ${fcfa(x.renouvellement.besoinRedemarrage)}.`}
          </p>
        </Carte>
      </Section>

      <Collapse
        items={[
          {
            key: "origine",
            label: "D'où viennent ces chiffres",
            children: r.origine ? (
              <div className="text-sm">
                <p className="m-0">Courbes : {r.origine.sources.join(", ") || "référentiel Cultiso"}. Statut : {r.origine.statut}.</p>
                <p className="m-0">Durée de la bande : {r.origine.dureeBandeMois ?? "non donnée"}. Jours par mois : {r.origine.joursParMois ?? "non donné"}.</p>
                <Origine>{r.origine.prix}</Origine>
                {r.donneesNonValidees && <p className="m-0 mt-2">Ces données sont encore des brouillons à valider par un expert.</p>}
              </div>
            ) : null,
          },
          {
            key: "mois",
            label: "Le détail mois par mois",
            children: (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm tabular-nums">
                  <caption className="sr-only">Effectifs, production et caisse par mois</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="p-2 text-left font-medium text-muted">Mois</th>
                      <th scope="col" className="p-2 text-right font-medium">Animaux</th>
                      <th scope="col" className="p-2 text-right font-medium">Production</th>
                      <th scope="col" className="p-2 text-right font-medium">Entrées</th>
                      <th scope="col" className="p-2 text-right font-medium">Sorties</th>
                      <th scope="col" className="p-2 text-right font-medium">Caisse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {x.mois.map((m) => (
                      <tr key={m.mois} className="border-t border-border">
                        <th scope="row" className="p-2 text-left font-medium">{m.mois}</th>
                        <td className="p-2 text-right">{nb(m.effectifDebut)}</td>
                        <td className="p-2 text-right">{nb(m.production)}</td>
                        <td className="p-2 text-right">{fcfa(m.entrees)}</td>
                        <td className="p-2 text-right">{fcfa(m.sorties)}</td>
                        <td className="p-2 text-right">{fcfa(m.cumul)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

const CHAMPS_PRIX = [
  { cle: "animal", libelle: "Prix d'un poussin ou d'un jeune (FCFA)" },
  { cle: "aliment", libelle: "Prix du kilo d'aliment (FCFA)" },
  { cle: "produit", libelle: "Prix de vente d'un oeuf ou d'une unité produite (FCFA)" },
  { cle: "reforme", libelle: "Prix d'un animal vendu à la réforme (FCFA)" },
] as const;

/** Atelier animal à bandes : le porteur dit combien d'animaux et à quels prix ; Cultiplan applique les courbes du référentiel. */
export function AtelierAnimal() {
  const id = useId();
  const [catalogue, setCatalogue] = useState<Speculation[]>([]);
  const [speculation, setSpeculation] = useState<string | undefined>();
  const [effectif, setEffectif] = useState<number | null>(null);
  const [prix, setPrix] = useState<Record<(typeof CHAMPS_PRIX)[number]["cle"], number | null>>({ animal: null, aliment: null, produit: null, reforme: null });
  const [fixes, setFixes] = useState<number | null>(null);
  const [investissement, setInvestissement] = useState<number | null>(null);
  const [apport, setApport] = useState<number | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatAtelierAnimal | null>(null);

  useEffect(() => {
    let annule = false;
    appeler<Speculation[]>("/api/cultiplan/speculations?secteur=animal")
      .then((s) => !annule && setCatalogue(s))
      .catch((e: unknown) => !annule && setErreur(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      annule = true;
    };
  }, []);

  const complet = Boolean(speculation && effectif && effectif > 0 && CHAMPS_PRIX.every((c) => prix[c.cle] !== null));

  async function simuler() {
    setEnCours(true);
    setErreur(null);
    try {
      const corps = {
        speculation,
        bandes: [{ debutMois: 1, effectif }],
        prix,
        chargesFixesMensuelles: fixes ? [{ libelle: "Charges fixes", montant: fixes }] : [],
        investissement: investissement ?? 0,
        apport: apport ?? 0,
      };
      setResultat(await appeler<ResultatAtelierAnimal>("/api/cultiplan/elevage/bandes", { method: "POST", body: JSON.stringify(corps) }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Calcul impossible.");
    } finally {
      setEnCours(false);
    }
  }

  const nombre = (cle: string, libelle: string, valeur: number | null, set: (v: number | null) => void) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${cle}`} className="font-medium">
        {libelle}
      </label>
      <InputNumber id={`${id}-${cle}`} min={0} className="w-full" value={valeur} onChange={set} />
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <h1 className="m-0 font-title text-2xl font-bold">Ton atelier animal</h1>
        <p className="m-0 mt-1 text-sm text-muted">Poules pondeuses, poulets, bandes décalées : dis combien d&apos;animaux et à quels prix. Cultiplan applique les courbes d&apos;âge du référentiel.</p>
      </header>
      <Carte>
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (complet) void simuler();
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={id} className="font-medium">
              Quel animal ?
            </label>
            <Select id={id} placeholder="Choisis un animal" value={speculation} onChange={setSpeculation} options={catalogue.map((s) => ({ value: s.code, label: s.nom }))} notFoundContent="Aucun animal dans le référentiel" />
          </div>
          {nombre("effectif", "Combien d'animaux dans la première bande ?", effectif, setEffectif)}
          {CHAMPS_PRIX.map((c) => nombre(c.cle, c.libelle, prix[c.cle], (v) => setPrix((p) => ({ ...p, [c.cle]: v }))))}
          {nombre("fixes", "Charges fixes par mois (FCFA, facultatif)", fixes, setFixes)}
          {nombre("invest", "Investissement de départ (FCFA, facultatif)", investissement, setInvestissement)}
          {nombre("apport", "Ton apport (FCFA, facultatif)", apport, setApport)}
          <div className="md:col-span-2">
            <Button type="primary" htmlType="submit" loading={enCours} disabled={!complet}>
              Simuler l&apos;atelier
            </Button>
          </div>
        </form>
      </Carte>
      {erreur && <Alert type="error" showIcon title={erreur} closable onClose={() => setErreur(null)} />}
      {resultat && <VueAtelier r={resultat} />}
    </div>
  );
}
