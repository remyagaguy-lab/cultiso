// Durée de vie des investissements d'une spéculation (ref.modeles_charges, classe « investissement »), avec la source de la donnée.
// Sert à amortir l'investissement d'un atelier à bandes : la durée vient du référentiel si UNE seule durée y est donnée, sinon elle
// est demandée à l'appelant. Aucune durée n'est jamais devinée ni moyennée.
import type { ClientBase } from "@/core/exploitation";
import { ErreurReferentiel, type StatutDonnee } from "./index";

export interface InvestissementReference {
  libelle: string;
  dureeVieAns: number;
  source: string;
  statut: StatutDonnee;
}

export type DureeVieReferentiel =
  | { statut: "trouvee"; dureeVieAns: number; source: string; statutDonnee: StatutDonnee; libelles: string[] }
  | { statut: "absente"; message: string }
  | { statut: "ambigue"; message: string; durees: { dureeVieAns: number; libelles: string[] }[] };

const RANG: Record<StatutDonnee, number> = { brouillon_ia: 0, a_valider: 1, validee: 2 };

/** Pur : la durée de vie commune à tous les investissements de la spéculation, ou la raison pour laquelle on ne peut pas la choisir. */
export function choisirDureeVie(speculation: string, investissements: InvestissementReference[]): DureeVieReferentiel {
  if (investissements.length === 0) {
    return { statut: "absente", message: `Le référentiel ne donne aucune durée de vie d'investissement pour « ${speculation} » : donne-la avec sa source.` };
  }
  const parDuree = new Map<number, InvestissementReference[]>();
  for (const i of investissements) parDuree.set(i.dureeVieAns, [...(parDuree.get(i.dureeVieAns) ?? []), i]);
  if (parDuree.size > 1) {
    const durees = [...parDuree.entries()].map(([dureeVieAns, l]) => ({ dureeVieAns, libelles: l.map((x) => x.libelle) }));
    return {
      statut: "ambigue",
      durees,
      message: `Le référentiel donne plusieurs durées de vie pour « ${speculation} » (${durees.map((d) => `${d.dureeVieAns} ans : ${d.libelles.join(", ")}`).join(" ; ")}) : l'investissement de l'atelier est un seul montant, choisis la durée à retenir avec sa source.`,
    };
  }
  const [[dureeVieAns, lignes]] = [...parDuree.entries()];
  return {
    statut: "trouvee",
    dureeVieAns,
    source: [...new Set(lignes.map((l) => l.source))].join(" ; "),
    statutDonnee: lignes.reduce<StatutDonnee>((pire, l) => (RANG[l.statut] < RANG[pire] ? l.statut : pire), "validee"),
    libelles: lignes.map((l) => l.libelle),
  };
}

/** Lit les investissements du référentiel qui ont une durée de vie. Table illisible : erreur du référentiel. */
export async function lireInvestissementsReference(client: ClientBase, speculationCode: string): Promise<InvestissementReference[]> {
  const { data, error } = await client
    .schema("ref")
    .from("modeles_charges")
    .select("libelle, duree_vie_ans, source, statut")
    .eq("speculation_code", speculationCode)
    .eq("classe", "investissement");
  if (error) throw new ErreurReferentiel(`Lecture du référentiel impossible (durées de vie) : ${error.message}`);
  return data
    .filter((r) => r.duree_vie_ans !== null)
    .map((r) => ({ libelle: r.libelle, dureeVieAns: Number(r.duree_vie_ans), source: r.source ?? "source non renseignée", statut: r.statut as StatutDonnee }));
}
