"use client";

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AddCircleIcon,
  ArrowRightIcon,
  Chart2Icon,
  WalletMoneyIcon,
  GraphNewUpIcon,
  SproutIcon,
  BoneIcon,
  FactoryIcon,
  ScaleIcon,
  WrenchIcon,
  MagnifierIcon,
  TrashBinTrashIcon,
  Bag2Icon,
  UserCheckIcon,
  DocumentTextIcon,
  CloudSunIcon,
  CompassIcon,
  CheckCircleIcon,
} from "@solar-icons/react/linear";
import {
  Chart2Icon as Chart2BoldDuotoneIcon,
  WalletMoneyIcon as WalletMoneyBoldDuotoneIcon,
  StarsIcon as StarsBoldDuotoneIcon,
  MapPointIcon as MapPointBoldDuotoneIcon,
  GraphNewUpIcon as GraphNewUpBoldDuotoneIcon,
  ShieldCheckIcon as ShieldCheckBoldDuotoneIcon,
  DangerTriangleIcon as DangerTriangleBoldDuotoneIcon,
} from "@solar-icons/react/bold-duotone";
import { useAppWorkspace } from "@/components/app/AppWorkspaceContext";
import { getLocalItem, setLocalItem, subscribeLocalStore } from "@/components/app/localStore";
import { getFilteredPrices } from "@/app/actions/priceActions";
import type { PriceRecord } from "@/types/prices";
import {
  DEMO_ATELIERS,
  DEMO_CASHFLOW_SERIES,
  DEMO_DECISION_ALERTS,
  DEMO_FARM_SUMMARY,
} from "@/components/dashboard/demoFarmData";
import { DashboardTour } from "@/components/dashboard/DashboardTour";

interface TaskItem {
  id: string;
  title: string;
  priority: "urgent" | "normal";
  done: boolean;
}

type PlanFilter = "all" | "draft" | "done";

const TOUR_STORAGE_KEY = "cultiso_dashboard_tour_done";

const DEFAULT_STARTER_TASKS: TaskItem[] = [
  {
    id: "starter-1",
    title: "Commander 1,5 t de provende croissance (Bande B-14)",
    priority: "urgent",
    done: false,
  },
  {
    id: "starter-2",
    title: "Valider le traitement préventif Tomate irriguée (06h-09h)",
    priority: "urgent",
    done: false,
  },
  {
    id: "starter-3",
    title: "Modéliser un business plan dans Cultiplan",
    priority: "normal",
    done: false,
  },
  {
    id: "starter-4",
    title: "Vérifier les derniers cours du maïs sur Lomé",
    priority: "normal",
    done: false,
  },
];

const CULTIMA_POLES = [
  {
    id: "vegetal",
    label: "Végétal",
    desc: "Parcelles & rendements",
    icon: SproutIcon,
  },
  {
    id: "animal",
    label: "Élevage",
    desc: "Bandes & zootechnie",
    icon: BoneIcon,
  },
  {
    id: "transformation",
    label: "Transformation",
    desc: "Lots & qualité",
    icon: FactoryIcon,
  },
  {
    id: "service",
    label: "Services",
    desc: "Missions & flotte",
    icon: WrenchIcon,
  },
  {
    id: "negoce",
    label: "Négoce",
    desc: "Stocks & marchés",
    icon: ScaleIcon,
  },
  {
    id: "finance",
    label: "Trésorerie",
    desc: "Recettes & dépenses",
    icon: WalletMoneyIcon,
  },
];

