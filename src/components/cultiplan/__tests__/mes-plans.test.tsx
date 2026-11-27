/** @jest-environment jsdom */
// Liste « Mes plans » : chargement, liste avec lien vers le diagnostic, état vide, erreur.
import { render, screen } from "@testing-library/react";
import type { PlanDeLaListe } from "@/modules/cultiplan";
import { MesPlans } from "../MesPlans";
import { appeler } from "../appeler";

jest.mock("../appeler", () => ({ appeler: jest.fn() }));
const appel = appeler as jest.MockedFunction<typeof appeler>;

const plan: PlanDeLaListe = {
  id: "p1", exploitationId: "e1", exploitationNom: "Ferme de Kara", titre: "Tomate 2 ha", version: 2, varianteDe: null,
  statut: "brouillon", versionMoteur: "1.7.0", moteurObsolete: false, calculeLe: null, majLe: "2026-11-27T10:00:00Z",
};

describe("MesPlans", () => {
  beforeEach(() => appel.mockReset());

  it("liste les plans, chacun relié à son diagnostic", async () => {
    appel.mockResolvedValue([plan, { ...plan, id: "p2", titre: "Et si le prix baisse ?", varianteDe: "p1" }]);
    render(<MesPlans />);
    const lien = await screen.findByRole("link", { name: /Tomate 2 ha/ });
    expect(lien).toHaveAttribute("href", "/cultiplan/plans/p1");
    expect(lien).toHaveTextContent("Ferme de Kara");
    expect(lien).toHaveTextContent("version 2");
    expect(screen.getByRole("link", { name: /Et si le prix baisse/ })).toHaveTextContent("Et si ?");
    expect(appel).toHaveBeenCalledWith("/api/cultiplan/plans");
  });

  it("dit clairement quand il n'y a aucun plan", async () => {
    appel.mockResolvedValue([]);
    render(<MesPlans />);
    expect(await screen.findByText(/pas encore de plan/)).toBeInTheDocument();
  });

  it("affiche l'erreur lisible quand le chargement échoue", async () => {
    appel.mockRejectedValue(new Error("Connecte-toi pour voir tes plans."));
    render(<MesPlans />);
    expect(await screen.findByText("Connecte-toi pour voir tes plans.")).toBeInTheDocument();
  });
});
