/** @jest-environment jsdom */
// Interface Cultiplan : phrase simple visible, version technique dépliable, choix du financeur.
import { fireEvent, render, screen } from "@testing-library/react";
import type { Controle } from "@/moteurs/controles";
import type { RegleFinanceurRef } from "@/referentiel";
import { ChoixFinanceur } from "../ChoixFinanceur";
import { ControlesExpliques } from "../ControlesExpliques";
import { IndicateurExplique } from "../IndicateurExplique";

const controle: Controle = {
  code: "ALERTE_POINT_BAS_NON_COUVERT",
  niveau: "alerte",
  valeurs: { pointBas: -500000, mois: 3 },
  message: "Prudence : au mois 3, il manque 500 000 FCFA.",
};

const anpgf: RegleFinanceurRef = {
  id: "1", organisme: "ANPGF", produit: "projet_demarrage", libelle: "Projet en démarrage", pays: "TG",
  apportMinimum: 0.2, dureeMaxMois: 48, dureeInclutDiffere: true, differeMaxMois: 12, tauxIndicatif: null,
  taxes: [], piecesExigees: ["Plan d'affaires"], formatDossier: null, notes: null, statut: "brouillon_ia", source: "Canevas ANPGF",
};

describe("ControlesExpliques", () => {
  it("affiche la phrase du moteur et la phrase simple, et cache le détail technique jusqu'au clic", () => {
    render(<ControlesExpliques controles={[controle]} />);
    expect(screen.getByText(controle.message)).toBeVisible();
    expect(screen.getByText("À surveiller")).toBeVisible();
    expect(screen.queryByText("Code : ALERTE_POINT_BAS_NON_COUVERT")).toBeNull();
    fireEvent.click(screen.getByText("Détail technique"));
    expect(screen.getByText("Code : ALERTE_POINT_BAS_NON_COUVERT")).toBeInTheDocument();
    expect(screen.getByText("pointBas")).toBeInTheDocument();
  });

  it("classe le bloquant avant l'alerte, ignore les contrôles « ok » et dit quand il n'y a rien", () => {
    const bloquant: Controle = { ...controle, code: "TRESORERIE_NEGATIVE", niveau: "bloquant", message: "Caisse vide." };
    const ok: Controle = { ...controle, niveau: "ok", message: "Tout va bien." };
    const { container, rerender } = render(<ControlesExpliques controles={[controle, ok, bloquant]} />);
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Caisse vide.");
    expect(screen.queryByText("Tout va bien.")).toBeNull();
    rerender(<ControlesExpliques controles={[ok]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Aucun point d'attention");
  });
});

describe("IndicateurExplique", () => {
  it("montre le chiffre et sa phrase simple ; rien pour un indicateur inconnu", () => {
    const { container, rerender } = render(<IndicateurExplique cle="pointBasTresorerie" valeur="-500 000 FCFA" />);
    expect(screen.getByText("-500 000 FCFA")).toBeVisible();
    expect(screen.getByText(/ta caisse est au plus bas/)).toBeVisible();
    rerender(<IndicateurExplique cle="inconnu" valeur="1" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ChoixFinanceur", () => {
  it("résume la règle choisie, dit « non connu » pour une valeur absente et signale le brouillon", () => {
    render(<ChoixFinanceur financeurs={[anpgf]} choisi={anpgf} onChoisir={() => undefined} />);
    expect(screen.getByText("20 % du coût du projet")).toBeVisible();
    expect(screen.getByText("4 ans, différé compris")).toBeVisible();
    expect(screen.getByText("non connu")).toBeVisible();
    expect(screen.getByText("À confirmer par un expert")).toBeVisible();
    expect(screen.getByText(/Source : Canevas ANPGF/)).toBeVisible();
  });

  it("sans choix, n'affiche aucun résumé ; le libellé est relié au champ", () => {
    render(<ChoixFinanceur financeurs={[anpgf]} choisi={null} onChoisir={() => undefined} />);
    expect(screen.queryByText("À confirmer par un expert")).toBeNull();
    expect(screen.getByLabelText("Quel financeur vises-tu ?")).toBeInTheDocument();
  });
});
