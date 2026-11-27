/** @jest-environment node */
// R10 : bornes de rendement du référentiel. Données de départ, lecture, passage au générateur de budget puis aux contrôles. Sans base.
import donnees from "../../../supabase/donnees/referentiel-depart.json";
import { calculerFinances, genererBudget } from "@/moteurs";
import type { ClientBase } from "@/core/exploitation";
import { deplier, uuidDe, type DonneesDepart } from "../donnees-depart";
import { ErreurReferentiel, lireBornesRendement, lireModeles, versBornes } from "..";

const d = deplier(donnees as unknown as DonneesDepart);
const idOignon = uuidDe("revenu:oignon.vente");
const ligneBorne = () => ({ ...d.bornesRendement[0], created_at: "", updated_at: "", valide_le: null, valide_par: null });

/** Client simulé : renvoie des lignes différentes selon la table interrogée. */
function faussClient(parTable: Record<string, unknown[]>) {
  const appels: string[] = [];
  const client = {
    schema: () => ({
      from: (table: string) => {
        appels.push(table);
        const requete: Record<string, unknown> = {};
        for (const m of ["select", "order", "in", "eq"]) requete[m] = () => requete;
        requete.then = (ok: (v: unknown) => unknown) => ok({ data: parTable[table] ?? [], error: null });
        return requete;
      },
    }),
  } as unknown as ClientBase;
  return { client, appels };
}

describe("données de départ des bornes de rendement", () => {
  it("oignon : bornes de DOC-00015, en brouillon IA, avec source et date", () => {
    expect(d.bornesRendement).toHaveLength(1);
    const b = d.bornesRendement[0];
    expect(b.modele_revenu_id).toBe(idOignon);
    expect(b).toMatchObject({ min_par_unite: 10_000, max_par_unite: 70_000, statut: "brouillon_ia" });
    expect(b.typique_par_unite).toBeNull(); // la source ne donne pas de valeur typique : on n'en invente pas
    expect(b.source).toMatch(/DOC-00015/);
    expect(b.date_source).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("chaque borne vise un modèle de revenu qui existe", () => {
    const ids = new Set(d.modelesRevenus.map((r) => r.id));
    for (const b of d.bornesRendement) expect(ids.has(b.modele_revenu_id)).toBe(true);
  });

  it("l'identifiant est déterministe", () => {
    expect(deplier(donnees as unknown as DonneesDepart).bornesRendement[0].id).toBe(d.bornesRendement[0].id);
  });
});

describe("lecture", () => {
  it("versBornes garde les bornes connues, la source, la date et le statut", () => {
    expect(versBornes(ligneBorne() as never)).toMatchObject({ min: 10_000, max: 70_000, statut: "brouillon_ia", dateSource: "2026-11-27" });
    expect(versBornes(ligneBorne() as never)).not.toHaveProperty("typique");
  });

  it("une source vide est refusée", () => {
    expect(() => versBornes({ ...ligneBorne(), source: "" } as never)).toThrow(ErreurReferentiel);
  });

  it("lireBornesRendement interroge ref.bornes_rendement ; sans modèle, aucune requête", async () => {
    const { client, appels } = faussClient({ bornes_rendement: [ligneBorne()] });
    const m = await lireBornesRendement(client, [idOignon]);
    expect(appels).toEqual(["bornes_rendement"]);
    expect(m.get(idOignon)?.max).toBe(70_000);
    expect((await lireBornesRendement(client, [])).size).toBe(0);
    expect(appels).toHaveLength(1);
  });

  it("lireModeles attache les bornes au modèle de revenu visé", async () => {
    const revenu = d.modelesRevenus.find((r) => r.id === idOignon);
    const { client } = faussClient({ modeles_charges: [], modeles_revenus: [revenu], bornes_rendement: [ligneBorne()] });
    const { modelesRevenus } = await lireModeles(client, ["oignon"]);
    expect(modelesRevenus[0].bornes).toMatchObject({ min: 10_000, max: 70_000 });
  });
});

describe("du référentiel aux contrôles", () => {
  const modele = { ...(d.modelesRevenus.find((r) => r.id === idOignon) as never as Record<string, unknown>) };
  const revenuModele = (quantiteRealiste: number) => ({
    id: idOignon,
    speculationCode: "oignon",
    typeRevenu: "principal",
    libelle: "Oignon",
    unite: "kg",
    quantite: { pessimiste: 1, realiste: quantiteRealiste, optimiste: quantiteRealiste },
    prixReference: 270,
    statut: "brouillon_ia" as const,
    bornes: versBornes(ligneBorne() as never),
  });
  const rendement = (quantite: number, taille: number) => {
    const budget = genererBudget({ ateliers: [{ atelierId: "a", speculationCode: "oignon", taille }], modelesCharges: [], modelesRevenus: [revenuModele(quantite)] });
    return { budget, finance: calculerFinances({ charges: [], revenus: budget.revenus }) };
  };

  it("les bornes sont mises à la taille de l'atelier, avec source, date et statut", () => {
    const { budget } = rendement(15_000, 2);
    expect(modele).toBeDefined();
    expect(budget.revenus[0].bornesQuantite).toMatchObject({ min: 20_000, max: 140_000, statut: "brouillon_ia" });
    expect(budget.revenus[0].bornesQuantite?.source).toMatch(/DOC-00015.*source du 2026-11-27/);
  });

  it("90 t/ha d'oignon : alerte ; 15 t/ha : dans les valeurs connues", () => {
    const trop = rendement(90_000, 1).finance.scenarios.realiste.controles.find((c) => c.code === "RENDEMENT_HORS_BORNES");
    expect(trop?.niveau).toBe("alerte");
    expect(trop?.valeurs).toMatchObject({ max: 70_000, statutBornes: "brouillon_ia" });
    const bon = rendement(15_000, 1).finance.scenarios.realiste.controles.find((c) => c.code === "RENDEMENT_HORS_BORNES");
    expect(bon?.niveau).toBe("ok");
  });

  it("un modèle sans bornes ne déclenche aucun contrôle de rendement", () => {
    const { bornes: _bornes, ...sansBornes } = revenuModele(15_000);
    const budget = genererBudget({ ateliers: [{ atelierId: "a", speculationCode: "oignon", taille: 1 }], modelesCharges: [], modelesRevenus: [sansBornes] });
    expect(budget.revenus[0].bornesQuantite).toBeUndefined();
  });
});
