"use client";

import { Button, Checkbox, Input, InputNumber, Radio, Select } from "antd";
import type { QuestionAffichee } from "@/modules/cultiplan";
import type { Brouillon, CreditBrouillon, LigneExistantBrouillon } from "./reponse";

interface Props {
  question: QuestionAffichee;
  valeur: Brouillon;
  onChange: (valeur: Brouillon) => void;
  /** Identifiant du texte d'aide, relié au champ pour les lecteurs d'écran. */
  idAide?: string;
  desactive?: boolean;
}

const nombreOuNull = (v: number | string | null): number | null => (typeof v === "number" ? v : v === null || v === "" ? null : Number(v));

const CATEGORIES = [
  { value: "materiel", label: "Matériel (outils, pompe, machine)" },
  { value: "batiment", label: "Bâtiment (magasin, poulailler)" },
  { value: "animaux", label: "Animaux" },
  { value: "plants", label: "Plants et arbres" },
];
const ETATS = [
  { value: "neuf", label: "Neuf" },
  { value: "bon", label: "Bon état" },
  { value: "moyen", label: "État moyen" },
  { value: "mauvais", label: "Mauvais état" },
];

function Champ({ etiquette, children }: { etiquette: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{etiquette}</span>
      {children}
    </label>
  );
}

