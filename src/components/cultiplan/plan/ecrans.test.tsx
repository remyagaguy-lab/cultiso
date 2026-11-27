import { configure, render, screen, within } from "@testing-library/react";
import { calculerFinances, calculerFinancement } from "@/moteurs";
import { tomate2ha } from "@/moteurs/test-utils/tomate";
import { VueAccueil } from "./AccueilPlan";
import { VueBilan } from "./BilanSante";
import { VueMenage } from "./MenagePlan";
import { VuePlanFinancement } from "./PlanFinancement";
import { VueScenarios } from "./ScenariosPlan";
import { verdictEnUnePhrase } from "./verdict";

// Ant Design s'appuie sur ces deux API du navigateur, absentes de jsdom.
class ResizeObserverFactice {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverFactice;
window.matchMedia ??= ((requete: string) => ({ matches: false, media: requete, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
jest.setTimeout(60000);
configure({ asyncUtilTimeout: 20000 });

const resultats = calculerFinances({ ...tomate2ha, apport: 300_000, menage: { prelevementsAnnuels: 600_000 } });
const realiste = resultats.scenarios.realiste;

describe("verdict en une phrase", () => {
  it("reprend le statut, le prix minimum et ne contient ni emoji ni tiret cadratin", () => {
    const v = verdictEnUnePhrase(realiste);
    expect(["vert", "orange", "rouge"]).toContain(v.teinte);
    expect(v.phrase).toContain("tomate fraîche");
    expect(v.phrase).not.toMatch(/[—–]/u);
    expect(v.prixMinimum).toContain("au minimum");
  });

  it("dit que le projet perd de l'argent quand il est déficitaire", () => {
    const v = verdictEnUnePhrase({ ...realiste, statut: "deficitaire", verdict: { ...realiste.verdict, rentabilite: "deficitaire" } });
    expect(v.teinte).toBe("rouge");
    expect(v.phrase).toMatch(/perd de l'argent/);
  });

  it("signale une caisse négative ou un ménage non couvert comme « tient à peine »", () => {
    const v = verdictEnUnePhrase({ ...realiste, verdict: { rentabilite: "rentable", tresorerieToujoursPositive: false, menageCouvert: false } });
    expect(v.teinte).toBe("orange");
    expect(v.phrase).toMatch(/caisse devient négative/);
    expect(v.phrase).toMatch(/famille/);
  });
});

describe("écrans du plan", () => {
  it("l'accueil montre une phrase, un feu et trois chiffres", () => {
    render(<VueAccueil resultats={resultats} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Ton projet/);
    expect(screen.getByRole("heading", { name: /trois chiffres/i })).toBeInTheDocument();
    expect(screen.getByText("Le mois le plus difficile")).toBeInTheDocument();
  });

  it("les scénarios mettent le prix bas en premier et replient le tableau rendement × charges", () => {
    render(<VueScenarios resultats={resultats} />);
    const titres = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titres[0]).toBe("Si le prix baisse");
    expect(titres).toContain("Ce qui fait basculer ton projet");
    expect(screen.getByText("Pessimiste")).toBeInTheDocument();
    expect(screen.getByText(/Tableau rendement × charges/)).toBeInTheDocument();
  });

  it("le ménage montre la capacité de remboursement année par année et la caisse mois par mois", () => {
    render(<VueMenage scenario={realiste} />);
    const tableau = screen.getByRole("table", { name: /Capacité de remboursement et solde résiduel/i });
    expect(within(tableau).getAllByRole("row")).toHaveLength(realiste.annees.length + 1);
    expect(screen.getByRole("img", { name: /Point le plus bas/ })).toBeInTheDocument();
  });

  it("le bilan groupe les contrôles et dit le niveau en toutes lettres", () => {
    render(<VueBilan controles={realiste.controles} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getAllByText(/Rien à signaler|À surveiller|À régler|Pour information/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Trésorerie" })).toBeInTheDocument();
  });
});

describe("plan de financement (M6)", () => {
  it("montre ressources, emplois, apport et phrases du moteur", () => {
    const financement = calculerFinancement({
      horizonMois: 12,
      emploisInitiaux: { investissement: 600_000, bfr: 400_000 },
      apportEspeces: 300_000,
      apportsNature: [{ libelle: "Terre", valeur: 200_000 }],
      prets: [{ id: "p", libelle: "Prêt", moisTirage: 0, credit: { montant: 500_000, tauxAnnuel: 0.1, dureeMois: 24, differeMois: 0, typeDiffere: "partiel" } }],
    });
    render(<VuePlanFinancement r={{ planId: "x", financement, origines: ["Plan réaliste"], manques: [] }} />);
    expect(screen.getByRole("heading", { name: /Emplois/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ressources/ })).toBeInTheDocument();
    expect(screen.getByText(/Ton apport total/)).toBeInTheDocument();
    expect(screen.getByText(/sans pièce|Sans pièce/i)).toBeInTheDocument();
  });
});
