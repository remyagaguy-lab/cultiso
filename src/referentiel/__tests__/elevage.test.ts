/** @jest-environment node */
// M14 : données de la migration ref.courbes_age (lues dans le fichier SQL, sans base), assemblage des variantes, recoupement avec le modèle source.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { simulerBandes } from "@/moteurs";
import type { Database } from "@/types/supabase";
import { ErreurReferentiel } from "..";
import { assemblerVariantes } from "../elevage";

const SQL = readFileSync(join(process.cwd(), "supabase/migrations/20261127180000_ref_courbes_age.sql"), "utf8");

/** Les tableaux de valeurs de la variante burkinabè, par grandeur, tels qu'écrits dans la migration. */
function courbesDeLaMigration(): Record<string, number[]> {
  const sortie: Record<string, number[]> = {};
  for (const m of SQL.matchAll(/'burkina_doc00686', '(\w+)', t\.age[\s\S]*?unnest\(ARRAY\[([^\]]+)\]\)/g)) sortie[m[1]] = m[2].split(",").map((v) => Number(v.trim()));
  return sortie;
}

describe("courbes par âge de la migration (DOC-00686)", () => {
  const c = courbesDeLaMigration();

  it("trois courbes de 19 mois pour la poule pondeuse, aux valeurs du modèle source", () => {
    expect(Object.keys(c).sort()).toEqual(["consommation", "mortalite", "production"]);
    for (const g of Object.keys(c)) expect(c[g]).toHaveLength(19);
    expect(c.mortalite.slice(0, 4)).toEqual([0.04, 0.01, 0.01, 0.002]);
    expect(new Set(c.mortalite.slice(3)).size).toBe(1);
    expect(c.consommation.slice(0, 8)).toEqual([20, 40, 60, 65, 80, 85, 100, 100]);
    expect(c.production.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(c.production.slice(5, 8)).toEqual([0.4, 0.75, 0.8]);
    expect(c.production[18]).toBe(0.65);
    for (const v of [...c.mortalite, ...c.production]) expect(v).toBeLessThanOrEqual(1);
  });

  it("toute valeur est en brouillon IA avec sa source et sa date ; rien n'est validé d'office ; pas de courbe pour le poulet de chair sauf un point de poids", () => {
    expect(SQL).not.toMatch(/'validee'\s*,/);
    expect(SQL.match(/DATE '2026-11-27'/g)!.length).toBeGreaterThanOrEqual(13);
    expect(SQL).toContain("Brouillon IA : à faire valider par un expert togolais.");
    expect(SQL).toMatch(/\('poulet_chair', 'mali_doc00136', 'poids', 2, 1\.8/);
    expect(SQL).not.toMatch(/'poulet_chair', 'mali_doc00136', '(mortalite|consommation|production)'/);
  });

  it("recoupe le modèle source : aliment et ponte des premiers mois égaux à ceux de l'Excel (aux arrondis des morts près)", () => {
    const courbe = (v: number[]) => v.map((valeur, i) => ({ age: i + 1, valeur }));
    const r = simulerBandes({
      courbes: { mortalite: courbe(c.mortalite), consommation: courbe(c.consommation), production: courbe(c.production) },
      joursParMois: 30,
      dureeBandeMois: 19,
      bandes: [{ debutMois: 1, effectif: 1000 }],
      prix: { animal: 700, aliment: 210, produit: 2000 / 30, reforme: 2250 },
    });
    // Feuille « Parametre », ligne 27 : consommations mensuelles de 600, 1 152, 1 710, 1 833 et 2 251,2 kg.
    const excel = [600, 1152, 1710, 1833, 2251.2];
    excel.forEach((kg, i) => expect(Math.abs(r.mois[i + 1].alimentKg - kg) / kg).toBeLessThan(0.002));
    // Ligne 29 : 374,4 œufs par jour au 6e mois (936 poules × 40 %), soit 11 232 œufs dans le mois de 30 jours.
    expect(Math.abs(r.mois[6].production - 11232) / 11232).toBeLessThan(0.002);
    expect(r.coutAnimalPretAProduire?.moisImproductifs).toBe(5);
    expect(r.mois[19].ventesReformees).toBeGreaterThan(0);
  });
});

describe("assemblage des variantes", () => {
  type Courbe = Database["ref"]["Tables"]["courbes_age"]["Row"];
  type Param = Database["ref"]["Tables"]["parametres_elevage"]["Row"];
  const courbe = (o: Partial<Courbe>): Courbe => ({
    id: "x", speculation_code: "poule_pondeuse", variante: "v1", grandeur: "mortalite", age_mois: 1, valeur: 0.04, unite: "part", source: "DOC-X p. 1", date_source: "2026-11-27", notes: null,
    statut: "brouillon_ia", valide_par: null, valide_le: null, created_at: "", updated_at: "", ...o,
  });
  const param = (o: Partial<Param>): Param => ({
    id: "p", speculation_code: "poule_pondeuse", variante: "v1", code: "jours_par_mois", valeur: 30, unite: "jours", source: "DOC-Y p. 2", date_source: "2026-11-27", notes: null,
    statut: "validee", valide_par: null, valide_le: "2026-11-27T00:00:00Z", created_at: "", updated_at: "", ...o,
  });

  it("regroupe par variante, trie par âge, garde le statut le moins avancé et la liste des sources", () => {
    const v = assemblerVariantes(
      [courbe({ age_mois: 2, valeur: 0.01 }), courbe({ age_mois: 1 }), courbe({ variante: "v2", statut: "validee", valide_le: "2026-11-27T00:00:00Z" })],
      [param({}), param({ variante: "v2", code: "age_reforme_mois", valeur: 18, unite: "mois" })],
    );
    expect(v.map((x) => x.variante)).toEqual(["v1", "v2"]);
    expect(v[0].courbes.mortalite.map((p) => p.age)).toEqual([1, 2]);
    expect(v[0].statut).toBe("brouillon_ia");
    expect(v[0].sources).toEqual(["DOC-X p. 1", "DOC-Y p. 2"]);
    expect(v[0].parametres.jours_par_mois?.valeur).toBe(30);
    expect(v[1].statut).toBe("validee");
    expect(v[1].courbes.production).toEqual([]);
  });

  it("une ligne incohérente est signalée, pas ignorée", () => {
    expect(() => assemblerVariantes([courbe({ valeur: -1 })], [])).toThrow(ErreurReferentiel);
    expect(() => assemblerVariantes([], [param({ code: "inconnu" })])).toThrow(/incohérente/);
    expect(assemblerVariantes([], [])).toEqual([]);
  });
});
