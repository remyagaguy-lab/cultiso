"use client";

import { Alert, Button, Modal, Progress, Skeleton, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Manque, PointFaisabilite as Point, ProchaineQuestion, ProfilPorteur, QuestionAffichee } from "@/modules/cultiplan";
import { appeler as appelerParDefaut, type Appeler } from "./api";
import { ChampReponse } from "./ChampReponse";
import { PointFaisabilite } from "./PointFaisabilite";
import { brouillonInitial, reponseDepuisBrouillon, texteDeReponse, type Brouillon } from "./reponse";

/** Ce que renvoie GET /api/cultiplan/exploitations/:id/entretien. */
export interface VueConsultation {
  prochaine: ProchaineQuestion;
  manques: Manque[];
  point: Point;
  questions: QuestionAffichee[];
}

type Reponse = { question: string; valeur: unknown } | { question: string; neSaitPas: true };
type Onglet = "questions" | "reponses" | "point";

const messageDe = (e: unknown, defaut: string) => (e instanceof Error ? e.message : defaut);

/** Formulaire d'une question. Sa saisie vit ici et repart de zéro à chaque nouvelle question (clé = clé de la question). */
function FormulaireQuestion({
  question,
  enCours,
  onValider,
  onNePasSavoir,
  onPlusTard,
}: {
  question: QuestionAffichee;
  enCours: boolean;
  onValider: (valeur: unknown) => void;
  onNePasSavoir: () => void;
  onPlusTard: () => void;
}) {
  const [brouillon, setBrouillon] = useState<Brouillon>(() => brouillonInitial(question));
  const [controle, setControle] = useState<string | null>(null);
  const titre = useRef<HTMLHeadingElement>(null);
  const idAide = `aide-${question.cle}`;
  useEffect(() => titre.current?.focus(), []);
  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const c = reponseDepuisBrouillon(question, brouillon);
        if (!c.ok) setControle(c.message);
        else {
          setControle(null);
          onValider(c.valeur);
        }
      }}
      noValidate
    >
      <div>
        <h2 ref={titre} tabIndex={-1} className="m-0 text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--ork-use-border-brand)]">
          {question.libelle}
        </h2>
        {question.aide && (
          <p id={idAide} className="m-0 mt-1 text-sm text-muted">
            {question.aide}
          </p>
        )}
      </div>
      <ChampReponse question={question} valeur={brouillon} onChange={setBrouillon} idAide={question.aide ? idAide : undefined} desactive={enCours} />
      {controle && (
        <p role="alert" className="m-0 text-sm font-medium text-[#b42318]">
          {controle}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="primary" htmlType="submit" size="large" loading={enCours}>
          Valider
        </Button>
        <Button size="large" disabled={enCours} onClick={onNePasSavoir}>
          Je ne sais pas
        </Button>
        <Button type="text" size="large" disabled={enCours} onClick={onPlusTard}>
          Plus tard
        </Button>
      </div>
      <p className="m-0 text-xs text-muted">« Je ne sais pas » est une vraie réponse : on la note et on y reviendra. Rien n&apos;est inventé à ta place.</p>
    </form>
  );
}

/**
 * Consultation de cadrage : une question à la fois, « je ne sais pas » toujours visible, puis le point de faisabilité.
 * L'interface ne calcule rien : elle affiche ce que le serveur renvoie et lui envoie les réponses.
 */
