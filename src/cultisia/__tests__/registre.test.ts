/** @jest-environment node */
import { z } from "zod";
import type { Module } from "../modules";
import { registreParDefaut } from "../outils";
import { definirOutil, RegistreOutils } from "../outils/registre";

describe("registre d'outils", () => {
  const registre = registreParDefaut();
  const noms = (m: Module) => registre.pour(m).map((o) => o.nom).sort();

  it("filtre les outils par module", () => {
    expect(noms("cultima")).toContain("saisir_operation");
    expect(noms("cultima")).not.toContain("ouvrir_module");
    expect(noms("cultisia")).toContain("ouvrir_module");
    expect(noms("cultisia")).not.toContain("saisir_operation");
    expect(noms("cultiplan")).toEqual(["analyser_sensibilite", "calculer_credit", "calculer_plan", "chercher_savoir", "comparer_filieres", "confronter_existant", "diagnostiquer_plan", "lire_exploitation", "lire_prix", "lire_referentiel", "noter_reponses_consultation", "point_de_faisabilite", "prochaine_question_consultation"]);
  });

  it("convertit les schémas zod au format du modèle", () => {
    const saisir = registre.versFormatModele("cultima").find((o) => o.function.name === "saisir_operation");
    expect(saisir?.type).toBe("function");
    const params = saisir?.function.parameters as { type: string; properties: Record<string, unknown>; required: string[] };
    expect(params.type).toBe("object");
    expect(Object.keys(params.properties)).toEqual(expect.arrayContaining(["amount", "quantity", "unit_price", "type", "category"]));
    expect(params.required).toEqual(expect.arrayContaining(["type", "category"]));
    expect(params).not.toHaveProperty("$schema");
  });

  it("refuse un outil inconnu ou non permis dans le module", () => {
    expect(registre.valider("inventer_prix", "{}", "cultisia")).toEqual({ ok: false, erreur: expect.stringContaining("inconnu") });
    const r = registre.valider("saisir_operation", '{"amount":1,"type":"expense","category":"x"}', "cultisia");
    expect(r).toEqual({ ok: false, erreur: expect.stringContaining("n'est pas disponible") });
  });

  it("refuse les arguments invalides avec un message lisible", () => {
    expect(registre.valider("lire_prix", "{pas du json", "cultisia").ok).toBe(false);
    const invalide = registre.valider("saisir_operation", '{"amount":-5,"type":"don","category":""}', "cultima");
    expect(invalide.ok).toBe(false);
    if (!invalide.ok) expect(invalide.erreur).toMatch(/amount|type|category/);
    expect(registre.valider("saisir_operation", '{"type":"expense","category":"Engrais"}', "cultima").ok).toBe(false);
  });

  it("accepte des arguments valides", () => {
    const r = registre.valider("lire_referentiel", '{"type":"zone"}', "cultiplan");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.args).toEqual({ type: "zone" });
    expect(registre.valider("lire_exploitation", "", "cultima").ok).toBe(true);
  });

  it("empêche une action de s'exécuter côté serveur, et une lecture d'en être privée", () => {
    const r = new RegistreOutils();
    const actionExecutable = definirOutil({
      nom: "a",
      description: "",
      famille: "action",
      modules: "tous",
      schema: z.object({}),
      executer: async () => ({ contenu: "" }),
    });
    expect(() => r.ajouter(actionExecutable)).toThrow(/ne doit pas s'exécuter/);
    const lectureVide = definirOutil({ nom: "l", description: "", famille: "lecture", modules: "tous", schema: z.object({}) });
    expect(() => r.ajouter(lectureVide)).toThrow(/doit déclarer/);
  });

  it("refuse deux outils de même nom", () => {
    const outil = definirOutil({ nom: "x", description: "", famille: "orientation", modules: "tous", schema: z.object({}) });
    expect(() => new RegistreOutils([outil, outil])).toThrow(/déjà déclaré/);
  });
});
