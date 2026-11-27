/** @jest-environment node */
// R11 : règles des financeurs. Lecture, validation, passage au moteur, données de départ. Sans base (client simulé).
import donnees from "../../../supabase/donnees/referentiel-depart.json";
import { calculerFinances } from "@/moteurs";
import { tomate2ha } from "@/moteurs/test-utils/tomate";
import type { ClientBase } from "@/core/exploitation";
import { deplier, type DonneesDepart } from "../donnees-depart";
import { ErreurReferentiel, lireReglesFinanceurs, trouverRegleFinanceur, versRegleFinanceur, versRegleMoteur } from "..";

const d = deplier(donnees as unknown as DonneesDepart);
const ligneAnpgf = (() => {
  const { id, ...reste } = d.financeurs[0];
  return { ...reste, id, created_at: "", updated_at: "", valide_le: null, valide_par: null };
})();

/** Client simulé : record les filtres demandés et renvoie les lignes données. */
function faussClient(lignes: unknown[], erreur?: string) {
  const appels: string[] = [];
  const requete: Record<string, unknown> = {};
  const chaine = (nom: string) => (...args: unknown[]) => {
    appels.push(`${nom}(${args.join(",")})`);
    return requete;
  };
  for (const m of ["select", "order", "ilike", "eq"]) requete[m] = chaine(m);
  requete.then = (ok: (v: unknown) => unknown) => ok(erreur ? { data: null, error: { message: erreur } } : { data: lignes, error: null });
  const client = { schema: (s: string) => ({ from: (t: string) => (appels.push(`${s}.${t}`), requete) }) } as unknown as ClientBase;
  return { client, appels };
}

describe("données de départ des financeurs", () => {
  it("ANPGF : apport 20 %, 4 ans, différé d'un an au plus, en brouillon IA avec sa source", () => {
    expect(d.financeurs).toHaveLength(1);
    const f = d.financeurs[0];
    expect(f).toMatchObject({ organisme: "ANPGF", produit: "projet_demarrage", pays: "TG", apport_minimum: 0.2, duree_max_mois: 48, differe_max_mois: 12, statut: "brouillon_ia" });
    expect(f.source).toMatch(/§10\.1/);
    expect(f.source).toMatch(/§10\.3/);
    expect(f.taux_indicatif).toBeNull(); // le canevas ne donne aucun taux : on n'en invente pas
    expect(f.pieces_exigees.length).toBeGreaterThan(0);
  });

  it("l'identifiant est déterministe et la ligne passe la validation", () => {
    expect(deplier(donnees as unknown as DonneesDepart).financeurs[0].id).toBe(d.financeurs[0].id);
    const r = versRegleFinanceur(ligneAnpgf as never);
    expect(r.apportMinimum).toBe(0.2);
    expect(r.taxes[0].nom).toMatch(/Taxe/);
  });
});

describe("lecture et service", () => {
  it("versRegleMoteur ne garde que les règles connues et le statut", () => {
    const r = versRegleFinanceur({ ...ligneAnpgf, apport_minimum: null, differe_max_mois: null } as never);
    expect(versRegleMoteur(r)).toEqual({ nom: "ANPGF", dureeMaxMois: 48, dureeInclutDiffere: true, source: r.source, statut: "brouillon_ia" });
  });

  it("une valeur hors bornes en base est refusée avec un message clair", () => {
    expect(() => versRegleFinanceur({ ...ligneAnpgf, apport_minimum: 1.5 } as never)).toThrow(ErreurReferentiel);
  });

  it("lireReglesFinanceurs interroge ref.regles_financeurs avec les filtres", async () => {
    const { client, appels } = faussClient([ligneAnpgf]);
    const regles = await lireReglesFinanceurs(client, { organisme: "anpgf", produit: "projet_demarrage", pays: "TG" });
    expect(regles).toHaveLength(1);
    expect(appels).toEqual(expect.arrayContaining(["ref.regles_financeurs", "ilike(organisme,anpgf)", "eq(produit,projet_demarrage)", "eq(pays,TG)"]));
  });

  it("une erreur de lecture devient une ErreurReferentiel", async () => {
    await expect(lireReglesFinanceurs(faussClient([], "boom").client)).rejects.toThrow(/Lecture du référentiel impossible/);
  });

  it("trouverRegleFinanceur : trouvée, inconnue (null) ou ambiguë (erreur qui liste les produits)", async () => {
    expect((await trouverRegleFinanceur(faussClient([ligneAnpgf]).client, "ANPGF"))?.organisme).toBe("ANPGF");
    expect(await trouverRegleFinanceur(faussClient([]).client, "Banque X")).toBeNull();
    await expect(trouverRegleFinanceur(faussClient([ligneAnpgf, { ...ligneAnpgf, id: "2", produit: "campagne" }]).client, "ANPGF")).rejects.toThrow(/campagne/);
  });

  it("la règle lue arrive jusqu'aux contrôles du moteur", () => {
    const regle = versRegleMoteur(versRegleFinanceur(ligneAnpgf as never));
    const c = calculerFinances({ ...tomate2ha, apport: 200_000, credit: { montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 60, differeMois: 18 }, regleFinanceur: regle }).scenarios.realiste.controles;
    const alertes = c.filter((x) => x.niveau === "alerte").map((x) => x.code);
    expect(alertes).toEqual(expect.arrayContaining(["APPORT_INSUFFISANT", "DUREE_HORS_REGLE", "DIFFERE_HORS_REGLE", "ALERTE_APPORT_SOUS_SEUIL"]));
  });
});