export function ConsultationPorteur({ exploitationId, api = appelerParDefaut }: { exploitationId: string; api?: Appeler }) {
  const base = `/api/cultiplan/exploitations/${exploitationId}`;
  const [vue, setVue] = useState<VueConsultation | null>(null);
  const [profil, setProfil] = useState<ProfilPorteur | null>(null);
  const [reportees, setReportees] = useState<string[]>([]);
  const [controleModif, setControleModif] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>("questions");
  const [aModifier, setAModifier] = useState<QuestionAffichee | null>(null);
  const [brouillonModif, setBrouillonModif] = useState<Brouillon>(null);

  const lire = useCallback(
    async (liste: string[]) => {
      const q = liste.length > 0 ? `?reportees=${encodeURIComponent(liste.join(","))}` : "";
      const [v, p] = await Promise.all([api<VueConsultation>(`${base}/entretien${q}`), api<ProfilPorteur>(`${base}/profil`)]);
      return { v, p };
    },
    [api, base],
  );

  const charger = useCallback(
    async (liste: string[]) => {
      const { v, p } = await lire(liste);
      setVue(v);
      setProfil(p);
      return v;
    },
    [lire],
  );

  useEffect(() => {
    let annule = false;
    lire([])
      .then(({ v, p }) => {
        if (annule) return;
        setVue(v);
        setProfil(p);
        if (v.prochaine.fini) setOnglet("point");
      })
      .catch((e: unknown) => {
        if (!annule) setErreur(messageDe(e, "Chargement impossible."));
      });
    return () => {
      annule = true;
    };
  }, [lire]);

  const courante = useMemo(() => vue?.questions.find((q) => q.cle === vue.prochaine.question?.cle) ?? null, [vue]);

  const envoyer = useCallback(
    async (reponses: Reponse[], liste = reportees) => {
      setEnCours(true);
      setErreur(null);
      try {
        await api(`${base}/entretien`, { method: "POST", body: JSON.stringify({ reponses }) });
        const v = await charger(liste);
        if (v.prochaine.fini) setOnglet("point");
        return true;
      } catch (e) {
        setErreur(messageDe(e, "Enregistrement impossible."));
        return false;
      } finally {
        setEnCours(false);
      }
    },
    [api, base, charger, reportees],
  );

  const valider = async (q: QuestionAffichee, valeur: unknown, apres?: () => void) => {
    if (await envoyer([{ question: q.cle, valeur }])) apres?.();
  };

  const validerModif = (q: QuestionAffichee) => {
    const c = reponseDepuisBrouillon(q, brouillonModif);
    if (!c.ok) {
      setControleModif(c.message);
      return;
    }
    setControleModif(null);
    void valider(q, c.valeur, () => setAModifier(null));
  };

  const nePasSavoir = async (q: QuestionAffichee, apres?: () => void) => {
    if (await envoyer([{ question: q.cle, neSaitPas: true }])) apres?.();
  };

  const plusTard = async (q: QuestionAffichee) => {
    const liste = [...reportees, q.cle];
    setReportees(liste);
    setEnCours(true);
    setErreur(null);
    try {
      const v = await charger(liste);
      if (v.prochaine.fini) setOnglet("point");
    } catch (e) {
      setErreur(messageDe(e, "Chargement impossible."));
    } finally {
      setEnCours(false);
    }
  };

  const reprendre = async () => {
    setReportees([]);
    setEnCours(true);
    try {
      await charger([]);
      setOnglet("questions");
    } catch (e) {
      setErreur(messageDe(e, "Chargement impossible."));
    } finally {
      setEnCours(false);
    }
  };

  if (!vue && !erreur) return <Skeleton active paragraph={{ rows: 8 }} aria-label="Chargement de ta consultation" />;
  if (!vue) return <Alert type="error" showIcon title={erreur} />;

  const { prochaine } = vue;
  const tempsCourant = prochaine.avancement.find((a) => a.temps === prochaine.temps?.cle);
  const rang = vue.questions.length > 0 ? prochaine.avancement.findIndex((a) => a.temps === prochaine.temps?.cle) + 1 : 0;
  const pourcent = tempsCourant && tempsCourant.total > 0 ? Math.round((tempsCourant.traitees / tempsCourant.total) * 100) : 0;

  const questionsEcran = (
    <div className="flex flex-col gap-4">
      {prochaine.fini || !courante ? (
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="m-0 text-lg font-semibold">Tu as répondu à tout ce qu&apos;on peut te demander pour l&apos;instant</h2>
          <p className="mb-4 mt-2 text-sm text-muted">Regarde le point sur ton projet, ou reviens modifier une réponse dans « Mes réponses ».</p>
          <div className="flex flex-wrap gap-2">
            <Button type="primary" size="large" onClick={() => setOnglet("point")}>
              Voir le point sur mon projet
            </Button>
            {reportees.length > 0 && (
              <Button size="large" onClick={reprendre} loading={enCours}>
                Reprendre les {reportees.length} question{reportees.length > 1 ? "s" : ""} laissée{reportees.length > 1 ? "s" : ""} de côté
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="m-0 text-sm text-muted">
              Temps {rang} sur {prochaine.avancement.length} : <strong>{prochaine.temps?.titre}</strong>
            </p>
            <Progress percent={pourcent} size="small" aria-label={`Avancement du temps « ${prochaine.temps?.titre} »`} />
          </div>
          {prochaine.introTemps && <Alert type="info" showIcon title={prochaine.introTemps} />}
          <FormulaireQuestion
            key={courante.cle}
            question={courante}
            enCours={enCours}
            onValider={(valeur) => void valider(courante, valeur)}
            onNePasSavoir={() => void nePasSavoir(courante)}
            onPlusTard={() => void plusTard(courante)}
          />
          {reportees.length > 0 && (
            <div>
              <Button type="link" onClick={reprendre} disabled={enCours}>
                Reprendre les {reportees.length} question{reportees.length > 1 ? "s" : ""} laissée{reportees.length > 1 ? "s" : ""} de côté
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const parTemps = vue.questions.reduce<Record<string, QuestionAffichee[]>>((acc, q) => {
    (acc[q.tempsTitre] ??= []).push(q);
    return acc;
  }, {});

  const reponsesEcran = (
    <div className="flex flex-col gap-6">
      {Object.entries(parTemps).map(([nomTemps, liste]) => (
        <section key={nomTemps} aria-label={nomTemps}>
          <h2 className="mb-2 mt-0 text-base font-semibold">{nomTemps}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {liste.map((q) => (
              <li key={q.cle} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium">{q.libelle}</p>
                  <p className="m-0 text-sm text-muted">{texteDeReponse(q)}</p>
                </div>
                <Button
                  onClick={() => {
                    setAModifier(q);
                    setBrouillonModif(brouillonInitial(q));
                    setControleModif(null);
                  }}
                  aria-label={`${q.etat === "a_poser" || q.etat === "reportee" ? "Répondre à" : "Modifier"} : ${q.libelle}`}
                >
                  {q.etat === "a_poser" || q.etat === "reportee" ? "Répondre" : "Modifier"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {profil && (profil.existant.length > 0 || profil.credits.length > 0) && (
        <section aria-labelledby="titre-existant">
          <h2 id="titre-existant" className="mb-2 mt-0 text-base font-semibold">
            Ce que tu possèdes et ce que tu dois
          </h2>
          {profil.existant.length > 0 && (
            <ul className="mb-3 mt-0 list-disc pl-5 text-sm">
              {profil.existant.map((e) => (
                <li key={e.id ?? e.libelle}>
                  {e.libelle}
                  {e.quantite ? `, ${e.quantite}` : ""}
                  {e.etat ? `, état : ${{ neuf: "neuf", bon: "bon", moyen: "moyen", mauvais: "mauvais" }[e.etat]}` : ""}
                  {e.annee ? `, ${e.annee}` : ""}
                  {e.valeurEstimeeFcfa ? `, valeur estimée par toi : ${new Intl.NumberFormat("fr-FR").format(e.valeurEstimeeFcfa).replace(/\s/g, " ")} FCFA` : ""}
                </li>
              ))}
            </ul>
          )}
          {profil.credits.length > 0 && (
            <ul className="m-0 list-disc pl-5 text-sm">
              {profil.credits.map((c) => (
                <li key={c.id ?? `${c.creancier}-${c.mensualiteFcfa}`}>
                  {c.creancier ?? "Crédit"} : {new Intl.NumberFormat("fr-FR").format(c.mensualiteFcfa).replace(/\s/g, " ")} FCFA par mois
                  {c.moisRestants ? `, encore ${c.moisRestants} mois` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );

  const pointEcran = (
    <div className="flex flex-col gap-6">
      <PointFaisabilite point={vue.point} />
      {vue.manques.length > 0 && (
        <section aria-labelledby="titre-manques">
          <h2 id="titre-manques" className="mb-2 mt-0 text-base font-semibold">
            Ce qu&apos;il reste à éclaircir
          </h2>
          <ul className="m-0 list-disc pl-5 text-sm">
            {vue.manques.map((m) => (
              <li key={m.question.cle}>
                {m.question.court.charAt(0).toUpperCase() + m.question.court.slice(1)}
                {m.etat === "inconnue" ? " (tu ne sais pas encore)" : m.etat === "reportee" ? " (laissé pour plus tard)" : ""}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button onClick={() => setOnglet("reponses")}>Aller dans « Mes réponses »</Button>
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-8">
      <header>
        <h1 className="m-0 font-title text-2xl font-bold">Ta consultation</h1>
        <p className="m-0 mt-1 text-sm text-muted">
          On fait connaissance avec ton projet, une question à la fois. Tu peux répondre « je ne sais pas » à tout moment. Aucun chiffre n&apos;est calculé ici.
        </p>
      </header>
      <div aria-live="polite" className="sr-only">
        {courante && !prochaine.fini ? `Question : ${courante.libelle}` : ""}
      </div>
      {erreur && <Alert type="error" showIcon title={erreur} closable={{ onClose: () => setErreur(null) }} />}
      <Tabs
        activeKey={onglet}
        onChange={(k) => setOnglet(k as Onglet)}
        items={[
          { key: "questions", label: "Les questions", children: questionsEcran },
          { key: "reponses", label: "Mes réponses", children: reponsesEcran },
          { key: "point", label: "Le point", children: pointEcran },
        ]}
      />
      <Modal
        open={aModifier !== null}
        title={aModifier?.libelle}
        onCancel={() => setAModifier(null)}
        destroyOnHidden
        footer={
          aModifier && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => setAModifier(null)}>Annuler</Button>
              <Button disabled={enCours} onClick={() => void nePasSavoir(aModifier, () => setAModifier(null))}>
                Je ne sais pas
              </Button>
              <Button type="primary" loading={enCours} onClick={() => validerModif(aModifier)}>
                Enregistrer
              </Button>
            </div>
          )
        }
      >
        {aModifier && (
          <div className="flex flex-col gap-3">
            {aModifier.aide && <p className="m-0 text-sm text-muted">{aModifier.aide}</p>}
            <ChampReponse question={aModifier} valeur={brouillonModif} onChange={setBrouillonModif} desactive={enCours} />
            {controleModif && (
              <p role="alert" className="m-0 text-sm font-medium text-[#b42318]">
                {controleModif}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
