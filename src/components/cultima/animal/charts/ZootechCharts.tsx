"use client";
import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { 
  GrowthDataPoint, 
  LayingDataPoint, 
  FeedIntakeDataPoint, 
  FinancialBreakdownPoint, 
  SpeciesCategory 
} from '../types';
import { 
  TrendingUp, 
  Egg, 
  Wheat, 
  Wallet, 
  Info,
  Maximize2
} from 'lucide-react';

interface ZootechChartsProps {
  growthData: GrowthDataPoint[];
  layingData: LayingDataPoint[];
  feedData: FeedIntakeDataPoint[];
  financialData: FinancialBreakdownPoint[];
  species: SpeciesCategory;
}

export const ZootechCharts: React.FC<ZootechChartsProps> = ({
  growthData,
  layingData,
  feedData,
  financialData,
  species,
}) => {
  const [activeTab, setActiveTab] = useState<'growth' | 'laying' | 'feed' | 'treasury'>('growth');

  return (
    <div className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border shadow-raised overflow-hidden">
      {/* Chart Top Navigation Tabs */}
      <div className="border-b border-border px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-sunken/70">
        <div className="flex items-center gap-1.5 overflow-x-auto tabstrip-scroll pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('growth')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--ork-use-radius-control)] text-xs font-bold border transition whitespace-nowrap ${
              activeTab === 'growth'
                ? 'bg-selected text-t-brand border-[var(--ork-use-border-selected)]'
                : 'border-transparent text-muted hover:bg-sunken hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Croissance & GMQ (Poids Vif)</span>
          </button>

          {(species === 'poultry' || species === 'all') && (
            <button
              type="button"
              onClick={() => setActiveTab('laying')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--ork-use-radius-control)] text-xs font-bold border transition whitespace-nowrap ${
                activeTab === 'laying'
                  ? 'bg-selected text-t-brand border-[var(--ork-use-border-selected)]'
                  : 'border-transparent text-muted hover:bg-sunken hover:text-foreground'
              }`}
            >
              <Egg className="w-3.5 h-3.5" />
              <span>Courbe de Ponte & Calibrage</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--ork-use-radius-control)] text-xs font-bold border transition whitespace-nowrap ${
              activeTab === 'feed'
                ? 'bg-selected text-t-brand border-[var(--ork-use-border-selected)]'
                : 'border-transparent text-muted hover:bg-sunken hover:text-foreground'
            }`}
          >
            <Wheat className="w-3.5 h-3.5" />
            <span>Provendes & Indice FCR (IC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('treasury')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--ork-use-radius-control)] text-xs font-bold border transition whitespace-nowrap ${
              activeTab === 'treasury'
                ? 'bg-selected text-t-brand border-[var(--ork-use-border-selected)]'
                : 'border-transparent text-muted hover:bg-sunken hover:text-foreground'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Trésorerie & Marge Aliment (MCAS)</span>
          </button>
        </div>

        {/* Legend / Status pill */}
        <div className="flex items-center gap-3 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand"></span>
            <span className="font-medium text-foreground">Données Réelles Lot</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-action"></span>
            <span className="font-medium text-foreground">Standard Génétique Guide</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="p-4 sm:p-6">
        {/* TAB 1: CROISSANCE & GMQ */}
        {activeTab === 'growth' && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-title font-bold text-foreground flex items-center gap-1.5">
                  Dynamique de Croissance Pondérale & GMQ (Gain Moyen Quotidien)
                </h3>
                <p className="text-xs text-muted">
                  Comparaison du poids moyen pesé (g) contre le standard de sélection (Cobb 500 / ISA / Large White) avec tolérance ±5%
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-[var(--ork-use-background-success-subtle)] text-t-success border border-[var(--ork-use-border-success)] px-2.5 py-1 rounded-[var(--ork-use-radius-badge)] font-semibold">
                <span>Avance de croissance : +70g / sujet</span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={growthData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ork-comp-chart-base-grid-color)" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    tickLine={false} 
                    stroke="var(--ork-comp-chart-base-axis-color)" 
                    fontSize={11}
                    tickFormatter={(val) => `J${val}`}
                  />
                  <YAxis 
                    yAxisId="weight"
                    tickLine={false} 
                    stroke="var(--ork-comp-chart-base-axis-color)" 
                    fontSize={11}
                    tickFormatter={(val) => `${val}g`}
                    domain={[0, 'dataMax + 200']}
                  />
                  <YAxis 
                    yAxisId="gmq" 
                    orientation="right"
                    tickLine={false} 
                    stroke="var(--ork-use-data-2-mark)" 
                    fontSize={11}
                    tickFormatter={(val) => `${val}g/j`}
                  />
                  <Tooltip 
                    labelStyle={{ color: 'var(--ork-use-text-default)', fontWeight: 600 }}
                    itemStyle={{ color: 'var(--ork-use-text-default)' }}
                    contentStyle={{ 
                      backgroundColor: 'var(--ork-use-surface-overlay)', 
                      borderRadius: '8px', 
                      color: 'var(--ork-use-text-default)', 
                      border: '1px solid var(--ork-use-border-default)',
                      fontSize: '12px',
                      boxShadow: 'var(--ork-use-elevation-overlay)'
                    }}
                    formatter={(value: any, name: any) => {
                      if (name === 'actualWeight') return [`${value} g`, 'Poids Réel Mesuré'];
                      if (name === 'standardWeight') return [`${value} g`, 'Standard Génétique'];
                      if (name === 'gmq') return [`${value} g/j`, 'GMQ Quotidien'];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Âge physiologique : Jour ${label}`}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(val) => {
                      if (val === 'actualWeight') return <span className="text-xs text-foreground font-semibold">Poids Réel Mesuré (g)</span>;
                      if (val === 'standardWeight') return <span className="text-xs text-muted font-semibold">Standard Génétique (g)</span>;
                      if (val === 'gmq') return <span className="text-xs text-t-action font-semibold">GMQ (g/jour)</span>;
                      return val;
                    }}
                  />
                  {/* Standard Guide line */}
                  <Line 
                    yAxisId="weight" 
                    type="monotone" 
                    dataKey="standardWeight" 
                    stroke="var(--ork-use-data-other-mark)" 
                    strokeWidth={2} 
                    strokeDasharray="4 4" 
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* Actual Measured Line */}
                  <Line 
                    yAxisId="weight" 
                    type="monotone" 
                    dataKey="actualWeight" 
                    stroke="var(--ork-use-data-1-mark)" 
                    strokeWidth={3} 
                    dot={{ fill: 'var(--ork-use-data-1-mark)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: 'var(--ork-use-data-2-mark)' }}
                    isAnimationActive={false}
                  />
                  {/* GMQ Bar */}
                  <Bar 
                    yAxisId="gmq" 
                    dataKey="gmq" 
                    fill="var(--ork-use-data-2-mark)" 
                    opacity={0.35} 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={32}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 2: PONTE & CALIBRAGE */}
        {activeTab === 'laying' && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-title font-bold text-foreground flex items-center gap-1.5">
                  Courbe de Ponte Hebdomadaire & Calibrage Œufs (ISA Brown)
                </h3>
                <p className="text-xs text-muted">
                  Taux de ponte constaté vs courbe théorique de ponte (Semaine 18 à 40) et poids moyen de l&apos;œuf
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-[var(--ork-use-background-action-subtle)] text-t-action border border-[var(--ork-use-border-warning)] px-2.5 py-1 rounded-[var(--ork-use-radius-badge)] font-semibold">
                <span>Pic de ponte atteint à Sem 25 (95.8%)</span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={layingData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ork-comp-chart-base-grid-color)" vertical={false} />
                  <XAxis 
                    dataKey="week" 
                    tickLine={false} 
                    stroke="var(--ork-comp-chart-base-axis-color)" 
                    fontSize={11}
                    tickFormatter={(val) => `Sem ${val}`}
                  />
                  <YAxis 
                    yAxisId="rate"
                    tickLine={false} 
                    stroke="var(--ork-comp-chart-base-axis-color)" 
                    fontSize={11}
                    tickFormatter={(val) => `${val}%`}
                    domain={[0, 100]}
                  />
                  <YAxis 
                    yAxisId="eggWeight" 
                    orientation="right"
                    tickLine={false} 
                    stroke="var(--ork-use-data-2-mark)" 
                    fontSize={11}
                    tickFormatter={(val) => `${val}g`}
                    domain={[40, 75]}
                  />
                  <Tooltip 
                    labelStyle={{ color: 'var(--ork-use-text-default)', fontWeight: 600 }}
                    itemStyle={{ color: 'var(--ork-use-text-default)' }}
                    contentStyle={{ 
                      backgroundColor: 'var(--ork-use-surface-overlay)', 
                      borderRadius: '8px', 
                      color: 'var(--ork-use-text-default)', 
                      border: '1px solid var(--ork-use-border-default)',
                      fontSize: '12px',
                      boxShadow: 'var(--ork-use-elevation-overlay)'
                    }}
                    formatter={(value: any, name: any) => {
                      if (name === 'actualRate') return [`${value} %`, 'Taux de Ponte Réel'];
                      if (name === 'standardRate') return [`${value} %`, 'Standard de Ponte'];
                      if (name === 'eggWeightAvg') return [`${value} g`, 'Poids Moyen Œuf'];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Semaine de vie ${label}`}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    formatter={(val) => {
                      if (val === 'actualRate') return <span className="text-xs text-foreground font-semibold">Taux de Ponte Réel (%)</span>;
                      if (val === 'standardRate') return <span className="text-xs text-muted font-semibold">Objectif Standard (%)</span>;
                      if (val === 'eggWeightAvg') return <span className="text-xs text-t-action font-semibold">Poids Moyen Œuf (g)</span>;
                      return val;
                    }}
                  />
                  <Line 
                    yAxisId="rate" 
                    type="monotone" 
                    dataKey="standardRate" 
                    stroke="var(--ork-use-data-other-mark)" 
                    strokeWidth={2} 
                    strokeDasharray="4 4" 
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Area 
                    yAxisId="rate" 
                    type="monotone" 
                    dataKey="actualRate" 
                    stroke="var(--ork-use-data-1-mark)" 
                    fill="var(--ork-use-data-1-mark)" 
                    fillOpacity={0.18} 
                    strokeWidth={3}
                    isAnimationActive={false}
                  />
                  <Line 
                    yAxisId="eggWeight" 
                    type="monotone" 
                    dataKey="eggWeightAvg" 
                    stroke="var(--ork-use-data-2-mark)" 
                    strokeWidth={2.5} 
                    dot={{ fill: 'var(--ork-use-data-2-mark)', r: 4 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 3: PROVENDES & INDICE FCR (IC) */}
        {activeTab === 'feed' && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-title font-bold text-foreground flex items-center gap-1.5">
                  Consommation Provendes (kg) & Évolution de l&apos;Indice de Conversion (FCR)
                </h3>
                <p className="text-xs text-muted">
                  Suivi de la quantité d&apos;aliment distribuée et ratio de conversion biologique de la bande
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-[var(--ork-use-background-success-subtle)] text-t-success border border-[var(--ork-use-border-success)] px-2.5 py-1 rounded-[var(--ork-use-radius-badge)] font-semibold">
                <span>IC Cumulé Actuel : 1.58 (Excellente valorisation alimentaire)</span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={feedData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ork-comp-chart-base-grid-color)" vertical={false} />
                  <XAxis dataKey="dayOrWeek" tickLine={false} stroke="var(--ork-comp-chart-base-axis-color)" fontSize={11} />
                  <YAxis 
                    yAxisId="kg"
                    tickLine={false} 
                    stroke="var(--ork-comp-chart-base-axis-color)" 
                    fontSize={11}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)} T`}
                  />
                  <YAxis 
                    yAxisId="fcr" 
                    orientation="right"
                    tickLine={false} 
                    stroke="var(--ork-use-data-2-mark)" 
                    fontSize={11}
                    domain={[1.0, 2.0]}
                    tickFormatter={(val) => `${val.toFixed(2)}`}
                  />
                  <Tooltip 
                    labelStyle={{ color: 'var(--ork-use-text-default)', fontWeight: 600 }}
                    itemStyle={{ color: 'var(--ork-use-text-default)' }}
                    contentStyle={{ backgroundColor: 'var(--ork-use-surface-overlay)', borderRadius: '8px', color: 'var(--ork-use-text-default)', border: '1px solid var(--ork-use-border-default)', fontSize: '12px', boxShadow: 'var(--ork-use-elevation-overlay)' }}
                    formatter={(val: any, name: any) => {
                      if (name === 'intakeKg') return [`${val.toLocaleString('fr-FR')} kg`, 'Aliment Semaine'];
                      if (name === 'cumulativeKg') return [`${val.toLocaleString('fr-FR')} kg`, 'Aliment Cumulé'];
                      if (name === 'fcrPoint') return [val, 'Indice IC'];
                      return [val, name];
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    formatter={(val) => {
                      if (val === 'intakeKg') return <span className="text-xs text-foreground font-semibold">Aliment Hebdo (kg)</span>;
                      if (val === 'cumulativeKg') return <span className="text-xs text-muted font-semibold">Cumulé Lot (kg)</span>;
                      if (val === 'fcrPoint') return <span className="text-xs text-t-action font-semibold">Indice IC (FCR)</span>;
                      return val;
                    }}
                  />
                  <Bar yAxisId="kg" dataKey="intakeKg" fill="var(--ork-use-data-1-mark)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                  <Line yAxisId="kg" type="monotone" dataKey="cumulativeKg" stroke="var(--ork-use-data-other-mark)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="fcr" type="monotone" dataKey="fcrPoint" stroke="var(--ork-use-data-2-mark)" strokeWidth={3} dot={{ fill: 'var(--ork-use-data-2-mark)', r: 4 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 4: TRÉSORERIE & MARGE SUR COÛT ALIMENT (MCAS) */}
        {activeTab === 'treasury' && (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-title font-bold text-foreground flex items-center gap-1.5">
                  Structure des Coûts & Marge sur Coût Alimentaire (MCAS)
                </h3>
                <p className="text-xs text-muted">
                  Analyse financière zootechnique : L&apos;aliment représente 68% des coûts variables d&apos;élevage
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-[var(--ork-use-background-success-subtle)] text-t-success border border-[var(--ork-use-border-success)] px-2.5 py-1 rounded-[var(--ork-use-radius-badge)] font-semibold">
                <span>MCAS Moyen : +51.6% de marge brute</span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={financialData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ork-comp-chart-base-grid-color)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} stroke="var(--ork-comp-chart-base-axis-color)" fontSize={11} />
                  <YAxis 
                    tickLine={false} 
                    stroke="var(--ork-comp-chart-base-axis-color)" 
                    fontSize={11}
                    tickFormatter={(val) => `${(val / 1000000).toFixed(0)} M`}
                  />
                  <Tooltip 
                    labelStyle={{ color: 'var(--ork-use-text-default)', fontWeight: 600 }}
                    itemStyle={{ color: 'var(--ork-use-text-default)' }}
                    contentStyle={{ backgroundColor: 'var(--ork-use-surface-overlay)', borderRadius: '8px', color: 'var(--ork-use-text-default)', border: '1px solid var(--ork-use-border-default)', fontSize: '12px', boxShadow: 'var(--ork-use-elevation-overlay)' }}
                    formatter={(val: any, name: any) => {
                      if (name === 'revenue') return [`${val.toLocaleString('fr-FR')} FCFA`, 'Chiffre d\'Affaires Ventes'];
                      if (name === 'feedOpex') return [`${val.toLocaleString('fr-FR')} FCFA`, 'Coût Provende (Aliment)'];
                      if (name === 'vetOpex') return [`${val.toLocaleString('fr-FR')} FCFA`, 'Soins & Prophylaxie Vétérinaire'];
                      if (name === 'grossMarginFeed') return [`${val.toLocaleString('fr-FR')} FCFA`, 'Marge sur Aliment (MCAS)'];
                      return [val, name];
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    formatter={(val) => {
                      if (val === 'revenue') return <span className="text-xs text-foreground font-semibold">Ventes (FCFA)</span>;
                      if (val === 'feedOpex') return <span className="text-xs text-t-action font-semibold">Coût Provende</span>;
                      if (val === 'vetOpex') return <span className="text-xs text-muted font-semibold">Vétérinaire</span>;
                      if (val === 'grossMarginFeed') return <span className="text-xs text-t-brand font-semibold">Marge Brute MCAS</span>;
                      return val;
                    }}
                  />
                  <Bar dataKey="feedOpex" stackId="costs" fill="var(--ork-use-data-2-mark)" radius={[0, 0, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                  <Bar dataKey="vetOpex" stackId="costs" fill="var(--ork-use-data-other-mark)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--ork-use-data-3-mark)" strokeWidth={3} dot={{ fill: 'var(--ork-use-data-3-mark)', r: 4 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="grossMarginFeed" stroke="var(--ork-use-data-1-mark)" strokeWidth={3} dot={{ fill: 'var(--ork-use-data-1-mark)', r: 4 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
