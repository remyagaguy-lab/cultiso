'use client';

import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  AreaChart, Area, ComposedChart, Scatter, Cell, PieChart, Pie
} from 'recharts';
import { 
  GraphNewUpIcon as TrendingUp,
  GraphDownNewIcon as TrendingDown,
  BoxIcon as Package,
  DeliveryIcon as Truck,
  MagnifierIcon as Search,
  BellIcon as Bell,
  SettingsIcon as Settings,
  HamburgerMenuIcon as Menu,
  AltArrowDownIcon as ChevronDown,
  ArrowRightUpIcon as ArrowUpRight,
  ArrowRightDownIcon as ArrowDownRight,
  Pulse2Icon as Activity,
  PercentIcon as Percent,
  ScaleIcon as Scale,
  Buildings2Icon as Warehouse,
  AnchorIcon as Anchor,
  InfoCircleIcon as Info,
} from '@solar-icons/react/linear';
import {
  WalletMoneyIcon as Wallet,
  BoltIcon as Zap,
} from '@solar-icons/react/bold-duotone';

// --- MOCK DATA ---
const marketPrices = [
  { month: 'Jan', riz: 380, mais: 205, soja: 420 },
  { month: 'Fév', riz: 390, mais: 210, soja: 430 },
  { month: 'Mar', riz: 405, mais: 215, soja: 445 },
  { month: 'Avr', riz: 400, mais: 220, soja: 440 },
  { month: 'Mai', riz: 415, mais: 225, soja: 460 },
  { month: 'Juin', riz: 410, mais: 230, soja: 450 },
  { month: 'Juil', riz: 425, mais: 235, soja: 470 },
];

const treasuryData = [
  { week: 'S1', entrees: 82000000, sorties: 64000000 },
  { week: 'S2', entrees: 95000000, sorties: 72000000 },
  { week: 'S3', entrees: 72000000, sorties: 88000000 },
  { week: 'S4', entrees: 118000000, sorties: 78500000 },
];

const warehouseData = [
  { name: 'Silo A (Riz local)', volume: 8500, capacity: 10000, lossRate: 0.8 },
  { name: 'Silo B (Maïs)', volume: 6200, capacity: 8000, lossRate: 1.2 },
  { name: 'Entrepôt C (Soja)', volume: 3100, capacity: 5000, lossRate: 0.5 },
];

const logisticsData = [
  { name: 'En transit', value: 45, color: 'var(--ork-use-data-1-mark)' },
  { name: 'À quai (Chargement)', value: 25, color: 'var(--ork-use-data-2-mark)' },
  { name: 'Déchargement', value: 15, color: 'var(--ork-use-data-4-mark)' },
  { name: 'En attente', value: 15, color: 'var(--ork-use-data-other-mark)' },
];

const marginData = [
  { month: 'Jan', physique: 12, forward: 14 },
  { month: 'Fév', physique: 14, forward: 15 },
  { month: 'Mar', physique: 13, forward: 18 },
  { month: 'Avr', physique: 15, forward: 16 },
  { month: 'Mai', physique: 18, forward: 20 },
  { month: 'Juin', physique: 19, forward: 21 },
  { month: 'Juil', physique: 21, forward: 23 },
];

