"use client";

import { Collapse } from "antd";
import type { HypotheseCle, ResultatFinance, Scenario } from "@/moteurs";
import { Carte, Feu, Origine, Section, fcfa, nb, pourcent, type Teinte } from "../commun";
import { usePlan } from "./PlanContext";
import type { ResultatScenario } from "./verdict";

const NOM_SCENARIO: Record<Scenario, string> = { pessimiste: "Pessimiste", realiste: "Réaliste", optimiste: "Optimiste" };
const STATUT: Record<ResultatScenario["statut"], { teinte: Teinte; mot: string }> = {
  rentable: { teinte: "vert", mot: "Rentable" },
  limite: { teinte: "orange", mot: "Limite" },
  deficitaire: { teinte: "rouge", mot: "Déficitaire" },
};
const NOM_HYPOTHESE: Record<HypotheseCle, string> = {
  prix: "Le prix de vente",
  rendement: "La récolte",
  pertes: "Les pertes",
  intrants: "Le coût des intrants",
  mainOeuvre: "Le coût de la main d'oeuvre",
};
const signe = (v: number) => `${v > 0 ? "+" : ""}${pourcent(v)}`;

export function VueScenarios({ resultats }: { resultats: ResultatFinance }) {
  const { sensibilite: s, scenarios } = resultats;
  const t = s.testPrixBas;
  const seuil = scenarios.realiste.seuilCommercialisation;
  const principale = s.tableauSeuil.lignePrincipale;
  return (
    <>
      <Section id="prix-bas" titre="Si le prix baisse" intro="On commence par le cas qui fait le plus mal aux projets agricoles.">
        <Carte className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Feu teinte={STATUT[t.statut].teinte} texte={STATUT[t.statut].mot} />
            <strong>Avec un prix en baisse de {pourcent(Math.abs(t.baisse))}</strong>
          </div>
          <p className="m-0 text-sm">
            Gain cumulé : <strong>{fcfa(t.resultatCumule)}</strong>. Mois le plus difficile : <strong>{fcfa(t.pointBasTresorerie)}</strong>.
            {t.soldeResiduelMin !== null && (
              <>
                {" "}
                Ce qui reste à ta famille après le crédit, au plus bas : <strong>{fcfa(t.soldeResiduelMin)}</strong>.
              </>
            )}
          </p>
          <Origine>
            {t.origine === "parametre" ? "baisse choisie dans le plan" : t.origine === "scenario_pessimiste" ? "écart de prix du scénario pessimiste" : "plus forte baisse testée"}.
          </Origine>
        </Carte>
      </Section>

      <Section id="seuils" titre="Ce qui fait basculer ton projet" intro="Sous ces valeurs, tu perds de l'argent.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {seuil.parLigne.map((l) => (
            <Carte key={l.ligneId}>
              <p className="m-0 text-sm text-muted">Prix minimum, {l.libelle}</p>
              <p className="m-0 my-1 text-2xl font-bold tabular-nums">{fcfa(l.prixSeuil)}</p>
              <p className="m-0 text-sm">
                Tu vends aujourd&apos;hui à {fcfa(l.prixActuel)}. Sous ce prix, les dépenses, le crédit et la famille ne sont plus couverts (année {seuil.an}).
              </p>
            </Carte>
          ))}
          {s.equilibre.parLigne.map((l) => (
            <Carte key={`e-${l.ligneId}`}>
              <p className="m-0 text-sm text-muted">Récolte qui annule le gain, {l.libelle}</p>
              <p className="m-0 my-1 text-2xl font-bold tabular-nums">{nb(l.quantiteEquilibre)}</p>
              <p className="m-0 text-sm">
                Tu prévois {nb(l.quantiteActuelle)}. Prix d&apos;équilibre : {fcfa(l.prixEquilibre)}.
              </p>
            </Carte>
          ))}
        </div>
      </Section>

      <Section id="trois" titre="Trois scénarios côte à côte">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(["pessimiste", "realiste", "optimiste"] as const).map((k) => {
            const sc = scenarios[k];
            const an1 = sc.annees[0];
            return (
              <Carte key={k} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="m-0 text-base font-semibold">{NOM_SCENARIO[k]}</h3>
                  <Feu teinte={STATUT[sc.statut].teinte} texte={STATUT[sc.statut].mot} />
                </div>
                <dl className="m-0 mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Ventes, année 1</dt>
                  <dd className="m-0 text-right tabular-nums">{fcfa(an1.chiffreAffaires)}</dd>
                  <dt className="text-muted">Gain, année 1</dt>
                  <dd className="m-0 text-right tabular-nums">{fcfa(an1.resultat)}</dd>
                  <dt className="text-muted">Mois le plus difficile</dt>
                  <dd className="m-0 text-right tabular-nums">{fcfa(sc.pointBasTresorerie.montant)}</dd>
                </dl>
              </Carte>
            );
          })}
        </div>
      </Section>

      <Section id="detail" titre="Pour aller plus loin">
        <Collapse
          items={[
            {
              key: "classement",
              label: "Ce qui pèse le plus sur ton gain",
              children: (
                <ol className="m-0 pl-5 text-sm">
                  {s.classement.map((h) => (
                    <li key={h}>
                      <strong>{NOM_HYPOTHESE[h]}</strong> :{" "}
                      {s.variations
                        .filter((x) => x.hypothese === h)
                        .map((x) => `${signe(x.variation)} donne un gain cumulé de ${fcfa(x.resultatCumule)}`)
                        .join(" ; ")}
                    </li>
                  ))}
                </ol>
              ),
            },
            {
              key: "tableau",
              label: "Tableau rendement × charges (pour le technicien)",
              children: principale ? (
                <div className="overflow-x-auto">
                  <p className="m-0 mb-2 text-sm">
                    Prix de vente minimum de {principale.libelle} (aujourd&apos;hui {fcfa(principale.prixActuel)}).
                  </p>
                  <table className="w-full border-collapse text-sm tabular-nums">
                    <caption className="sr-only">Prix de vente minimum selon la récolte (lignes) et les charges (colonnes)</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="p-2 text-left font-medium text-muted">
                          Récolte \ Charges
                        </th>
                        {s.tableauSeuil.axeCharges.map((c) => (
                          <th key={c} scope="col" className="p-2 text-right font-medium">
                            {signe(c)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.tableauSeuil.axeRendement.map((rd, i) => (
                        <tr key={rd} className="border-t border-border">
                          <th scope="row" className="p-2 text-left font-medium">
                            {signe(rd)}
                          </th>
                          {s.tableauSeuil.axeCharges.map((c, j) => {
                            const prix = principale.prixSeuil[i][j];
                            return (
                              <td key={c} className="p-2 text-right">
                                {prix === null ? "non calculable" : fcfa(prix)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="m-0 text-sm">Pas de ligne de vente : le tableau n&apos;est pas calculable.</p>
              ),
            },
            {
              key: "intensite",
              label: "Si tu intensifies",
              children: (
                <div className="text-sm">
                  <p className="m-0">
                    Intrants et main d&apos;oeuvre pèsent {s.intensite.partIntrantsMainOeuvre === null ? "une part non calculable" : pourcent(s.intensite.partIntrantsMainOeuvre)} de tes dépenses ({fcfa(s.intensite.intrants + s.intensite.mainOeuvre)} sur {fcfa(s.intensite.chargesExploitation)}).
                  </p>
                  <ul className="m-0 mt-2 pl-5">
                    {s.intensite.seuils.map((x) => (
                      <li key={x.hausse}>
                        Si ces dépenses augmentent de {pourcent(x.hausse)} : {fcfa(x.surcout)} de plus par an. La récolte doit monter de{" "}
                        {x.rendementRequis === null ? "un montant non calculable" : pourcent(x.rendementRequis)} pour ne pas y perdre.
                      </li>
                    ))}
                  </ul>
                  <p className="m-0 mt-2 text-muted">Cultiso ne juge pas si c&apos;est trop : compare ce gain de récolte à ce que promet ton itinéraire technique.</p>
                </div>
              ),
            },
          ]}
        />
      </Section>
    </>
  );
}

export function ScenariosPlan() {
  const { plan } = usePlan();
  if (!plan.resultats) return <p className="m-0">Ce plan n&apos;est pas encore calculé.</p>;
  return <VueScenarios resultats={plan.resultats} />;
}