function formatFcfa(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value))} FCFA`;
}

function formatDateShort(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function DashboardPage() {
  const {
    userDisplayName,
    activeWorkspace,
    businessPlans,
    transactions,
    loadingData,
    openCultisia,
  } = useAppWorkspace();

  const isDemo = Boolean(activeWorkspace.isDemo);

  const firstName = useMemo(
    () => userDisplayName.split(" ")[0] || "Agripreneur",
    [userDisplayName]
  );

  // Visite guidée : ouverture automatique la 1ère fois sur l'espace démo (hors jsdom)
  const [isTourOpen, setIsTourOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (navigator.userAgent.toLowerCase().includes("jsdom")) return;
    if (!isDemo) return;
    if (getLocalItem(TOUR_STORAGE_KEY) !== "true") {
      const timer = window.setTimeout(() => setIsTourOpen(true), 450);
      return () => window.clearTimeout(timer);
    }
  }, [isDemo]);

  const handleCloseTour = () => {
    setIsTourOpen(false);
    setLocalItem(TOUR_STORAGE_KEY, "true");
  };

  // Market pill from real Supabase price records
  const [latestPrice, setLatestPrice] = useState<PriceRecord | null>(null);
  useEffect(() => {
    let active = true;
    getFilteredPrices({})
      .then((res) => {
        if (active && res.data && res.data.length > 0) {
          const maize = res.data.find((r) =>
            r.product?.name?.toLowerCase().includes("maïs")
          );
          setLatestPrice(maize ?? res.data[0]);
        }
      })
      .catch(() => {
        // Silent fallback when offline or unconfigured
      });
    return () => {
      active = false;
    };
  }, []);

  // LocalStorage draft from Cultiplan
  const rawDraft = useSyncExternalStore(
    subscribeLocalStore,
    () => getLocalItem("cultiplan_latest"),
    () => null
  );

  const localDraftTitle = useMemo(() => {
    if (!rawDraft) return null;
    try {
      const parsed = JSON.parse(rawDraft);
      const title =
        parsed?.synthese?.fiche_synoptique?.nom_entreprise ||
        parsed?.projet?.nom_projet ||
        parsed?.meta?.titre ||
        "Simulation en cours (brouillon local)";
      return String(title);
    } catch {
      return null;
    }
  }, [rawDraft]);

  // Tasks checklist persisted per workspace in localStorage
  const tasksStorageKey = `cultiso_tasks_${activeWorkspace.id}`;
  const rawTasks = useSyncExternalStore(
    subscribeLocalStore,
    () => getLocalItem(tasksStorageKey),
    () => null
  );

  const tasks = useMemo<TaskItem[]>(() => {
    if (!rawTasks) return DEFAULT_STARTER_TASKS;
    try {
      const parsed = JSON.parse(rawTasks);
      if (Array.isArray(parsed)) return parsed as TaskItem[];
    } catch {
      // ignore storage errors
    }
    return DEFAULT_STARTER_TASKS;
  }, [rawTasks]);

  const [newTaskTitle, setNewTaskTitle] = useState("");

  const persistTasks = (next: TaskItem[]) => {
    setLocalItem(tasksStorageKey, JSON.stringify(next));
  };

  const handleToggleTask = (id: string) => {
    persistTasks(
      tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    const item: TaskItem = {
      id: `task-${Date.now()}`,
      title: trimmed,
      priority: "normal",
      done: false,
    };
    persistTasks([item, ...tasks]);
    setNewTaskTitle("");
  };

  const handleDeleteTask = (id: string) => {
    persistTasks(tasks.filter((t) => t.id !== id));
  };

  // Business Plans tabs & search
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [planSearch, setPlanSearch] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const normalizedPlans = useMemo(() => {
    const remote = businessPlans.map((bp) => {
      const hasFinancial =
        bp.financial_data && Object.keys(bp.financial_data).length > 0;
      const hasTechnical =
        bp.technical_data && Object.keys(bp.technical_data).length > 0;
      const hasMarket =
        bp.market_data && Object.keys(bp.market_data).length > 0;
      const progress = hasFinancial
        ? 100
        : hasTechnical
          ? 70
          : hasMarket
            ? 40
            : 25;
      return {
        id: bp.id,
        title: bp.title,
        subtitle: `Modifié le ${formatDateShort(bp.updated_at)}`,
        status: progress === 100 ? ("done" as const) : ("draft" as const),
        progress,
        isLocal: false,
      };
    });

    if (localDraftTitle) {
      remote.unshift({
        id: "local-draft",
        title: localDraftTitle,
        subtitle: "Sauvegardé dans ce navigateur",
        status: "draft" as const,
        progress: 60,
        isLocal: true,
      });
    }
    return remote;
  }, [businessPlans, localDraftTitle]);

  const filteredPlans = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    return normalizedPlans.filter((p) => {
      const matchTab = planFilter === "all" || p.status === planFilter;
      const matchQuery = !q || p.title.toLowerCase().includes(q);
      return matchTab && matchQuery;
    });
  }, [normalizedPlans, planFilter, planSearch]);

  // Treasury summary from real transactions
  const treasuryStats = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);
    return {
      income,
      expense,
      net: income - expense,
      count: transactions.length,
    };
  }, [transactions]);

  const tasksSummary = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.done).length;
    const remaining = total - completed;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, remaining, pct };
  }, [tasks]);

  const tabItems: { id: PlanFilter; label: string; count: number }[] = [
    { id: "all", label: "Tous", count: normalizedPlans.length },
    {
      id: "draft",
      label: "En cours",
      count: normalizedPlans.filter((p) => p.status === "draft").length,
    },
    {
      id: "done",
      label: "Finalisés",
      count: normalizedPlans.filter((p) => p.status === "done").length,
    },
  ];

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabItems.length;
    else if (e.key === "ArrowLeft")
      nextIdx = (idx - 1 + tabItems.length) % tabItems.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabItems.length - 1;
    else return;

    e.preventDefault();
    setPlanFilter(tabItems[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
  };

  const displayedCashNet = isDemo
    ? DEMO_FARM_SUMMARY.cashBalanceFcfa
    : treasuryStats.net;

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ─── 1. Bandeau de Contexte & Pilotage ─── */}
      <section
        data-tour="workspace-banner"
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-title font-bold text-foreground tracking-[-0.02em] m-0">
              Bonjour {firstName}
            </h1>
            {isDemo && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand border border-[var(--ork-use-border-selected)]">
                Mode Démo · Données simulées
              </span>
            )}
          </div>
          <p className="text-[13.5px] text-muted m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-semibold text-foreground">
              {activeWorkspace.name}
            </span>
            {activeWorkspace.location && (
              <span className="inline-flex items-center gap-1">
                <MapPointBoldDuotoneIcon className="w-3.5 h-3.5 text-t-brand" aria-hidden="true" />
                {activeWorkspace.location}
              </span>
            )}
            {activeWorkspace.surface_area && (
              <span>
                · {activeWorkspace.surface_area}{" "}
                {activeWorkspace.surface_unit || "ha"}
              </span>
            )}
            {isDemo && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                · <CloudSunIcon className="w-3.5 h-3.5 text-t-action" aria-hidden="true" />
                {DEMO_FARM_SUMMARY.weatherBadge}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {latestPrice && (
            <Link
              href="/marches"
              className="inline-flex items-center gap-2 min-h-[38px] px-3 rounded-[var(--ork-use-radius-control)] bg-surface border border-border hover:border-[var(--ork-use-border-selected)] text-xs font-medium text-foreground no-underline transition-colors"
            >
              <GraphNewUpIcon className="w-3.5 h-3.5 text-t-brand shrink-0" aria-hidden="true" />
              <span className="text-muted">Marché :</span>
              <span className="font-bold">{latestPrice.product?.name}</span>
              <span className="font-mono-numbers font-bold text-t-brand">
                {new Intl.NumberFormat("fr-FR").format(latestPrice.price)} FCFA/
                {latestPrice.product?.default_unit || "kg"}
              </span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsTourOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-[var(--ork-use-radius-button)] bg-surface border border-border hover:bg-sunken text-foreground text-xs font-semibold transition-colors"
          >
            <CompassIcon className="w-3.5 h-3.5 text-t-brand" aria-hidden="true" />
            Visite guidée
          </button>

          <Link
            href="/cultiplan"
            className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-[var(--ork-use-radius-button)] bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action text-xs font-semibold no-underline transition-colors shadow-raised"
          >
            <AddCircleIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Nouveau Business Plan
          </Link>
        </div>
      </section>

      {/* ─── 2. Les 4 KPIs Décisionnels ─── */}
      <section
        data-tour="kpis-row"
        aria-label="Indicateurs clés de pilotage"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <Link
          href="/cultima?view=finance"
          className="group bg-surface rounded-[var(--ork-use-radius-card)] border border-border hover:border-[var(--ork-use-border-selected)] p-4 no-underline transition-colors flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Trésorerie nette
            </span>
            <span className="w-8 h-8 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-action-subtle)] text-t-action flex items-center justify-center">
              <WalletMoneyBoldDuotoneIcon className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-bold text-foreground font-mono-numbers truncate">
              {loadingData && !isDemo ? "—" : formatFcfa(displayedCashNet)}
            </span>
            <span className="text-xs font-semibold text-t-brand shrink-0">
              {isDemo
                ? DEMO_FARM_SUMMARY.cashDeltaPct
                : treasuryStats.count > 0
                  ? `${treasuryStats.count} op.`
                  : "Aucune op."}
            </span>
          </div>
        </Link>

        <Link
          href="/cultima"
          className="group bg-surface rounded-[var(--ork-use-radius-card)] border border-border hover:border-[var(--ork-use-border-selected)] p-4 no-underline transition-colors flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Marge brute campagne
            </span>
            <span className="w-8 h-8 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center">
              <GraphNewUpBoldDuotoneIcon className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-bold text-foreground font-mono-numbers truncate">
              {isDemo
                ? formatFcfa(DEMO_FARM_SUMMARY.projectedMarginFcfa)
                : formatFcfa(Math.max(0, treasuryStats.income - treasuryStats.expense))}
            </span>
            <span className="text-xs font-semibold text-t-brand shrink-0">
              {isDemo ? `Marge ${DEMO_FARM_SUMMARY.marginRatePct} %` : "Campagne"}
            </span>
          </div>
        </Link>

        <Link
          href="/cultiplan"
          className="group bg-surface rounded-[var(--ork-use-radius-card)] border border-border hover:border-[var(--ork-use-border-selected)] p-4 no-underline transition-colors flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Business Plans · Cultiplan
            </span>
            <span className="w-8 h-8 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center">
              <Chart2BoldDuotoneIcon className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-bold text-foreground font-mono-numbers">
              {isDemo
                ? `ROI ${DEMO_FARM_SUMMARY.cultiplanRoiPct} %`
                : loadingData
                  ? "—"
                  : normalizedPlans.length}
            </span>
            <span className="text-xs font-semibold text-t-brand group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
              {isDemo ? `Retour ${DEMO_FARM_SUMMARY.paybackMonths} mois` : "Ouvrir"}{" "}
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>

        <div className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Santé opérationnelle
            </span>
            <span className="w-8 h-8 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center">
              <ShieldCheckBoldDuotoneIcon className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <span className="text-xl sm:text-2xl font-bold text-foreground font-mono-numbers">
                {isDemo ? `${DEMO_FARM_SUMMARY.operationalHealthPct} %` : `${tasksSummary.pct} %`}
              </span>
              <span className="text-xs text-muted">
                {isDemo
                  ? `${DEMO_FARM_SUMMARY.activeAlertsCount} alertes · ${tasksSummary.remaining} tâches`
                  : `${tasksSummary.completed}/${tasksSummary.total} tâches`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-sunken overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-300"
                style={{
                  width: `${isDemo ? DEMO_FARM_SUMMARY.operationalHealthPct : tasksSummary.pct}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. Bento Workspace Grid (8 / 4) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* COLONNE GAUCHE (8 cols) */}
        <div data-tour="ateliers-section" className="lg:col-span-8 space-y-5 min-w-0">
          {/* Graphique Flux de Trésorerie : Réel vs Prévisionnel + Ateliers Actifs (en mode démo) */}
          {isDemo && (
            <>
              <section className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-title font-bold text-foreground m-0">
                      Trésorerie : Réel (Cultima) vs Prévisionnel (Cultiplan)
                    </h2>
                    <p className="text-xs text-muted m-0 mt-0.5">
                      Suivi mensuel cumulé sur les 6 derniers mois (en FCFA).
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-t-brand">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                      Réel Cultima
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-t-action">
                      <span className="w-2.5 h-2.5 rounded-full bg-action" />
                      Prévisionnel
                    </span>
                  </div>
                </div>

                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={DEMO_CASHFLOW_SERIES}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="dashReelGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#007468" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#007468" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ork-use-border-default)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--ork-use-text-subtle)" />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="var(--ork-use-text-subtle)"
                        tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
                        width={44}
                      />
                      <RechartsTooltip
                        formatter={(value) => formatFcfa(Number(value ?? 0))}
                      />
                      <Area
                        type="monotone"
                        dataKey="previsionFcfa"
                        name="Prévisionnel"
                        stroke="#D0541F"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fill="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="reelFcfa"
                        name="Réel Cultima"
                        stroke="#007468"
                        strokeWidth={2.5}
                        fill="url(#dashReelGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-title font-bold text-foreground m-0">
                      Ateliers actifs sur Ferme Cultiso
                    </h2>
                    <p className="text-xs text-muted m-0 mt-0.5">
                      Vue consolidée Végétal, Élevage et Transformation.
                    </p>
                  </div>
                  <Link
                    href="/cultima"
                    className="text-xs font-semibold text-t-brand hover:underline no-underline inline-flex items-center gap-1 shrink-0"
                  >
                    Ouvrir Cultima <ArrowRightIcon className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-sunken/50 text-[11px] uppercase tracking-wider text-muted">
                        <th className="py-2.5 px-4 font-bold">Atelier</th>
                        <th className="py-2.5 px-3 font-bold">Cycle</th>
                        <th className="py-2.5 px-3 font-bold text-right">Coût engagé</th>
                        <th className="py-2.5 px-3 font-bold text-right">Revenu estimé</th>
                        <th className="py-2.5 px-4 font-bold text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {DEMO_ATELIERS.map((row) => (
                        <tr key={row.id} className="hover:bg-sunken/50 transition-colors">
                          <td className="py-3 px-4">
                            <Link
                              href={row.href}
                              className="font-semibold text-foreground hover:text-t-brand no-underline block"
                            >
                              {row.name}
                            </Link>
                            <span className="text-[11px] text-muted">{row.poleLabel}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-foreground/90">{row.cycleInfo}</div>
                            <div className="w-24 h-1.5 rounded-full bg-sunken mt-1 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-brand"
                                style={{ width: `${row.progress}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono-numbers text-muted">
                            {formatFcfa(row.costFcfa)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-numbers font-semibold text-foreground">
                            {formatFcfa(row.expectedRevenueFcfa)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] text-[11px] font-semibold ${
                                row.status === "critique"
                                  ? "bg-[var(--ork-use-background-action-subtle)] text-t-action border border-[var(--ork-use-border-warning)]"
                                  : row.status === "attention"
                                    ? "bg-sunken text-foreground border border-border"
                                    : "bg-[var(--ork-use-background-brand-subtle)] text-t-brand"
                              }`}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* Business Plans List View (Cultiplan) */}
          <section className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                <div>
                  <h2 className="text-[15px] font-title font-bold text-foreground m-0">
                    Mes Business Plans (Cultiplan)
                  </h2>
                  <p className="text-xs text-muted m-0 mt-0.5">
                    Centralisez vos études de rentabilité et simulations financières.
                  </p>
                </div>

                <div className="relative w-full sm:w-56">
                  <MagnifierIcon
                    className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={planSearch}
                    onChange={(e) => setPlanSearch(e.target.value)}
                    placeholder="Filtrer mes projets..."
                    aria-label="Filtrer mes business plans"
                    className="w-full h-8 pl-8 pr-3 rounded-[var(--ork-use-radius-control)] bg-sunken border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-[var(--ork-use-border-brand)]"
                  />
                </div>
              </div>

              {/* Filter Tabs */}
              <div role="tablist" aria-label="Filtrer par statut" className="flex items-center gap-1">
                {tabItems.map((tab, idx) => {
                  const selected = planFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[idx] = el;
                      }}
                      role="tab"
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setPlanFilter(tab.id)}
                      onKeyDown={(e) => handleTabKeyDown(e, idx)}
                      className={`px-3 py-1.5 rounded-[var(--ork-use-radius-control)] text-xs font-semibold transition-colors ${
                        selected
                          ? "bg-selected text-t-brand ring-1 ring-inset ring-[var(--ork-use-border-selected)]"
                          : "text-muted hover:text-foreground hover:bg-sunken"
                      }`}
                    >
                      {tab.label}
                      <span className="ml-1.5 text-[11px] font-mono-numbers opacity-75">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {loadingData ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className="h-12 rounded-[var(--ork-use-radius-control)] bg-sunken animate-pulse"
                  />
                ))}
              </div>
            ) : filteredPlans.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="w-10 h-10 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center mx-auto mb-3">
                  <DocumentTextIcon className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  {planSearch
                    ? "Aucun projet ne correspond à votre recherche"
                    : "Aucun business plan enregistré"}
                </p>
                <p className="text-xs text-muted max-w-sm mx-auto mb-4">
                  Lancez Cultiplan pour structurer votre étude de marché, votre itinéraire technique et vos prévisions en FCFA.
                </p>
                <Link
                  href="/cultiplan"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[var(--ork-use-radius-button)] bg-brand hover:bg-[var(--ork-use-background-brand-bold-hover)] text-on-brand text-xs font-semibold no-underline transition-colors"
                >
                  <AddCircleIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  Démarrer un Business Plan
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border list-none m-0 p-0">
                {filteredPlans.map((plan) => (
                  <li key={plan.id}>
                    <Link
                      href="/cultiplan"
                      className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-sunken/70 transition-colors no-underline group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center shrink-0 group-hover:bg-brand group-hover:text-on-brand transition-colors">
                          <Chart2Icon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold text-foreground truncate">
                            {plan.title}
                          </div>
                          <div className="text-[11.5px] text-muted truncate">
                            {plan.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="hidden sm:flex items-center gap-2 w-28">
                          <div className="flex-1 h-1.5 rounded-full bg-sunken overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${plan.progress}%`,
                                backgroundColor:
                                  plan.progress === 100
                                    ? "var(--ork-use-background-brand-bold)"
                                    : "var(--ork-use-background-action-bold)",
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-mono-numbers text-muted w-8 text-right">
                            {plan.progress}%
                          </span>
                        </div>

                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-[var(--ork-use-radius-badge)] ${
                            plan.isLocal
                              ? "bg-[var(--ork-use-background-action-subtle)] text-t-action border border-[var(--ork-use-border-warning)]"
                              : plan.status === "done"
                                ? "bg-[var(--ork-use-background-brand-subtle)] text-t-brand"
                                : "bg-sunken text-foreground"
                          }`}
                        >
                          {plan.isLocal
                            ? "Brouillon local"
                            : plan.status === "done"
                              ? "Finalisé"
                              : "En cours"}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Cultima ERP Direct Pole Access */}
          <section className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-[15px] font-title font-bold text-foreground m-0">
                  Pôles opérationnels (Cultima ERP)
                </h2>
                <p className="text-xs text-muted m-0 mt-0.5">
                  Accédez directement à chaque atelier sans configuration préalable.
                </p>
              </div>
              <Link
                href="/cultima"
                className="text-xs font-semibold text-t-brand hover:underline no-underline inline-flex items-center gap-1 shrink-0"
              >
                Tout voir <ArrowRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {CULTIMA_POLES.map((pole) => {
                const Icon = pole.icon;
                return (
                  <Link
                    key={pole.id}
                    href={`/cultima?view=${pole.id}`}
                    className="group p-3.5 rounded-[var(--ork-use-radius-card)] border border-border bg-sunken/70 hover:bg-selected/60 hover:border-[var(--ork-use-border-selected)] transition-colors no-underline flex items-start gap-3"
                  >
                    <span className="w-8 h-8 rounded-[var(--ork-use-radius-control)] bg-surface border border-border text-t-brand flex items-center justify-center shrink-0 group-hover:bg-brand group-hover:text-on-brand transition-colors">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-foreground leading-snug">
                        {pole.label}
                      </div>
                      <div className="text-[11px] text-muted leading-snug mt-0.5">
                        {pole.desc}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        {/* COLONNE DROITE (4 cols) */}
        <div className="lg:col-span-4 space-y-5 min-w-0">
          {/* Alertes & Décisions du Jour */}
          <section
            data-tour="decisions-section"
            className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border overflow-hidden"
          >
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DangerTriangleBoldDuotoneIcon className="w-4 h-4 text-t-action" aria-hidden="true" />
                <h2 className="text-[14px] font-title font-bold text-foreground m-0">
                  Alertes &amp; Décisions
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] bg-[var(--ork-use-background-action-subtle)] text-t-action">
                {isDemo ? `${DEMO_DECISION_ALERTS.length} actions` : "À jour"}
              </span>
            </div>

            {isDemo ? (
              <div className="divide-y divide-border">
                {DEMO_DECISION_ALERTS.map((alert) => (
                  <div key={alert.id} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10.5px] font-bold uppercase tracking-wider ${
                          alert.severity === "urgent"
                            ? "text-t-action"
                            : alert.severity === "opportunity"
                              ? "text-t-brand"
                              : "text-muted"
                        }`}
                      >
                        {alert.category}
                      </span>
                      <Link
                        href={alert.href}
                        className="text-[11px] font-semibold text-t-brand hover:underline no-underline"
                      >
                        {alert.actionLabel} →
                      </Link>
                    </div>
                    <div className="text-[13px] font-bold text-foreground">
                      {alert.title}
                    </div>
                    <p className="text-xs text-muted m-0 leading-relaxed">
                      {alert.detail}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 flex items-center gap-2.5 text-xs text-muted">
                <CheckCircleIcon className="w-4 h-4 text-t-brand shrink-0" />
                <span>Aucune alerte critique détectée sur votre exploitation.</span>
              </div>
            )}
          </section>

          {/* Interactive Daily Checklist */}
          <section className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-title font-bold text-foreground m-0">
                  À faire aujourd&apos;hui
                </h2>
                <p className="text-[11.5px] text-muted m-0">
                  {activeWorkspace.name}
                </p>
              </div>
              <span className="text-[11px] font-mono-numbers font-bold px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] bg-sunken text-foreground whitespace-nowrap shrink-0">
                {tasksSummary.remaining} restantes
              </span>
            </div>

            <form
              onSubmit={handleAddTask}
              className="px-4 py-2.5 border-b border-border bg-sunken/70"
            >
              <div className="flex items-center gap-2 rounded-[var(--ork-use-radius-control)] bg-surface border border-border px-2.5 py-1.5 focus-within:border-[var(--ork-use-border-brand)] transition-colors">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="+ Ajouter une tâche..."
                  aria-label="Ajouter une tâche du jour"
                  className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted focus:outline-none"
                />
                {newTaskTitle.trim() && (
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-[var(--ork-use-radius-button)] bg-brand text-on-brand text-[11px] font-semibold hover:bg-[var(--ork-use-background-brand-bold-hover)] transition-colors shrink-0"
                  >
                    Ajouter
                  </button>
                )}
              </div>
            </form>

            <ul className="divide-y divide-border list-none m-0 p-0 max-h-[260px] overflow-y-auto custom-scrollbar">
              {tasks.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-muted">
                  Tout est à jour pour aujourd&apos;hui.
                </li>
              ) : (
                tasks.map((task) => (
                  <li
                    key={task.id}
                    className="group flex items-start justify-between gap-2.5 px-4 py-3 hover:bg-sunken/60 transition-colors"
                  >
                    <label className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => handleToggleTask(task.id)}
                        className="mt-0.5 w-4 h-4 shrink-0 rounded-[var(--ork-use-radius-checkbox)] border-border-strong accent-[var(--ork-use-background-brand-bold)] cursor-pointer"
                      />
                      <span
                        className={`text-[13px] leading-snug ${
                          task.done
                            ? "line-through text-muted opacity-65"
                            : "text-foreground font-medium"
                        }`}
                      >
                        {task.title}
                      </span>
                    </label>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.priority === "urgent" && !task.done && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] bg-[var(--ork-use-background-action-subtle)] text-t-action border border-[var(--ork-use-border-warning)]">
                          Prioritaire
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        aria-label={`Supprimer ${task.title}`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-[var(--ork-use-radius-control)] text-muted hover:text-t-action transition-opacity"
                      >
                        <TrashBinTrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Compact Cultisia Copilot Card */}
          <section
            data-tour="cultisia-card"
            className="rounded-[var(--ork-use-radius-card)] border border-[var(--ork-use-border-selected)] bg-selected/60 p-4 space-y-3"
          >
            <div className="flex items-center gap-2.5">
              <span className="ork-avatar ork-avatar--ai w-8 h-8 flex items-center justify-center shrink-0" aria-hidden="true">
                <StarsBoldDuotoneIcon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[13.5px] font-title font-bold text-foreground m-0 flex items-center gap-1.5">
                  <span>Copilote Cultisia</span>
                  <span className="ork-avatar-ai-label">IA</span>
                </h2>
                <p className="text-[11px] text-muted m-0">
                  Agronomie, rentabilité &amp; prix du marché
                </p>
              </div>
            </div>
            <p className="text-xs text-foreground/85 leading-relaxed m-0">
              {isDemo
                ? "Simulez l'impact d'une extension de 2 ha de tomate sur votre BFR ou obtenez un dosage NPK adapté à Kpalimé."
                : "Besoin d'un avis technique sur une culture, d'un dosage NPK ou d'estimer votre marge ? Ouvrez le panneau latéral sans quitter cette page."}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => openCultisia("cultisia")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-[var(--ork-use-radius-button)] bg-brand hover:bg-[var(--ork-use-background-brand-bold-hover)] text-on-brand text-xs font-semibold transition-colors"
              >
                <StarsBoldDuotoneIcon className="w-3.5 h-3.5" aria-hidden="true" />
                Ouvrir le copilote
              </button>
              <Link
                href="/cultisia"
                className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-[var(--ork-use-radius-button)] bg-surface border border-border text-foreground text-xs font-semibold no-underline hover:bg-sunken transition-colors"
              >
                Plein écran
              </Link>
            </div>
          </section>

          {/* Upcoming Modules Card */}
          <section className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-title font-bold text-foreground m-0">
                Bientôt dans votre suite
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] bg-sunken text-muted">
                Feuille de route
              </span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center shrink-0">
                  <Bag2Icon className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">
                    Cultishop
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    Approvisionnement direct en intrants &amp; semences
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-action-subtle)] text-t-action flex items-center justify-center shrink-0">
                  <UserCheckIcon className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">
                    Cultiseil
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    Accompagnement terrain par nos agronomes
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Visite guidée interactive */}
      <DashboardTour open={isTourOpen} onClose={handleCloseTour} />
    </div>
  );
}
