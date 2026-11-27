import React from "react";

export function CultiPlanCanvas({ data }: { data: any }) {
  if (!data) return null;

  // Format number
  const formatMoney = (val: any) => {
    if (val === undefined || val === null) return "-";
    return Number(val).toLocaleString("fr-FR") + " FCFA";
  };

  // Determine which format we are dealing with
  const isV2Format = !!data.synthese && !!data.projet && !!data.financier;
  const isV1Format = !!data.meta && !!data.resume_executif && !data.synthese;

  if (isV2Format) {
    const { meta, synthese, projet, marche, technique, marketing, risques, financier, conclusion } = data;
    const syn = synthese?.fiche_synoptique;
    const res = synthese?.resume_executif;

    return (
      <div className="bg-surface p-8 rounded-[var(--ork-use-radius-card)] shadow-raised border border-border text-foreground w-full max-w-4xl space-y-12">
        {/* HEADER / META */}
        <div className="border-b-2 border-[var(--ork-use-border-brand)] pb-6">
          <h1 className="text-3xl font-bold font-title text-t-brand mb-4">
            {syn?.nom_entreprise || projet?.nom_projet || "Business Plan"}
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-muted">
            <div><strong className="text-foreground">Porteur :</strong> {syn?.promoteur || "-"}</div>
            <div><strong className="text-foreground">Filière :</strong> {syn?.filieres?.join(", ") || "-"}</div>
            <div><strong className="text-foreground">Objectif :</strong> {meta?.objectif_plan || "-"}</div>
            <div><strong className="text-foreground">Localisation :</strong> {syn?.localisation || "-"}</div>
            <div><strong className="text-foreground">Date :</strong> {meta?.date_generation || "-"}</div>
          </div>
        </div>

        {/* 1. RESUME EXECUTIF */}
        {res && (
          <section>
            <h2 className="text-xl font-bold font-title text-t-brand mb-4 flex items-center gap-2">
              <span className="bg-brand text-on-brand w-8 h-8 flex items-center justify-center rounded-[var(--ork-use-radius-control)] text-sm">1</span>
              Résumé Exécutif
            </h2>
            <div className="bg-sunken p-5 rounded-[var(--ork-use-radius-card)] border border-border mb-6 space-y-3 text-foreground">
              <p className="text-t-brand font-bold text-lg">{res.accroche}</p>
              <p><strong>Problème :</strong> {res.probleme}</p>
              <p><strong>Solution :</strong> {res.solution}</p>
              <p><strong>Avantage Concurrentiel :</strong> {res.avantage_concurrentiel}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[var(--ork-use-background-success-subtle)] p-4 rounded-[var(--ork-use-radius-card)] border border-[var(--ork-use-border-success)]">
                <div className="text-xs text-t-success font-bold mb-1 uppercase tracking-wide">Coût Total</div>
                <div className="text-lg font-title font-bold font-mono-numbers text-t-brand">{formatMoney(syn?.cout_total_projet)}</div>
              </div>
              <div className="bg-[var(--ork-use-background-action-subtle)] p-4 rounded-[var(--ork-use-radius-card)] border border-[var(--ork-use-border-warning)]">
                <div className="text-xs text-t-action font-bold mb-1 uppercase tracking-wide">CA (Année 1)</div>
                <div className="text-lg font-title font-bold font-mono-numbers text-t-action">{formatMoney(syn?.chiffre_affaires_annee_1)}</div>
              </div>
              <div className="bg-[var(--ork-use-background-info-subtle)] p-4 rounded-[var(--ork-use-radius-card)] border border-[var(--ork-use-border-info)]">
                <div className="text-xs text-t-info font-bold mb-1 uppercase tracking-wide">Montant Recherché</div>
                <div className="text-lg font-title font-bold font-mono-numbers text-t-info">{formatMoney(res.montant_recherche)}</div>
              </div>
              <div className="bg-[var(--ork-use-background-accent-subtle)] p-4 rounded-[var(--ork-use-radius-card)] border border-[var(--ork-use-border-selected)]">
                <div className="text-xs text-[var(--ork-use-text-accent)] font-bold mb-1 uppercase tracking-wide">TRI / VAN</div>
                <div className="text-lg font-title font-bold font-mono-numbers text-[var(--ork-use-text-accent)]">
                  {syn?.indicateurs_cles?.tri_pourcentage || 0}% / {formatMoney(syn?.indicateurs_cles?.van)}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. ETUDE DE MARCHE */}
        {marche && (
          <section>
            <h2 className="text-xl font-bold font-title text-t-brand mb-4 flex items-center gap-2">
              <span className="bg-brand text-on-brand w-8 h-8 flex items-center justify-center rounded-[var(--ork-use-radius-control)] text-sm">2</span>
              Étude de Marché
            </h2>
            <div className="space-y-6">
              <div className="bg-sunken p-5 rounded-[var(--ork-use-radius-card)] border border-border">
                <h3 className="font-bold text-foreground mb-2">Analyse de la demande</h3>
                <p className="text-muted text-sm">{marche.analyse_demande}</p>
              </div>
              
              {marche.segments_cibles && marche.segments_cibles.length > 0 && (
                <div>
                  <h3 className="font-bold text-foreground mb-2">Segments Cibles</h3>
                  <div className="overflow-x-auto rounded-[var(--ork-use-radius-card)] border border-border">
                    <table className="w-full text-sm text-left text-muted border-collapse">
                      <thead className="bg-sunken border-b border-border text-foreground">
                        <tr>
                          <th className="p-3 font-bold">Segment</th>
                          <th className="p-3 font-bold">Taille estimée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marche.segments_cibles.map((c: any, i: number) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="p-3 font-medium text-foreground">{c.nom}</td>
                            <td className="p-3">{c.taille_estimee}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. MARKETING */}
        {marketing && (
          <section>
            <h2 className="text-xl font-bold font-title text-t-brand mb-4 flex items-center gap-2">
              <span className="bg-brand text-on-brand w-8 h-8 flex items-center justify-center rounded-[var(--ork-use-radius-control)] text-sm">3</span>
              Marketing & Distribution
            </h2>
            <div className="bg-sunken p-5 rounded-[var(--ork-use-radius-card)] border border-border mb-4">
              <h3 className="font-bold text-foreground mb-2">Stratégie de prix</h3>
              <p className="text-muted text-sm whitespace-pre-wrap">{marketing.strategie_prix}</p>
            </div>
          </section>
        )}

        {/* 4. TECHNIQUE */}
        {technique && (
          <section>
            <h2 className="text-xl font-bold font-title text-t-brand mb-4 flex items-center gap-2">
              <span className="bg-brand text-on-brand w-8 h-8 flex items-center justify-center rounded-[var(--ork-use-radius-control)] text-sm">4</span>
              Étude Technique
            </h2>
            <div className="bg-sunken p-5 rounded-[var(--ork-use-radius-card)] border border-border">
              <h3 className="font-bold text-foreground mb-2">Processus de production</h3>
              <p className="text-muted text-sm">{technique.processus_production}</p>
            </div>
          </section>
        )}

        {/* 5. FINANCIER */}
        {financier && (
          <section>
            <h2 className="text-xl font-bold font-title text-t-brand mb-4 flex items-center gap-2">
              <span className="bg-brand text-on-brand w-8 h-8 flex items-center justify-center rounded-[var(--ork-use-radius-control)] text-sm">5</span>
              Étude Financière
            </h2>
            <div className="space-y-6">
              {financier.plan_financement_initial && (
                <div className="bg-sunken p-5 rounded-[var(--ork-use-radius-card)] border border-border">
                  <h3 className="font-bold text-foreground mb-4 border-b border-border pb-2">Plan de Financement Initial</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="font-bold text-t-brand mb-2">Besoins (Emplois)</h4>
                      <ul className="text-sm space-y-2 text-muted">
                        {financier.plan_financement_initial.besoins?.map((b: any, i: number) => (
                          <li key={i} className="flex justify-between border-b border-border pb-1">
                            <span>{b.rubrique}</span>
                            <span className="font-medium font-mono-numbers text-foreground">{formatMoney(b.montant)}</span>
                          </li>
                        ))}
                        <li className="flex justify-between font-bold text-foreground pt-2">
                          <span>TOTAL BESOINS</span>
                          <span className="font-mono-numbers">{formatMoney(financier.plan_financement_initial.total_besoins)}</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-t-action mb-2">Ressources</h4>
                      <ul className="text-sm space-y-2 text-muted">
                        {financier.plan_financement_initial.ressources?.map((r: any, i: number) => (
                          <li key={i} className="flex justify-between border-b border-border pb-1">
                            <span>{r.source}</span>
                            <span className="font-medium font-mono-numbers text-foreground">{formatMoney(r.montant)}</span>
                          </li>
                        ))}
                        <li className="flex justify-between font-bold text-foreground pt-2">
                          <span>TOTAL RESSOURCES</span>
                          <span className="font-mono-numbers">{formatMoney(financier.plan_financement_initial.total_ressources)}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 6. RISQUES */}
        {risques && risques.length > 0 && (
          <section>
            <h2 className="text-xl font-bold font-title text-t-brand mb-4 flex items-center gap-2">
              <span className="bg-brand text-on-brand w-8 h-8 flex items-center justify-center rounded-[var(--ork-use-radius-control)] text-sm">6</span>
              Risques & Mesures d&apos;Atténuation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {risques.map((r: any, i: number) => (
                <div key={i} className="border border-border rounded-[var(--ork-use-radius-card)] p-4 bg-sunken">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-muted uppercase tracking-wider">{r.type}</span>
                    <span className="text-xs px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] font-medium bg-[var(--ork-use-background-action-subtle)] text-t-action">
                      Niveau: {r.niveau_criticite}
                    </span>
                  </div>
                  <p className="font-bold text-foreground text-sm mb-2">{r.description}</p>
                  <div className="text-sm text-t-success bg-[var(--ork-use-background-success-subtle)] p-2 rounded-[var(--ork-use-radius-control)] border border-[var(--ork-use-border-success)]">
                    <strong>Mesure:</strong> {r.mesures_mitigation}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    );
  }

  // FALLBACK FOR VERY OLD V0 FORMAT
  return (
    <div className="bg-surface p-8 rounded-[var(--ork-use-radius-card)] shadow-raised border border-border w-full max-w-4xl">
      <h2 className="text-2xl font-bold font-title text-t-brand mb-4">Projet : {data.nom_projet || "Business Plan"}</h2>
      <div className="space-y-8 text-muted">
        <p>Le document a été généré, mais son format n&apos;est pas pris en charge par cet affichage.</p>
        <pre className="text-xs bg-sunken text-foreground p-4 rounded-[var(--ork-use-radius-control)] overflow-auto max-h-96">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

