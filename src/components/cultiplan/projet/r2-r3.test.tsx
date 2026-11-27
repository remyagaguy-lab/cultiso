import { configure, render, screen } from "@testing-library/react";
import { calculerMainOeuvre } from "@/moteurs";
import { analyserDebouches } from "@/modules/cultiplan/debouches";
import { VueDebouches } from "./Debouches";
import { VueMainOeuvre } from "./MainOeuvre";

class ResizeObserverFactice {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverFactice;
window.matchMedia ??= ((requete: string) => ({ matches: false, media: requete, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
jest.setTimeout(60000);
configure({ asyncUtilTimeout: 20000 });

describe("main d'oeuvre (R2)", () => {
  it("montre les mois en pointe et le travail de la famille", () => {
    const mainOeuvre = calculerMainOeuvre({
      membres: [{ id: "f1", libelle: "Toi", type: "famille", heuresParMois: 100 }],
      besoinsHeuresParMois: [50, 50, 50, 300, 50, 50, 50, 50, 50, 50, 50, 50],
      prixHeure: { valeur: 500, source: "salaire local relevé" },
    });
    render(<VueMainOeuvre r={{ exploitationId: "x", mainOeuvre, origines: [] }} />);
    expect(screen.getByText(/1 mois en pointe/)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /Besoin et capacité/ })).toBeInTheDocument();
    expect(screen.getByText("Ce que vaut le travail de ta famille")).toBeInTheDocument();
  });
});

describe("débouchés (R3)", () => {
  it("montre les circuits et le volume sans acheteur", () => {
    const debouches = analyserDebouches(
      {
        produit: "Tomate",
        unite: "kg",
        volumeAn: { pessimiste: 800, realiste: 1000, optimiste: 1200 },
        circuits: [{ circuit: "marche_local", part: 0.5, client: "Revendeuses", prix: 300 }],
      },
      [{ code: "marche_local", libelle: "Marché local", contractuel: false }],
    );
    render(<VueDebouches r={debouches} />);
    expect(screen.getByText("Une part n'a pas d'acheteur")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /par circuit/ })).toBeInTheDocument();
    expect(screen.getByText("Revendeuses")).toBeInTheDocument();
  });
});
