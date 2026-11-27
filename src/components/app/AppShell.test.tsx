import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppWorkspaceProvider } from "./AppWorkspaceContext";
import { AppShell } from "./AppShell";
import DashboardPage from "@/app/(app)/dashboard/page";

// Mock next/navigation
const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: jest.fn(),
  }),
}));

// Mock next/link
jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
});

// Mock Supabase client
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "user-1",
            email: "remy@cultiso.com",
            user_metadata: { full_name: "Rémy Guy", role: "fondateur" },
            app_metadata: { tokens_balance: 20000 },
          },
        },
      }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

// Mock SharedChat to keep tests focused on AppShell & Dashboard
jest.mock("@/components/cultisia/SharedChat", () => ({
  SharedChat: ({ toolContext }: { toolContext: string }) => (
    <div data-testid="mock-shared-chat">Chat {toolContext}</div>
  ),
}));

// Mock price server action
jest.mock("@/app/actions/priceActions", () => ({
  getFilteredPrices: async () => ({
    data: [
      {
        id: "p1",
        price: 210,
        location: "Kpalimé",
        record_date: "2026-11-20",
        product_id: "prod-1",
        product: {
          id: "prod-1",
          name: "Maïs blanc",
          category: "Céréales",
          default_unit: "kg",
        },
      },
    ],
  }),
}));

// Polyfill showModal/close for JSDOM <dialog> & ResizeObserver for Ant Design
beforeAll(() => {
  if (typeof global.ResizeObserver === "undefined") {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "true");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

describe("AppShell & DashboardPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("affiche la navigation hiérarchisée et la topbar unifiée", async () => {
    render(
      <AppWorkspaceProvider>
        <AppShell>
          <DashboardPage />
        </AppShell>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bonjour Rémy/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText("Pilotage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Modules Cultiso").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prochainement").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cours des prix").length).toBeGreaterThan(0);
  });

  it("permet d'ouvrir le panneau latéral Cultisia depuis la topbar", async () => {
    render(
      <AppWorkspaceProvider>
        <AppShell>
          <DashboardPage />
        </AppShell>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bonjour Rémy/i)).toBeInTheDocument();
    });

    const cultisiaButtons = screen.getAllByRole("button", { name: /Cultisia/i });
    fireEvent.click(cultisiaButtons[0]);

    expect(screen.getByTestId("mock-shared-chat")).toBeInTheDocument();
  });

  it("permet d'ajouter une tâche du jour et de filtrer les onglets Cultiplan", async () => {
    render(
      <AppWorkspaceProvider>
        <AppShell>
          <DashboardPage />
        </AppShell>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bonjour Rémy/i)).toBeInTheDocument();
    });

    const taskInput = screen.getByLabelText("Ajouter une tâche du jour");
    fireEvent.change(taskInput, { target: { value: "Acheter engrais NPK" } });
    fireEvent.submit(taskInput.closest("form")!);

    expect(screen.getByText("Acheter engrais NPK")).toBeInTheDocument();

    const doneTab = screen.getByRole("tab", { name: /Finalisés/i });
    fireEvent.click(doneTab);
    expect(doneTab).toHaveAttribute("aria-selected", "true");
  });

  it("ouvre la palette de commandes (⌘K) depuis la topbar et filtre les résultats", async () => {
    render(
      <AppWorkspaceProvider>
        <AppShell>
          <DashboardPage />
        </AppShell>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Bonjour Rémy/i)).toBeInTheDocument();
    });

    const cmdBtn = screen.getByRole("button", {
      name: /Rechercher ou exécuter une commande/i,
    });
    fireEvent.click(cmdBtn);

    const searchInput = screen.getByLabelText("Rechercher dans Cultiso");
    expect(searchInput).toBeInTheDocument();
    fireEvent.change(searchInput, { target: { value: "Trésorerie" } });
    expect(
      screen.getByText(/Ouvrir la Trésorerie \(Cultima\)/i)
    ).toBeInTheDocument();
  });
});
