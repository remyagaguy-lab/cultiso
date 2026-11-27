"use client";
import React from 'react';
import { 
  Users, 
  Activity, 
  Scale, 
  Wheat, 
  Egg, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  Droplets,
  Wallet,
  Milk,
  Fish
} from 'lucide-react';
import { ZootechKPIs, SpeciesCategory } from './types';

interface MetricCardsProps {
  kpis: ZootechKPIs;
  species: SpeciesCategory;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ kpis, species }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* CARD 1: Cheptel Actif */}
      <div className="bg-surface rounded-[var(--ork-use-radius-card)] p-4 border border-border shadow-raised hover:border-[var(--ork-use-border-selected)] transition relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Cheptel Actif</span>
          <div className="w-7 h-7 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center">
            <Users className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="text-2xl font-black text-foreground font-mono tracking-tight">
            {kpis.totalHeads.toLocaleString('fr-FR')}
          </div>
          <div className="text-[11px] text-muted font-medium mt-0.5">
            Sujets sous monitoring continu
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center text-t-success font-semibold">
            <ArrowUpRight className="w-3 h-3 mr-0.5" />
            +{kpis.totalHeadsChangePercent}% ce mois
          </span>
          <span className="text-muted font-medium">Bande saine</span>
        </div>
      </div>

      {/* CARD 2: Indice de Consommation Alimentaire (IC / FCR) */}
      <div className="bg-surface rounded-[var(--ork-use-radius-card)] p-4 border border-border shadow-raised hover:border-[var(--ork-use-border-selected)] transition relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--ork-use-background-brand-subtle)] rounded-bl-full pointer-events-none -mr-4 -mt-4 opacity-50"></div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-t-brand uppercase tracking-wider">Indice FCR (IC)</span>
            <span className="text-[9px] bg-[var(--ork-use-background-brand-subtle)] text-t-brand font-bold px-1 rounded-[var(--ork-use-radius-badge)]">Clé</span>
          </div>
          <div className="w-7 h-7 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center">
            <Scale className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-t-brand font-mono tracking-tight">
              {kpis.feedConversionRatio.toFixed(2)}
            </span>
            <span className="text-xs text-muted font-medium">kg alim/kg</span>
          </div>
          <div className="text-[11px] text-muted font-medium mt-0.5">
            Objectif guide : <span className="font-semibold text-foreground">{kpis.fcrBenchmark.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center text-t-brand font-bold bg-[var(--ork-use-background-brand-subtle)] px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] whitespace-nowrap">
            <ArrowDownRight className="w-3 h-3 mr-0.5 shrink-0" />
            -4.7% efficience
          </span>
          <span className="text-t-brand font-bold whitespace-nowrap">Optimal</span>
        </div>
      </div>

      {/* CARD 3: Taux de Mortalité Cumulée */}
      <div className="bg-surface rounded-[var(--ork-use-radius-card)] p-4 border border-border shadow-raised hover:border-[var(--ork-use-border-selected)] transition relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Mortalité Cumulée</span>
          <div className={`w-7 h-7 rounded-[var(--ork-use-radius-control)] flex items-center justify-center ${
            kpis.mortalityRate <= kpis.mortalityBenchmark 
              ? 'bg-[var(--ork-use-background-success-subtle)] text-t-success' 
              : 'bg-[var(--ork-use-background-danger-subtle)] text-t-danger'
          }`}>
            <Activity className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black font-mono tracking-tight ${
              kpis.mortalityRate <= kpis.mortalityBenchmark ? 'text-foreground' : 'text-t-danger'
            }`}>
              {kpis.mortalityRate.toFixed(2)}%
            </span>
            <span className="text-xs text-muted">du lot</span>
          </div>
          <div className="text-[11px] text-muted font-medium mt-0.5">
            Seuil max toléré : <span className="font-semibold text-foreground">{kpis.mortalityBenchmark.toFixed(1)}%</span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2 text-[11px]">
          <span className="inline-flex items-center text-t-success font-semibold whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 mr-1 text-t-success shrink-0" />
            Sous seuil critique
          </span>
          <span className="text-muted font-mono-numbers whitespace-nowrap">0.03%/j</span>
        </div>
      </div>

      {/* CARD 4: Production Journalière Spécialisée */}
      <div className="bg-surface rounded-[var(--ork-use-radius-card)] p-4 border border-border shadow-raised hover:border-[var(--ork-use-border-selected)] transition relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
            {species === 'poultry' ? 'Ponte Journalière' : 
             species === 'cattle' ? 'Traite Journalière' : 
             species === 'aquaculture' ? 'Biomasse Bassin' : 
             'Rendement / Jour'}
          </span>
          <div className="w-7 h-7 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-action-subtle)] text-t-action flex items-center justify-center">
            {species === 'poultry' ? <Egg className="w-3.5 h-3.5" /> : 
             species === 'cattle' ? <Milk className="w-3.5 h-3.5" /> : 
             species === 'aquaculture' ? <Fish className="w-3.5 h-3.5" /> : 
             <TrendingUp className="w-3.5 h-3.5" />}
          </div>
        </div>

        <div className="mt-2.5">
          {species === 'poultry' || species === 'all' ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-foreground font-mono tracking-tight">
                  {kpis.dailyProduction.eggs.toLocaleString('fr-FR')}
                </span>
                <span className="text-xs text-muted font-medium">œufs</span>
              </div>
              <div className="text-[11px] text-muted font-medium mt-0.5 flex items-center gap-1.5">
                <span>Taux de ponte :</span>
                <span className="font-bold text-t-brand">{kpis.dailyProduction.layingRate}%</span>
              </div>
            </div>
          ) : species === 'cattle' ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-foreground font-mono tracking-tight">
                  {kpis.dailyProduction.milk.toLocaleString('fr-FR')}
                </span>
                <span className="text-xs text-muted font-medium">Litres</span>
              </div>
              <div className="text-[11px] text-muted font-medium mt-0.5">
                TB: 40.2 g/kg • TP: 32.8 g/kg
              </div>
            </div>
          ) : species === 'aquaculture' ? (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-foreground font-mono tracking-tight">
                  +{kpis.dailyProduction.fishBiomassGainKg}
                </span>
                <span className="text-xs text-muted font-medium">kg/j</span>
              </div>
              <div className="text-[11px] text-muted font-medium mt-0.5">
                Gain biomasse (Tilapia + Silure)
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-foreground font-mono tracking-tight">
                  {kpis.gmq}
                </span>
                <span className="text-xs text-muted font-medium">g/j</span>
              </div>
              <div className="text-[11px] text-muted font-medium mt-0.5">
                Gain Moyen Quotidien (GMQ)
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[11px]">
          <span className="text-muted">Qualité Grade A</span>
          <span className="font-bold text-foreground">98.4%</span>
        </div>
      </div>

      {/* CARD 5: Trésorerie & Marge sur Coût Aliment (MCAS) */}
      <div className="bg-surface rounded-[var(--ork-use-radius-card)] p-4 border border-border shadow-raised hover:border-[var(--ork-use-border-selected)] transition relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Marge Aliment (MCAS)</span>
          </div>
          <div className="w-7 h-7 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center shrink-0">
            <Wallet className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-t-brand font-mono-numbers tracking-tight">
              {kpis.treasury.marginOverFeedRate.toFixed(1)}%
            </span>
            <span className="text-xs text-muted font-medium">Marge brute</span>
          </div>
          <div className="text-[11px] text-muted font-medium mt-0.5">
            Rev. MTD : <span className="font-semibold text-foreground font-mono-numbers whitespace-nowrap">{kpis.treasury.revenueMonth.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[11px]">
          <span className="text-muted">Break-even IC :</span>
          <span className="font-mono font-bold text-foreground">{kpis.treasury.breakEvenFcr}</span>
        </div>
      </div>

      {/* CARD 6: Stocks Silos & Autonomie Provendes */}
      <div className="bg-surface rounded-[var(--ork-use-radius-card)] p-4 border border-border shadow-raised hover:border-[var(--ork-use-border-selected)] transition relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Autonomie Silos</span>
          <div className={`w-7 h-7 rounded-[var(--ork-use-radius-control)] flex items-center justify-center ${
            kpis.feedStock.autonomyDays < 4 
              ? 'bg-[var(--ork-use-background-action-subtle)] text-t-action' 
              : 'bg-[var(--ork-use-background-brand-subtle)] text-t-brand'
          }`}>
            <Wheat className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black font-mono tracking-tight ${
              kpis.feedStock.autonomyDays < 4 ? 'text-t-action' : 'text-foreground'
            }`}>
              {kpis.feedStock.autonomyDays.toFixed(1)}
            </span>
            <span className="text-xs text-muted font-medium">Jours</span>
          </div>
          <div className="text-[11px] text-muted font-medium mt-0.5">
            Stock total : <span className="font-semibold text-foreground">{kpis.feedStock.totalTons} Tonnes</span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[11px]">
          <span className="text-muted">Conso/jour :</span>
          <span className="font-mono font-semibold text-foreground">
            {(kpis.feedStock.consumptionTodayKg / 1000).toFixed(1)} T/j
          </span>
        </div>
      </div>
    </div>
  );
};
