"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface CultisoWorkspace {
  id: string;
  name: string;
  domain: string | null;
  status: string | null;
  surface_area: number | null;
  surface_unit: string | null;
  location: string | null;
  isDemo?: boolean;
}

export interface BusinessPlanSummary {
  id: string;
  title: string;
  cultiso_id: string | null;
  market_data: Record<string, unknown> | null;
  technical_data: Record<string, unknown> | null;
  financial_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionSummary {
  id: string;
  cultiso_id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  description: string | null;
}

interface AppWorkspaceContextValue {
  user: User | null;
  userDisplayName: string;
  userInitials: string;
  userRole: string;
  tokensBalance: number;
  workspaces: CultisoWorkspace[];
  activeWorkspace: CultisoWorkspace;
  setActiveWorkspaceId: (id: string) => void;
  businessPlans: BusinessPlanSummary[];
  transactions: TransactionSummary[];
  loadingData: boolean;
  refreshWorkspaceData: () => Promise<void>;
  isCommandOpen: boolean;
  openCommand: () => void;
  closeCommand: () => void;
  isCultisiaOpen: boolean;
  cultisiaContext: "cultisia" | "cultiplan" | "cultima" | "cultiseil";
  openCultisia: (context?: "cultisia" | "cultiplan" | "cultima" | "cultiseil") => void;
  closeCultisia: () => void;
  toggleCultisia: (context?: "cultisia" | "cultiplan" | "cultima" | "cultiseil") => void;
}

const DEMO_WORKSPACE: CultisoWorkspace = {
  id: "demo-ferme-espoir",
  name: "Ferme Espoir",
  domain: "Polyculure & Élevage",
  status: "demo",
  surface_area: 12,
  surface_unit: "ha",
  location: "Kpalimé, Togo",
  isDemo: true,
};

const ACTIVE_WS_STORAGE_KEY = "cultiso_active_workspace_id";

const AppWorkspaceContext = createContext<AppWorkspaceContextValue | null>(null);

export function AppWorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<CultisoWorkspace[]>([
    DEMO_WORKSPACE,
  ]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>(
    DEMO_WORKSPACE.id
  );
  const [businessPlans, setBusinessPlans] = useState<BusinessPlanSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isCultisiaOpen, setIsCultisiaOpen] = useState(false);
  const [cultisiaContext, setCultisiaContext] = useState<
    "cultisia" | "cultiplan" | "cultima" | "cultiseil"
  >("cultisia");

