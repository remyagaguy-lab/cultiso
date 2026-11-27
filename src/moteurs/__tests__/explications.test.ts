/** @jest-environment node */
// S8 : langage simple. Les textes sont des données (donnees/explications.json) : on vérifie qu'ils couvrent tout, et qu'ils restent simples.
import { CODES_CONTROLE } from "../controles";
import { calculerFinances } from "../finance";
import {
  clesIndicateurs,
  controlesSansExplication,
  expliquerControle,
  expliquerControles,
  expliquerIndicateur,
  lexique,
  lexiqueEnMarkdown,
} from "../explications";
import donnees from "../donnees/explications.json";
import { tomate2ha } from "../test-utils/tomate";

// Sigles et mots de métier qui n'ont pas leur place dans la phrase simple (ils vont dans la version technique ou le lexique).
const JARGON = ["EBE", "CAF", "BFR", "VAN", "TRI", "SYSCOHADA", "SPBN", "MAPAQ", "RLS", "ratio", "actualis"];

describe("S8 : explications en langage simple", () => {
  it("chaque code de contrôle et d'alerte a une explication", () => {
    expect(controlesSansExplication()).toEqual([]);
    for (const code of CODES_CONTROLE) expect(expliquerControle(code)?.simple.length).toBeGreaterThan(20);
  });

  it("les indicateurs demandés par le fondateur sont expliqués", () => {
    for (const cle of ["capaciteRemboursement", "pointBasTresorerie", "seuilCommercialisation", "soldeResiduel", "van", "tri", "prixEquilibre", "testPrixBas"]) {
      expect(expliquerIndicateur(cle)).toBeDefined();
    }
  });

  it("tous les champs d'une année et tous les ratios du moteur ont une explication", () => {
    const s = calculerFinances({ ...tomate2ha, apport: 400_000, credit: { montant: 1_000_000, tauxAnnuel: 0.24, dureeMois: 24 }, menage: { prelevementsAnnuels: 500_000 } }).scenarios.realiste;
    const annee = Object.keys(s.annees[0]).filter((k) => k !== "an" && k !== "salaires" && k !== "margeAvantInteretsSalairesAmortissements");
    const ratios = Object.keys(s.ratios);
    for (const cle of [...annee, ...ratios]) expect(clesIndicateurs()).toContain(cle);
  });

  it("la phrase simple ne contient ni sigle ni jargon, et la version technique existe", () => {
    for (const f of [...donnees.indicateurs, ...donnees.controles]) {
      for (const mot of JARGON) expect(`${f.nom} ${f.simple}`).not.toMatch(new RegExp(`\\b${mot}`));
      expect(f.technique.length).toBeGreaterThan(10);
      expect(f.simple).not.toBe(f.technique);
    }
  });

  it("clés uniques", () => {
    for (const liste of [donnees.indicateurs, donnees.controles]) expect(new Set(liste.map((f) => f.cle)).size).toBe(liste.length);
  });

  it("expliquerControles joint nom, phrase simple et version technique à chaque contrôle sans changer le contrôle", () => {
    const controles = calculerFinances({ ...tomate2ha, apport: 0 }).scenarios.realiste.controles;
    const expliques = expliquerControles(controles);
    expect(expliques).toHaveLength(controles.length);
    expliques.forEach((e, i) => {
      expect(e.code).toBe(controles[i].code);
      expect(e.message).toBe(controles[i].message);
      expect(e.simple.length).toBeGreaterThan(10);
      expect(e.technique.length).toBeGreaterThan(10);
    });
  });

  it("lexique : trié, sans doublon, et défini en Markdown pour l'export", () => {
    const l = lexique();
    expect(l.length).toBeGreaterThanOrEqual(20);
    expect(l.map((e) => e.terme)).toEqual([...l.map((e) => e.terme)].sort((a, b) => a.localeCompare(b, "fr")));
    expect(new Set(l.map((e) => e.terme)).size).toBe(l.length);
    const termes = l.map((e) => e.terme.toLowerCase());
    for (const t of ["apport", "capacité de remboursement", "point bas", "seuil de commercialisation", "brouillon ia"]) expect(termes).toContain(t);
    const md = lexiqueEnMarkdown();
    expect(md).toMatch(/^# Lexique/);
    expect(md).toContain("**Point bas** :");
  });
});
