"use client";
import React, { useState } from 'react';
import { 
  ShieldCheckIcon as ShieldCheck,
  GraphNewUpIcon as TrendingUp,
  AddCircleIcon as PlusCircle,
  CalculatorIcon as Calculator,
  DownloadIcon as Download,
  BellIcon as Bell,
  AltArrowDownIcon as ChevronDown,
  RefreshIcon as RefreshCw,
} from '@solar-icons/react/linear';
import {
  Buildings2Icon as Building2,
  WalletMoneyIcon as Wallet,
  StarsIcon as Sparkles,
} from '@solar-icons/react/bold-duotone';
import { ZootechKPIs } from './types';

interface HeaderProps {
  currentSite: string;
  onSelectSite: (site: string) => void;
  kpis: ZootechKPIs;
  onOpenSimulator: () => void;
  onOpenNewEntry: () => void;
  onExportAudit: () => void;
  compact?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentSite,
  onSelectSite,
  kpis,
  onOpenSimulator,
  onOpenNewEntry,
  onExportAudit,
  compact = false,
}) => {
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sites = [
    { id: 'site-1', name: 'Ferme Cultiso · Kpalimé', role: 'Siège & Multi-Ateliers' },
    { id: 'site-2', name: 'Station Avicole Agou', role: 'Volaille Chair & Pondeuses' },
    { id: 'site-3', name: 'Complexe Porcin Zio', role: 'Naisseur-Engraisseur' },
    { id: 'site-4', name: 'Ferme Aquacole Kpémé', role: 'Pisciculture Tilapia & Silure' },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <header className={compact ? "bg-surface border-b border-border" : "bg-surface border-b border-border sticky top-0 z-20"}>
      {/* Top Banner: Corporate System Status & Brand Bar */}
      {!compact && (
      <div className="bg-[var(--ork-ref-primary-15)] text-white/90 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ork-ref-primary-60)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ork-ref-primary-60)]"></span>
            </span>
            <span className="text-white font-semibold">Cultima Telemetry v4.8</span>
            <span className="text-white/50">|</span>
            <span className="hidden sm:inline text-white/80">Réseau Capteurs IoT Silos & Peseuses Connectées</span>
          </div>
          <div className="hidden md:flex items-center gap-1 bg-brand px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] border border-white/15 text-[11px] text-on-brand">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Biosécurité Niveau 3 • Conforme Décret Vétérinaire</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-white/80">
            Délai d&apos;attente médicamenteux : <strong className="text-[var(--ork-ref-secondary-70)]">2 lots sous surveillance</strong>
          </span>
          <span className="hidden lg:inline text-white/40">•</span>
          <span className="text-white/80">
            Dernière sync : <span className="font-mono text-white">08/09/2026 - 10:14</span>
          </span>
        </div>
      </div>
      )}

      {/* Main App Header */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Brand & Site Switcher */}
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {!compact && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--ork-use-radius-control)] bg-brand flex items-center justify-center text-on-brand font-black text-lg shadow-raised relative overflow-hidden">
                  <div className="absolute -right-2 -bottom-2 w-6 h-6 bg-action rounded-full opacity-90"></div>
                  <span className="relative z-10 tracking-tight">C</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-title font-extrabold tracking-tight text-foreground leading-none">
                      Cultima
                    </h1>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--ork-use-background-action-subtle)] text-t-action px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] border border-[var(--ork-use-border-warning)] whitespace-nowrap">
                      ERP ZOOTECH
                    </span>
                  </div>
                  <p className="text-xs text-muted font-medium mt-0.5">
                    Système Central de Pilotage de la Production Animale
                  </p>
                </div>
              </div>
              <div className="h-7 w-px bg-border hidden sm:block mx-1"></div>
            </>
          )}

          {/* Farm Site Dropdown */}
          <div className="relative max-w-full min-w-0">
            <button
              type="button"
              onClick={() => setSiteDropdownOpen(!siteDropdownOpen)}
              className="flex items-center gap-2 bg-sunken hover:bg-selected/50 border border-border px-3 py-1.5 rounded-[var(--ork-use-radius-control)] text-xs font-semibold text-foreground transition max-w-full"
            >
              <Building2 className="w-3.5 h-3.5 text-t-brand shrink-0" />
              <span className="truncate text-left">{currentSite}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted shrink-0 transition-transform ${siteDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {siteDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-[min(320px,calc(100dvw-2rem))] bg-surface rounded-[var(--ork-use-radius-card)] shadow-overlay border border-border py-1 z-40">
                <div className="px-3 py-2 border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider">
                  Sélectionner un site d&apos;élevage
                </div>
                {sites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => {
                      onSelectSite(site.name);
                      setSiteDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 hover:bg-sunken flex items-start gap-2.5 transition rounded-[var(--ork-use-radius-control)] ${
                      currentSite === site.name ? 'bg-selected ring-1 ring-inset ring-[var(--ork-use-border-selected)]' : ''
                    }`}
                  >
                    <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${currentSite === site.name ? 'text-t-brand' : 'text-muted'}`} />
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold truncate ${currentSite === site.name ? 'text-t-brand' : 'text-foreground'}`}>
                        {site.name}
                      </div>
                      <div className="text-[11px] text-muted truncate">{site.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Treasury ticker & High-level actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Treasury Quick Badge */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-sunken border border-border rounded-[var(--ork-use-radius-control)] px-3 py-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Wallet className="w-3.5 h-3.5 text-t-brand shrink-0" />
              <span>Trésorerie :</span>
              <span className="font-bold text-foreground font-mono-numbers whitespace-nowrap">
                {kpis.treasury.cashBalance.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
            <span className="text-muted/50 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted">MCAS :</span>
              <span className="font-bold text-t-brand font-mono-numbers bg-[var(--ork-use-background-brand-subtle)] px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] whitespace-nowrap">
                +{kpis.treasury.marginOverFeedRate}%
              </span>
            </div>
          </div>

          {/* Zootech Simulator Button */}
          <button
            type="button"
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--ork-use-radius-button)] bg-surface hover:bg-sunken border border-[var(--ork-use-border-warning)] text-t-action text-xs font-semibold transition active:scale-95 whitespace-nowrap"
            title="Simulateur Zootechnique & Marge sur Coût Alimentaire"
          >
            <Calculator className="w-3.5 h-3.5 text-t-action shrink-0" />
            <span>Simulateur IC</span>
          </button>

          {/* Export Report / Audit */}
          <button
            type="button"
            onClick={onExportAudit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--ork-use-radius-button)] bg-sunken hover:bg-selected/50 border border-border text-foreground text-xs font-semibold transition active:scale-95 whitespace-nowrap"
            title="Exporter Registre Réglementaire & Audit Zootechnique"
          >
            <Download className="w-3.5 h-3.5 text-muted shrink-0" />
            <span>Export Audit</span>
          </button>

          {/* New Event / Weighing Entry Button */}
          <button
            type="button"
            onClick={onOpenNewEntry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--ork-use-radius-button)] bg-brand hover:bg-[var(--ork-use-background-brand-bold-hover)] text-on-brand text-xs font-semibold transition active:scale-95 whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Nouveau Relevé</span>
          </button>

          {/* Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Actualiser les données capteurs"
            className="p-1.5 rounded-lg text-muted-moss hover:text-forest-ink hover:bg-card-linen transition"
            title="Actualiser les données capteurs"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-green' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