  const fetchWorkspaceSnapshot = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return {
        authUser: null,
        fetchedWorkspaces: [DEMO_WORKSPACE] as CultisoWorkspace[],
        nextActiveId: DEMO_WORKSPACE.id,
        plans: [] as BusinessPlanSummary[],
        txs: [] as TransactionSummary[],
      };
    }

    // Query user's farms/projects (cultisos) and business plans in parallel.
    // Note: cultisos & transactions are not typed in src/types/supabase.ts yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const untypedClient = supabase as any;

    const [cultisosRes, plansRes] = await Promise.all([
      untypedClient
        .from("cultisos")
        .select(
          "id, name, domain, status, surface_area, surface_unit, location"
        )
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("business_plans")
        .select(
          "id, title, cultiso_id, market_data, technical_data, financial_data, created_at, updated_at"
        )
        .eq("user_id", authUser.id)
        .order("updated_at", { ascending: false }),
    ]);

    const fetchedWorkspaces: CultisoWorkspace[] =
      Array.isArray(cultisosRes.data) && cultisosRes.data.length > 0
        ? (cultisosRes.data as CultisoWorkspace[])
        : [DEMO_WORKSPACE];

    const savedId =
      typeof window !== "undefined"
        ? localStorage.getItem(ACTIVE_WS_STORAGE_KEY)
        : null;
    const validSaved = fetchedWorkspaces.find((w) => w.id === savedId);
    const nextActiveId = validSaved ? validSaved.id : fetchedWorkspaces[0].id;

    const plans = Array.isArray(plansRes.data)
      ? (plansRes.data as BusinessPlanSummary[])
      : [];

    let txs: TransactionSummary[] = [];
    if (!nextActiveId.startsWith("demo-")) {
      const txRes = await untypedClient
        .from("transactions")
        .select("id, cultiso_id, amount, type, category, date, description")
        .eq("cultiso_id", nextActiveId)
        .order("date", { ascending: false })
        .limit(30);
      txs = Array.isArray(txRes.data) ? (txRes.data as TransactionSummary[]) : [];
    }

    return { authUser, fetchedWorkspaces, nextActiveId, plans, txs };
  }, [supabase]);

  const applySnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof fetchWorkspaceSnapshot>>) => {
      setUser(snapshot.authUser);
      setWorkspaces(snapshot.fetchedWorkspaces);
      setActiveWorkspaceIdState(snapshot.nextActiveId);
      setBusinessPlans(snapshot.plans);
      setTransactions(snapshot.txs);
    },
    []
  );

  const loadWorkspaceData = useCallback(async () => {
    setLoadingData(true);
    try {
      const snapshot = await fetchWorkspaceSnapshot();
      applySnapshot(snapshot);
    } catch (error) {
      console.error("Erreur lors du chargement de l'espace Cultiso:", error);
    } finally {
      setLoadingData(false);
    }
  }, [fetchWorkspaceSnapshot, applySnapshot]);

  useEffect(() => {
    let cancelled = false;
    fetchWorkspaceSnapshot()
      .then((snapshot) => {
        if (!cancelled) {
          applySnapshot(snapshot);
        }
      })
      .catch((error) => {
        console.error("Erreur lors du chargement de l'espace Cultiso:", error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingData(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchWorkspaceSnapshot, applySnapshot]);

  // Global keyboard shortcut Cmd+K / Ctrl+K for Command Palette
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const setActiveWorkspaceId = useCallback(
    async (id: string) => {
      setActiveWorkspaceIdState(id);
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_WS_STORAGE_KEY, id);
      }
      if (!id.startsWith("demo-") && user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const untypedClient = supabase as any;
        const txRes = await untypedClient
          .from("transactions")
          .select("id, cultiso_id, amount, type, category, date, description")
          .eq("cultiso_id", id)
          .order("date", { ascending: false })
          .limit(30);
        setTransactions(
          Array.isArray(txRes.data) ? (txRes.data as TransactionSummary[]) : []
        );
      } else {
        setTransactions([]);
      }
    },
    [supabase, user]
  );

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? DEMO_WORKSPACE,
    [workspaces, activeWorkspaceId]
  );

  const userDisplayName = useMemo(() => {
    const meta = user?.user_metadata;
    if (meta?.full_name && typeof meta.full_name === "string") {
      return meta.full_name;
    }
    if (meta?.name && typeof meta.name === "string") {
      return meta.name;
    }
    if (user?.email) {
      const prefix = user.email.split("@")[0] ?? "Agripreneur";
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return "Agripreneur";
  }, [user]);

  const userInitials = useMemo(() => {
    const parts = userDisplayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userDisplayName.slice(0, 2).toUpperCase() || "CU";
  }, [userDisplayName]);

  const userRole = useMemo(() => {
    const role = user?.user_metadata?.role;
    if (typeof role === "string" && role.trim()) {
      return role.replace(/_/g, " ");
    }
    return "Agripreneur";
  }, [user]);

  const tokensBalance = useMemo(() => {
    const raw = user?.app_metadata?.tokens_balance;
    return typeof raw === "number" ? raw : 20000;
  }, [user]);

  const openCommand = useCallback(() => setIsCommandOpen(true), []);
  const closeCommand = useCallback(() => setIsCommandOpen(false), []);

  const openCultisia = useCallback(
    (context: "cultisia" | "cultiplan" | "cultima" | "cultiseil" = "cultisia") => {
      setCultisiaContext(context);
      setIsCultisiaOpen(true);
    },
    []
  );
  const closeCultisia = useCallback(() => setIsCultisiaOpen(false), []);
  const toggleCultisia = useCallback(
    (context: "cultisia" | "cultiplan" | "cultima" | "cultiseil" = "cultisia") => {
      setCultisiaContext(context);
      setIsCultisiaOpen((prev) => !prev);
    },
    []
  );

  const value: AppWorkspaceContextValue = {
    user,
    userDisplayName,
    userInitials,
    userRole,
    tokensBalance,
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    businessPlans,
    transactions,
    loadingData,
    refreshWorkspaceData: loadWorkspaceData,
    isCommandOpen,
    openCommand,
    closeCommand,
    isCultisiaOpen,
    cultisiaContext,
    openCultisia,
    closeCultisia,
    toggleCultisia,
  };

  return (
    <AppWorkspaceContext.Provider value={value}>
      {children}
    </AppWorkspaceContext.Provider>
  );
}

export function useAppWorkspace() {
  const ctx = useContext(AppWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useAppWorkspace doit être utilisé à l'intérieur de AppWorkspaceProvider."
    );
  }
  return ctx;
}
