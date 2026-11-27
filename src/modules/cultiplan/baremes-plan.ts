// Plafonds des crédits de campagne lus dans les barèmes du référentiel (ref.baremes_credit_campagne), pour le financement détaillé d'un plan.
// Un crédit avec `baremeDe` reçoit le plafond du barème (barème du financeur, sinon barème général) ; sans barème, le plafond reste absent et le moteur
// le dit (PLAFOND_CAMPAGNE_NON_VERIFIE). Table absente en ligne : lecture tolérante, même résultat.
import type { ClientBase } from "@/core/exploitation";
import { plafondCampagne } from "@/moteurs";
import { choisirBareme, lireBaremesCampagne } from "@/referentiel/financement";
import type { FinancementDetaille } from "./financement-demande";

export interface ResolutionBaremes {
  detaille: FinancementDetaille;
  origines: string[];
  manques: string[];
}

export async function resoudreBaremesDetail(client: ClientBase, detaille: FinancementDetaille): Promise<ResolutionBaremes> {
  const origines: string[] = [];
  const manques: string[] = [];
  const creditsCampagne = [];
  for (const c of detaille.creditsCampagne) {
    if (!c.baremeDe) {
      creditsCampagne.push(c);
      continue;
    }
    const { baremeDe } = c;
    let bareme = null;
    try {
      const lus = await lireBaremesCampagne(client, baremeDe.speculationCode);
      const choix = choisirBareme(lus, baremeDe.organisme);
      bareme = choix.bareme;
      if (choix.ambigus.length > 0) manques.push(`Plusieurs barèmes pour ${baremeDe.speculationCode} (${choix.ambigus.map((a) => a.organisme ?? "général").join(", ")}) : précise le financeur.`);
    } catch {
      manques.push(`Les barèmes de crédit de campagne ne sont pas lisibles pour ${baremeDe.speculationCode}.`);
    }
    if (!bareme) {
      manques.push(`Aucun barème de crédit de campagne dans le référentiel pour ${baremeDe.speculationCode} : le plafond de « ${c.libelle} » n'est pas vérifié.`);
      creditsCampagne.push({ ...c, plafond: undefined });
      continue;
    }
    origines.push(`Plafond de « ${c.libelle} » : barème ${bareme.organisme ?? "général"} du référentiel (${bareme.source}, statut ${bareme.statut ?? "inconnu"}).`);
    creditsCampagne.push({ ...c, plafond: plafondCampagne(bareme, baremeDe.tailleAtelier) });
  }
  return { detaille: { ...detaille, creditsCampagne }, origines, manques };
}

export async function resoudreBaremes(client: ClientBase, detaille: FinancementDetaille): Promise<FinancementDetaille> {
  return (await resoudreBaremesDetail(client, detaille)).detaille;
}
