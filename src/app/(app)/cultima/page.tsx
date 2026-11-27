"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SproutIcon,
  BoneIcon,
  LayersIcon,
  FactoryIcon,
  WrenchIcon,
  ScaleIcon,
  WalletMoneyIcon,
  Widget2Icon,
  ArrowRightIcon,
} from "@solar-icons/react/linear";
import {
  SproutIcon as SproutBoldDuotoneIcon,
  BoneIcon as BoneBoldDuotoneIcon,
  LayersIcon as LayersBoldDuotoneIcon,
  FactoryIcon as FactoryBoldDuotoneIcon,
  WrenchIcon as WrenchBoldDuotoneIcon,
  ScaleIcon as ScaleBoldDuotoneIcon,
  WalletMoneyIcon as WalletMoneyBoldDuotoneIcon,
  Widget2Icon as Widget2BoldDuotoneIcon,
  StarsIcon as StarsBoldDuotoneIcon,
} from "@solar-icons/react/bold-duotone";
import VegetalDashboard from "@/components/cultima/vegetal/VegetalDashboard";
import AnimalDashboard from "@/components/cultima/animal/AnimalDashboard";
import TransformationDashboard from "@/components/cultima/transformation/TransformationDashboard";
import ServiceDashboard from "@/components/cultima/service/ServiceDashboard";
import NegoceDashboard from "@/components/cultima/negoce/NegoceDashboard";
import TreasuryDashboard from "@/components/cultima/finance/TreasuryDashboard";
import { useAppWorkspace } from "@/components/app/AppWorkspaceContext";

type CultimaView =
  | "overview"
  | "vegetal"
  | "animal"
  | "mixte"
  | "transformation"
  | "service"
  | "negoce"
  | "finance";

const VIEWS: {
  id: CultimaView;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  activeIcon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "overview",
    label: "Vue globale",
    desc: "Accès rapide à tous vos ateliers agricoles",
    icon: Widget2Icon,
    activeIcon: Widget2BoldDuotoneIcon,
  },
  {
    id: "vegetal",
    label: "Végétal",
    desc: "Parcelles, calendrier cultural, sols & rendements",
    icon: SproutIcon,
    activeIcon: SproutBoldDuotoneIcon,
  },
  {
    id: "animal",
    label: "Élevage",
    desc: "Bandes, silos provende, suivi sanitaire & aquaculture",
    icon: BoneIcon,
    activeIcon: BoneBoldDuotoneIcon,
  },
  {
    id: "mixte",
    label: "Mixte",
    desc: "Supervision combinée Végétal & Élevage",
    icon: LayersIcon,
    activeIcon: LayersBoldDuotoneIcon,
  },
  {
    id: "transformation",
    label: "Transformation",
    desc: "Lots de production, qualité & maintenance",
    icon: FactoryIcon,
    activeIcon: FactoryBoldDuotoneIcon,
  },
  {
    id: "service",
    label: "Services",
    desc: "Missions terrain, flotte & devis",
    icon: WrenchIcon,
    activeIcon: WrenchBoldDuotoneIcon,
  },
  {
    id: "negoce",
    label: "Négoce",
    desc: "Entrepôts, flux logistiques & marges",
    icon: ScaleIcon,
    activeIcon: ScaleBoldDuotoneIcon,
  },
  {
    id: "finance",
    label: "Trésorerie",
    desc: "Entrées, sorties & solde en FCFA",
    icon: WalletMoneyIcon,
    activeIcon: WalletMoneyBoldDuotoneIcon,
  },
];

function isValidView(value: string | null): value is CultimaView {
  return VIEWS.some((v) => v.id === value);
}

function CultimaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeWorkspace, openCultisia } = useAppWorkspace();

  const paramView = searchParams.get("view");
  const [pendingView, setPendingView] = useState<{
    param: string | null;
    view: CultimaView;
  } | null>(null);
  const activeView: CultimaView =
    pendingView && pendingView.param === paramView
      ? pendingView.view
      : isValidView(paramView)
        ? paramView
        : "overview";
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const idx = VIEWS.findIndex((v) => v.id === activeView);
    if (idx >= 0) {
      tabRefs.current[idx]?.scrollIntoView({
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeView]);

  const selectView = (view: CultimaView) => {
    setPendingView({ param: paramView, view });
    const nextUrl = view === "overview" ? "/cultima" : `/cultima?view=${view}`;
    router.replace(nextUrl, { scroll: false });
  };

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % VIEWS.length;
    else if (e.key === "ArrowLeft")
      nextIdx = (idx - 1 + VIEWS.length) % VIEWS.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = VIEWS.length - 1;
    else return;

    e.preventDefault();
    const target = VIEWS[nextIdx];
    selectView(target.id);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <div className="flex flex-col min-h-full bg-background text-foreground">
      {/* ClickUp-style Views Bar */}
      <div className="sticky top-0 z-30 bg-surface border-b border-border px-4 sm:px-6 py-1.5 flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Vues Cultima ERP"
          className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 overflow-x-auto tabstrip-scroll"
        >
          {VIEWS.map((view, idx) => {
            const selected = activeView === view.id;
            const Icon = selected ? view.activeIcon : view.icon;
            return (
              <button
                key={view.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                role="tab"
                type="button"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectView(view.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`relative flex items-center gap-1.5 px-3 min-h-[36px] py-1.5 rounded-[var(--ork-use-radius-control)] text-xs font-semibold whitespace-nowrap shrink-0 transition-colors outline-none ${
                  selected
                    ? "bg-selected text-t-brand ring-1 ring-inset ring-[var(--ork-use-border-selected)]"
                    : "text-muted hover:text-foreground hover:bg-sunken"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{view.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => openCultisia("cultima")}
          aria-label="Configurer Cultima avec Cultisia"
          className="hidden md:inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-[var(--ork-use-radius-button)] bg-[var(--ork-use-background-brand-subtle)] hover:bg-selected border border-[var(--ork-use-border-selected)] text-t-brand text-xs font-semibold shrink-0 transition-colors"
        >
          <StarsBoldDuotoneIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="xl:hidden">Copilote ERP</span>
          <span className="hidden xl:inline">Configurer avec Cultisia</span>
        </button>
      </div>

      {/* Active View Body */}
      <div className="flex-1">
        {activeView === "overview" && (
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface rounded-[var(--ork-use-radius-card)] border border-border p-5">
              <div>
                <h1 className="text-lg sm:text-xl font-title font-bold text-foreground tracking-[-0.02em] m-0">
                  Cultima ERP · {activeWorkspace.name}
                </h1>
                <p className="text-xs sm:text-[13px] text-muted m-0 mt-1">
                  Sélectionnez une vue ci-dessous pour piloter vos opérations, ou demandez à Cultisia d&apos;adapter la configuration à votre exploitation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCultisia("cultima")}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-[var(--ork-use-radius-button)] bg-brand hover:bg-[var(--ork-use-background-brand-bold-hover)] text-on-brand text-xs font-semibold shrink-0 transition-colors"
              >
                <StarsBoldDuotoneIcon className="w-3.5 h-3.5" aria-hidden="true" />
                Assistant de configuration
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {VIEWS.filter((v) => v.id !== "overview").map((view) => {
                const Icon = view.icon;
                const isFinance = view.id === "finance";
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => selectView(view.id)}
                    className={`group text-left bg-surface rounded-[var(--ork-use-radius-card)] border p-5 transition-colors flex flex-col justify-between gap-4 ${
                      isFinance
                        ? "border-[var(--ork-use-border-warning)] hover:border-[var(--ork-use-text-action)]"
                        : "border-border hover:border-[var(--ork-use-border-selected)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`w-10 h-10 rounded-[var(--ork-use-radius-control)] flex items-center justify-center shrink-0 transition-colors ${
                          isFinance
                            ? "bg-[var(--ork-use-background-action-subtle)] text-t-action group-hover:bg-action group-hover:text-on-action"
                            : "bg-[var(--ork-use-background-brand-subtle)] text-t-brand group-hover:bg-brand group-hover:text-on-brand"
                        }`}
                      >
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <ArrowRightIcon
                        className="w-4 h-4 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-title font-bold text-foreground m-0 mb-1">
                        {view.label}
                      </h2>
                      <p className="text-xs text-muted m-0 leading-relaxed">
                        {view.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeView === "vegetal" && (
          <>
            <h1 className="sr-only">Cultima ERP — Production végétale</h1>
            <VegetalDashboard embedded />
          </>
        )}
        {activeView === "animal" && (
          <>
            <h1 className="sr-only">Cultima ERP — Élevage et zootechnie</h1>
            <AnimalDashboard embedded />
          </>
        )}
        {activeView === "mixte" && (
          <div className="space-y-2">
            <h1 className="sr-only">Cultima ERP — Exploitation mixte végétale et animale</h1>
            <VegetalDashboard embedded hideFooter />
            <div className="border-t border-border pt-6">
              <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pb-2">
                <h2 className="text-lg font-title font-bold text-foreground m-0">
                  Supervision Zootechnique (Élevage)
                </h2>
                <p className="text-xs text-muted m-0 mt-0.5">
                  Ateliers animaux consolidés sur la même exploitation
                </p>
              </div>
              <AnimalDashboard embedded />
            </div>
          </div>
        )}
        {activeView === "transformation" && <TransformationDashboard embedded />}
        {activeView === "service" && <ServiceDashboard embedded />}
        {activeView === "negoce" && <NegoceDashboard embedded />}
        {activeView === "finance" && <TreasuryDashboard />}
      </div>
    </div>
  );
}

export default function CultimaPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-muted-moss">
          Chargement de Cultima ERP...
        </div>
      }
    >
      <CultimaContent />
    </Suspense>
  );
}