/** Liste d'éléments possédés ou de crédits en cours : une carte par ligne, « Ajouter » en bas, vide = « aucun ». */
function ListeEditeur({ question, valeur, onChange, desactive }: Props) {
  const credits = question.cible === "credits";
  const lignes = (Array.isArray(valeur) ? valeur : []) as Record<string, unknown>[];
  const changer = (i: number, patch: Record<string, unknown>) => onChange(lignes.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const retirer = (i: number) => onChange(lignes.filter((_, k) => k !== i));
  const ajouter = () => onChange([...lignes, credits ? {} : { categorie: "materiel" }]);
  return (
    <div className="flex flex-col gap-3">
      {lignes.length === 0 && <p className="m-0 text-sm text-muted">{credits ? "Aucun crédit pour l'instant. Si tu n'en as pas, valide comme ça." : "Rien pour l'instant. Si tu ne possèdes rien, valide comme ça."}</p>}
      {lignes.map((ligne, i) => {
        const c = ligne as CreditBrouillon & LigneExistantBrouillon;
        return (
          <fieldset key={i} className="m-0 flex flex-col gap-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-semibold">{credits ? `Crédit ${i + 1}` : `Élément ${i + 1}`}</legend>
            {credits ? (
              <>
                <Champ etiquette="À qui dois-tu cet argent ?">
                  <Input value={c.creancier ?? ""} maxLength={120} disabled={desactive} onChange={(e) => changer(i, { creancier: e.target.value })} />
                </Champ>
                <Champ etiquette="Combien rembourses-tu par mois ? (FCFA)">
                  <InputNumber style={{ width: "100%" }} min={0} value={c.mensualiteFcfa ?? null} disabled={desactive} inputMode="numeric" onChange={(v) => changer(i, { mensualiteFcfa: nombreOuNull(v) })} />
                </Champ>
                <Champ etiquette="Combien reste-t-il à rembourser en tout ? (FCFA, si tu sais)">
                  <InputNumber style={{ width: "100%" }} min={0} value={c.capitalRestantFcfa ?? null} disabled={desactive} inputMode="numeric" onChange={(v) => changer(i, { capitalRestantFcfa: nombreOuNull(v) })} />
                </Champ>
                <Champ etiquette="Pendant combien de mois encore ? (si tu sais)">
                  <InputNumber style={{ width: "100%" }} min={0} precision={0} value={c.moisRestants ?? null} disabled={desactive} inputMode="numeric" onChange={(v) => changer(i, { moisRestants: nombreOuNull(v) })} />
                </Champ>
              </>
            ) : (
              <>
                <Champ etiquette="De quoi s'agit-il ?">
                  <Select options={CATEGORIES} value={c.categorie} disabled={desactive} onChange={(v) => changer(i, { categorie: v })} />
                </Champ>
                <Champ etiquette="Nom (par exemple : motopompe, poulailler, 20 poules)">
                  <Input value={c.libelle ?? ""} maxLength={120} disabled={desactive} onChange={(e) => changer(i, { libelle: e.target.value })} />
                </Champ>
                <Champ etiquette="Combien ? (si tu sais)">
                  <InputNumber style={{ width: "100%" }} min={0} value={c.quantite ?? null} disabled={desactive} inputMode="decimal" onChange={(v) => changer(i, { quantite: nombreOuNull(v) })} />
                </Champ>
                <Champ etiquette="Dans quel état ? (si tu sais)">
                  <Select allowClear options={ETATS} value={c.etat ?? undefined} disabled={desactive} onChange={(v) => changer(i, { etat: v ?? null })} />
                </Champ>
                <Champ etiquette="De quelle année ? (si tu sais)">
                  <InputNumber style={{ width: "100%" }} min={1950} max={2100} precision={0} value={c.annee ?? null} disabled={desactive} inputMode="numeric" onChange={(v) => changer(i, { annee: nombreOuNull(v) })} />
                </Champ>
                <Champ etiquette="Combien ça vaut selon toi ? (FCFA, ton estimation)">
                  <InputNumber style={{ width: "100%" }} min={0} value={c.valeurEstimeeFcfa ?? null} disabled={desactive} inputMode="numeric" onChange={(v) => changer(i, { valeurEstimeeFcfa: nombreOuNull(v) })} />
                </Champ>
              </>
            )}
            <div>
              <Button danger type="text" disabled={desactive} onClick={() => retirer(i)} aria-label={`Retirer ${credits ? "le crédit" : "l'élément"} ${i + 1}`}>
                Retirer
              </Button>
            </div>
          </fieldset>
        );
      })}
      <div>
        <Button onClick={ajouter} disabled={desactive}>
          {credits ? "Ajouter un crédit" : "Ajouter un élément"}
        </Button>
      </div>
    </div>
  );
}

/** Le bon champ de saisie pour une question, selon son type. Toutes les cibles sont assez grandes pour un doigt. */
export function ChampReponse(props: Props) {
  const { question: q, valeur, onChange, idAide, desactive } = props;
  switch (q.type) {
    case "choix":
      return (
        <Radio.Group style={{ display: "flex", flexDirection: "column", gap: 8 }} value={valeur ?? undefined} disabled={desactive} onChange={(e) => onChange(e.target.value)} aria-describedby={idAide} aria-label={q.libelle}>
          {q.reponses.map((r) => (
            <Radio key={r.valeur} value={r.valeur} className="rounded-lg border border-border px-3 py-2.5 text-base">
              {r.libelle}
            </Radio>
          ))}
        </Radio.Group>
      );
    case "choix_multiple":
      return (
        <Checkbox.Group style={{ display: "flex", flexDirection: "column", gap: 8 }} value={Array.isArray(valeur) ? (valeur as string[]) : []} disabled={desactive} onChange={(v) => onChange(v)} aria-describedby={idAide} aria-label={q.libelle}>
          {q.reponses.map((r) => (
            <Checkbox key={r.valeur} value={r.valeur} className="rounded-lg border border-border px-3 py-2.5 text-base">
              {r.libelle}
            </Checkbox>
          ))}
        </Checkbox.Group>
      );
    case "nombre":
    case "montant":
      return (
        <InputNumber
          style={{ width: "100%", maxWidth: 384 }}
          size="large"
          min={0}
          value={typeof valeur === "number" ? valeur : null}
          disabled={desactive}
          inputMode={q.type === "montant" ? "numeric" : "decimal"}
          suffix={q.unite ?? undefined}
          aria-label={q.libelle}
          aria-describedby={idAide}
          onChange={(v) => onChange(nombreOuNull(v))}
        />
      );
    case "oui_non":
      return (
        <Radio.Group className="flex flex-col gap-2 sm:flex-row" value={typeof valeur === "boolean" ? String(valeur) : undefined} disabled={desactive} onChange={(e) => onChange(e.target.value === "true")} aria-describedby={idAide} aria-label={q.libelle}>
          <Radio value="true" className="rounded-lg border border-border px-6 py-2.5 text-base">Oui</Radio>
          <Radio value="false" className="rounded-lg border border-border px-6 py-2.5 text-base">Non</Radio>
        </Radio.Group>
      );
    case "texte":
      return (
        <Input.TextArea rows={3} maxLength={200} showCount value={typeof valeur === "string" ? valeur : ""} disabled={desactive} aria-label={q.libelle} aria-describedby={idAide} onChange={(e) => onChange(e.target.value)} />
      );
    case "liste":
      return <ListeEditeur {...props} />;
  }
}