// --- COMPONENTS ---

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative z-0 bg-surface rounded-[var(--ork-use-radius-card)] shadow-raised border border-border overflow-hidden ${className}`}>
    {children}
  </div>
);

const KPICard = ({ title, value, change, isPositive, icon: Icon, unit = "" }: any) => (
  <Card className="p-5 flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <div className="w-10 h-10 rounded-full bg-sunken flex items-center justify-center text-muted border border-border">
        <Icon size={20} />
      </div>
      <div className={`flex items-center space-x-1 text-sm font-medium px-2 py-1 rounded-full ${isPositive ? 'bg-[var(--ork-use-background-success-subtle)] text-t-success' : 'bg-[var(--ork-use-background-danger-subtle)] text-t-danger'}`}>
        {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        <span>{Math.abs(change)}%</span>
      </div>
    </div>
    <div>
      <h3 className="text-muted text-sm font-medium mb-1">{title}</h3>
      <div className="text-2xl font-bold text-foreground font-mono-numbers tracking-tight">
        {value} <span className="text-lg font-normal text-muted">{unit}</span>
      </div>
    </div>
  </Card>
);

export default function NegoceDashboard({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className={embedded ? "bg-background text-foreground flex flex-col" : "min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans"}>
      
      {/* SIDEBAR */}
      {!embedded && (
        <aside className="w-full md:w-64 bg-[var(--ork-ref-primary-12)] text-white flex-shrink-0 md:min-h-screen border-r border-white/10">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-10">
              <div className="w-8 h-8 bg-action rounded-[var(--ork-use-radius-control)] flex items-center justify-center">
                <Scale size={20} className="text-on-action" />
              </div>
              <span className="text-2xl font-title font-bold tracking-tight text-white">Cultima</span>
            </div>
            
            <nav className="space-y-1">
              {[
                { id: 'overview', icon: Activity, label: 'Vue d\'ensemble' },
                { id: 'trading', icon: TrendingUp, label: 'Trading & Marchés' },
                { id: 'treasury', icon: Wallet, label: 'Trésorerie' },
                { id: 'warehouse', icon: Warehouse, label: 'Entrepôts' },
                { id: 'logistics', icon: Truck, label: 'Logistique' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-[var(--ork-use-radius-control)] transition-colors text-sm font-medium ${
                    activeTab === item.id 
                      ? 'bg-white/15 text-white ring-1 ring-inset ring-white/25' 
                      : 'text-white/75 hover:bg-white/10'
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="mt-auto p-6">
             <div className="bg-white/10 rounded-[var(--ork-use-radius-card)] p-4 border border-white/15">
                <div className="flex items-center space-x-3 mb-2">
                   <Anchor size={16} className="text-[var(--ork-ref-secondary-70)]" />
                   <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Port de Lomé</span>
                </div>
                <div className="text-sm">Statut: <span className="text-[var(--ork-ref-primary-70)] font-medium">Opérationnel</span></div>
             </div>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER */}
        {!embedded && (
          <header className="bg-surface border-b border-border h-16 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center flex-1">
              <button className="md:hidden mr-4 text-muted hover:text-foreground">
                <Menu size={24} />
              </button>
              <div className="relative w-64 hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher un contrat, un navire..." 
                  className="w-full pl-10 pr-4 py-2 bg-sunken border border-border rounded-[var(--ork-use-radius-control)] text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--ork-use-border-focused)] transition-all"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-muted hover:text-foreground transition-colors">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-action rounded-full"></span>
              </button>
              <button className="p-2 text-muted hover:text-foreground transition-colors">
                <Settings size={20} />
              </button>
              <div className="w-px h-6 bg-border mx-2"></div>
              <button className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-brand text-on-brand rounded-full flex items-center justify-center font-medium text-sm">
                  JD
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-sm font-medium text-foreground leading-tight">Jean Dupont</div>
                  <div className="text-xs text-muted">Head of Trading</div>
                </div>
                <ChevronDown size={16} className="text-muted" />
              </button>
            </div>
          </header>
        )}

        {/* DASHBOARD CONTENT */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-[1360px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-title font-bold text-foreground tracking-tight m-0">Tableau de Bord Agro-Négoce</h1>
              <p className="text-muted text-sm mt-1 m-0">Synthèse des opérations de négoce et chaîne d&apos;approvisionnement.</p>
            </div>
            <div className="flex items-center gap-1 bg-surface border border-border rounded-[var(--ork-use-radius-control)] p-1 w-fit">
              <button type="button" className="px-3 py-1.5 text-xs font-semibold rounded-[var(--ork-use-radius-control)] bg-selected text-t-brand whitespace-nowrap">Semaine</button>
              <button type="button" className="px-3 py-1.5 text-xs font-medium rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-sunken whitespace-nowrap">Mois</button>
              <button type="button" className="px-3 py-1.5 text-xs font-medium rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-sunken whitespace-nowrap">Année</button>
            </div>
          </div>

          {/* KPI GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <KPICard title="Chiffre d'Affaires (Mois)" value="930" unit="M FCFA" change={8.4} isPositive={true} icon={Wallet} />
            <KPICard title="Volume Physique Stocké" value="17 800" unit="T" change={2.1} isPositive={true} icon={Warehouse} />
            <KPICard title="Marge Nette Moyenne" value="10 800" unit="FCFA/T" change={-1.2} isPositive={false} icon={Percent} />
            <KPICard title="Contrats à Terme" value="245" unit="lots" change={12.5} isPositive={true} icon={TrendingUp} />
          </div>

          {/* MAIN CHARTS AREA */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            
            {/* VEILLE DES PRIX - 2 COLUMNS WIDE */}
            <Card className="xl:col-span-2 p-5 sm:p-6 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-title font-bold text-foreground m-0">Veille des Prix du Marché (Afrique de l&apos;Ouest)</h2>
                  <p className="text-sm text-muted m-0 mt-0.5">Évolution des cours moyens (FCFA/kg)</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 shrink-0">
                   <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded-full bg-[var(--ork-use-data-1-mark)]"></div><span className="text-xs text-foreground font-medium">Riz local</span></div>
                   <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded-full bg-[var(--ork-use-data-2-mark)]"></div><span className="text-xs text-foreground font-medium">Maïs</span></div>
                   <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded-full bg-[var(--ork-use-data-4-mark)]"></div><span className="text-xs text-foreground font-medium">Soja</span></div>
                </div>
              </div>
              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={marketPrices} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ork-comp-chart-base-grid-color)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: 'var(--ork-comp-chart-base-axis-color)', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--ork-comp-chart-base-axis-color)', fontSize: 12}} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--ork-use-surface-overlay)', color: 'var(--ork-use-text-default)', borderRadius: '8px', border: '1px solid var(--ork-use-border-default)', boxShadow: 'var(--ork-use-elevation-overlay)' }}
                      cursor={{ stroke: 'var(--ork-use-border-default)', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Line type="monotone" dataKey="riz" name="Riz local" stroke="var(--ork-use-data-1-mark)" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} isAnimationActive={false} />
                    <Line type="monotone" dataKey="mais" name="Maïs" stroke="var(--ork-use-data-2-mark)" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} isAnimationActive={false} />
                    <Line type="monotone" dataKey="soja" name="Soja" stroke="var(--ork-use-data-4-mark)" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* TRÉSORERIE - 1 COLUMN WIDE */}
            <Card className="p-5 sm:p-6 flex flex-col">
              <div className="mb-6">
                <h2 className="text-lg font-title font-bold text-foreground m-0">Flux de Trésorerie</h2>
                <p className="text-sm text-muted m-0 mt-0.5">Entrées vs Sorties (M FCFA / Semaine)</p>
              </div>
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={treasuryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ork-comp-chart-base-grid-color)" />
                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{fill: 'var(--ork-comp-chart-base-axis-color)', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--ork-comp-chart-base-axis-color)', fontSize: 12}} tickFormatter={(value) => `${Math.round(value/1000000)}M`} />
                    <RechartsTooltip cursor={{fill: 'var(--ork-use-background-neutral-subtle-hover)'}} contentStyle={{ backgroundColor: 'var(--ork-use-surface-overlay)', color: 'var(--ork-use-text-default)', borderRadius: '8px', border: '1px solid var(--ork-use-border-default)', boxShadow: 'var(--ork-use-elevation-overlay)' }} />
                    <Bar dataKey="entrees" name="Entrées" fill="var(--ork-use-data-1-mark)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                    <Bar dataKey="sorties" name="Sorties" fill="var(--ork-use-data-2-mark)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center gap-2">
                 <div className="text-sm text-muted">Balance Nette (Mois)</div>
                 <div className="text-base sm:text-lg font-bold text-t-brand font-mono-numbers whitespace-nowrap">+ 64,5 M FCFA</div>
              </div>
            </Card>

          </div>

          {/* LOWER GRID: LOGISTICS, WAREHOUSE, TRADING WIDGET */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* WAREHOUSE ROTATION & LOSS */}
            <Card className="p-5 sm:p-6 lg:col-span-1">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-forest-ink flex items-center m-0"><Warehouse size={18} className="mr-2 text-muted-moss"/> Stockage & Pertes</h2>
                <p className="text-sm text-muted-moss m-0 mt-0.5">Taux d&apos;occupation et perte matière</p>
              </div>
              
              <div className="space-y-5 mt-6">
                {warehouseData.map((silo, idx) => {
                  const occupancy = (silo.volume / silo.capacity) * 100;
                  const isAlert = silo.lossRate >= 1.0 || occupancy > 80;
                  return (
                    <div key={idx} className="relative">
                      <div className="flex justify-between text-sm mb-1.5 gap-2">
                        <span className="font-medium text-foreground">{silo.name}</span>
                        <span className="text-muted font-mono-numbers whitespace-nowrap">{silo.volume.toLocaleString('fr-FR')} T / {silo.capacity.toLocaleString('fr-FR')} T</span>
                      </div>
                      <div className="h-2.5 w-full bg-sunken rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isAlert ? 'bg-action' : 'bg-brand'}`} 
                          style={{ width: `${occupancy}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs mt-1.5">
                        <span className="text-muted">Occupation: <span className="text-foreground font-medium font-mono-numbers">{occupancy.toFixed(0)}%</span></span>
                        <span className={`flex items-center font-mono-numbers ${silo.lossRate >= 1.0 ? 'text-t-danger font-semibold' : 'text-muted'}`}>
                          <Zap size={12} className="mr-0.5" /> Perte: {silo.lossRate}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 p-3 bg-[var(--ork-use-background-danger-subtle)] border border-[var(--ork-use-border-danger)] rounded-[var(--ork-use-radius-control)] text-xs text-t-danger flex items-start">
                 <Info size={14} className="mr-2 mt-0.5 flex-shrink-0" />
                 <p className="m-0">Alerte: Taux de freinte anormal détecté sur Silo B (Maïs). Vérifier ventilation.</p>
              </div>
            </Card>

            {/* EXPERT WIDGET: DYNAMIC MARGIN CALCULATOR */}
            <Card className="p-5 sm:p-6 lg:col-span-1 bg-gradient-to-br from-[var(--ork-ref-primary-12)] to-[var(--ork-ref-primary-20)] border-[var(--ork-ref-primary-30)] text-white">
              <div className="relative">
                <div className="mb-4">
                  <h2 className="text-lg font-title font-bold text-white flex items-center m-0"><Activity size={18} className="mr-2 text-[var(--ork-ref-primary-70)]"/> Marges Nettes Dynamiques</h2>
                  <p className="text-sm text-white/75 m-0 mt-0.5">Physique vs Couverture (% marge)</p>
                </div>

                <div className="flex items-center gap-4 text-xs mb-3">
                  <span className="inline-flex items-center gap-1.5 text-white/85"><span className="w-2.5 h-2.5 rounded-full bg-[var(--ork-ref-primary-70)]"></span>Physique</span>
                  <span className="inline-flex items-center gap-1.5 text-white/85"><span className="w-2.5 h-2.5 rounded-full bg-[var(--ork-ref-secondary-70)]"></span>Couverture</span>
                </div>

                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={marginData} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPhysique" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--ork-ref-primary-70)" stopOpacity={0.6}/>
                          <stop offset="95%" stopColor="var(--ork-ref-primary-70)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorForward" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--ork-ref-secondary-70)" stopOpacity={0.6}/>
                          <stop offset="95%" stopColor="var(--ork-ref-secondary-70)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: 'var(--ork-ref-neutral-80)', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--ork-ref-neutral-80)', fontSize: 12}} tickFormatter={(val) => `${val}%`} />
                      <RechartsTooltip 
                         contentStyle={{ backgroundColor: 'var(--ork-ref-primary-15)', border: '1px solid var(--ork-ref-primary-40)', borderRadius: '8px', color: 'var(--ork-ref-neutral-96)' }}
                         itemStyle={{ color: 'var(--ork-ref-neutral-96)' }}
                      />
                      <Area type="monotone" dataKey="physique" name="Physique (%)" stroke="var(--ork-ref-primary-70)" fillOpacity={1} fill="url(#colorPhysique)" strokeWidth={2} isAnimationActive={false} />
                      <Area type="monotone" dataKey="forward" name="Couverture (%)" stroke="var(--ork-ref-secondary-70)" fillOpacity={1} fill="url(#colorForward)" strokeWidth={2} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-white/10 rounded-[var(--ork-use-radius-control)] p-3 border border-white/15">
                    <div className="text-xs text-white/70 mb-1">Spread Moyen</div>
                    <div className="text-base sm:text-lg font-semibold text-[var(--ork-ref-primary-70)] font-mono-numbers">+1 575 FCFA/T</div>
                  </div>
                  <div className="bg-white/10 rounded-[var(--ork-use-radius-control)] p-3 border border-white/15">
                    <div className="text-xs text-white/70 mb-1">Risque Base</div>
                    <div className="text-base sm:text-lg font-semibold text-[var(--ork-ref-secondary-70)]">Modéré</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* LOGISTICS */}
            <Card className="p-5 sm:p-6 lg:col-span-1">
              <div className="mb-2">
                <h2 className="text-lg font-title font-bold text-foreground flex items-center m-0"><Truck size={18} className="mr-2 text-muted"/> Flux Logistiques</h2>
                <p className="text-sm text-muted m-0 mt-0.5">Statut des expéditions/réceptions</p>
              </div>
              
              <div className="flex items-center justify-center h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={logisticsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {logisticsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--ork-use-surface-overlay)', color: 'var(--ork-use-text-default)', borderRadius: '8px', border: '1px solid var(--ork-use-border-default)', boxShadow: 'var(--ork-use-elevation-overlay)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-2 mt-2">
                {logisticsData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <div className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-muted">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground font-mono-numbers">{item.value}%</span>
                  </div>
                ))}
              </div>
            </Card>

          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
