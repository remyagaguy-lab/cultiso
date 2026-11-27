"use client";

import React, { useState } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts';
import { 
  LayoutDashboard, Factory, FlaskConical, PackageSearch, Wallet, Wrench, 
  Bell, Search, UserCircle, ArrowUpRight, ArrowDownRight, Settings, Menu, 
  AlertTriangle, CheckCircle2, Clock, ChevronDown
} from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- MOCK DATA ---

const yieldData = [
  { name: 'Lun', rendement: 78, cible: 80, pertes: 2.5 },
  { name: 'Mar', rendement: 81, cible: 80, pertes: 2.1 },
  { name: 'Mer', rendement: 83, cible: 80, pertes: 1.8 },
  { name: 'Jeu', rendement: 82, cible: 80, pertes: 1.9 },
  { name: 'Ven', rendement: 85, cible: 80, pertes: 1.5 },
  { name: 'Sam', rendement: 84, cible: 80, pertes: 1.6 },
  { name: 'Dim', rendement: 86, cible: 80, pertes: 1.2 },
];

const stockData = [
  { name: 'Matières Premières', value: 295, color: 'var(--ork-use-data-1-mark)' },
  { name: 'Produits Finis', value: 210, color: 'var(--ork-use-data-3-mark)' },
  { name: 'Emballages', value: 98, color: 'var(--ork-use-data-2-mark)' },
  { name: 'En transit', value: 52, color: 'var(--ork-use-data-4-mark)' },
];

const activeBatches = [
  { id: 'L-2409-A', produit: 'Jus d\'Ananas Premium', phase: 'Pasteurisation', statut: 'En cours', progression: 65, responsable: 'K. Mensah' },
  { id: 'L-2409-B', produit: 'Farine de Maïs Enrichie', phase: 'Mouture', statut: 'En attente', progression: 30, responsable: 'A. Lawson' },
  { id: 'L-2409-C', produit: 'Huile de Palme Raffinée', phase: 'Pressage', statut: 'Optimisé', progression: 90, responsable: 'S. Koffi' },
  { id: 'L-2409-D', produit: 'Mangues Séchées', phase: 'Séchage (Four 2)', statut: 'En cours', progression: 45, responsable: 'L. Agbéko' },
];

const qualityAlerts = [
  { id: 'Q-101', type: 'DLUO Proche', lot: 'PF-2311-A', produit: 'Farine de Maïs', date: 'Dans 15 jours', severite: 'high' },
  { id: 'Q-102', type: 'Contrôle T°', lot: 'L-2409-A', produit: 'Jus d\'Ananas', date: 'Actuel', severite: 'medium' },
  { id: 'Q-103', type: 'Maintenance', lot: '-', produit: 'Presse Hydraulique 3', date: 'Demain', severite: 'low' },
];

// --- COMPONENTS ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-surface rounded-[var(--ork-use-radius-card)] border border-border shadow-raised overflow-hidden", className)}>
    {children}
  </div>
);

const KPICard = ({ title, value, trend, trendValue, icon: Icon, color }: any) => {
  const isPositive = trend === 'up';
  return (
    <Card className="p-6 transition-all hover:shadow-overlay">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-muted mb-1">{title}</p>
          <h3 className="text-2xl font-title font-bold text-foreground font-mono-numbers">{value}</h3>
        </div>
        <div className={cn("p-3 rounded-[var(--ork-use-radius-control)]", color === 'green' ? 'bg-[var(--ork-use-background-brand-subtle)] text-t-brand' : 'bg-[var(--ork-use-background-action-subtle)] text-t-action')}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm">
        <span className={cn("flex items-center font-medium", isPositive ? 'text-t-success' : 'text-t-danger')}>
          {isPositive ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
          {trendValue}
        </span>
        <span className="text-muted ml-2">vs mois précédent</span>
      </div>
    </Card>
  );
};

export default function TransformationDashboard({ embedded = false }: { embedded?: boolean }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className={embedded ? "flex flex-col bg-background text-foreground" : "flex h-screen overflow-hidden bg-background text-foreground"}>
      {/* SIDEBAR */}
      {!embedded && (
        <aside className={cn(
          "bg-[var(--ork-ref-primary-12)] text-white transition-all duration-300 flex flex-col relative z-20",
          isSidebarOpen ? "w-64" : "w-20 lg:w-64"
        )}>
          <div className="h-16 flex items-center justify-center border-b border-white/10 px-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[var(--ork-use-radius-control)] bg-action flex items-center justify-center shrink-0">
                <Factory className="w-5 h-5 text-on-action" />
              </div>
              <span className={cn("font-title font-bold text-xl tracking-wider uppercase", !isSidebarOpen && "lg:block hidden")}>
                Cultima
              </span>
            </div>
          </div>

          <nav className="flex-1 py-6 px-3 space-y-1">
            {[
              { icon: LayoutDashboard, label: "Vue d'ensemble", active: true },
              { icon: Factory, label: "Production & Lots" },
              { icon: FlaskConical, label: "Contrôle Qualité" },
              { icon: PackageSearch, label: "Gestion Stocks" },
              { icon: Wallet, label: "Trésorerie" },
              { icon: Wrench, label: "Maintenance" },
            ].map((item, i) => (
              <button key={i} className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-[var(--ork-use-radius-control)] transition-colors text-sm font-medium",
                item.active 
                  ? "bg-white/15 text-white ring-1 ring-inset ring-white/25" 
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              )}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span className={cn(!isSidebarOpen && "lg:block hidden")}>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-[var(--ork-use-radius-control)] text-white/75 hover:bg-white/10 transition-colors text-sm font-medium">
              <Settings className="w-5 h-5 shrink-0" />
              <span className={cn(!isSidebarOpen && "lg:block hidden")}>Paramètres</span>
            </button>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* TOPBAR */}
        {!embedded && (
          <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0 z-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-sunken rounded-[var(--ork-use-radius-control)] lg:hidden">
                <Menu className="w-5 h-5 text-foreground" />
              </button>
              <div className="hidden md:flex relative w-96">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input 
                  type="text" 
                  placeholder="Rechercher un lot, un produit, un équipement..." 
                  className="w-full bg-sunken border border-border rounded-[var(--ork-use-radius-control)] pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:ring-2 focus:ring-[var(--ork-use-border-focused)] focus:outline-none"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-5">
              <button className="relative p-2 text-muted hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-action rounded-full"></span>
              </button>
              <div className="h-8 w-px bg-border"></div>
              <div className="flex items-center gap-3 cursor-pointer">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-semibold text-foreground leading-none">Dir. Operations</p>
                  <p className="text-xs text-muted mt-1">Usine Nord</p>
                </div>
                <UserCircle className="w-9 h-9 text-t-brand" />
                <ChevronDown className="w-4 h-4 text-muted" />
              </div>
            </div>
          </header>
        )}

        {/* SCROLLABLE DASHBOARD AREA */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-[1360px] mx-auto space-y-6">
            
            {/* PAGE HEADER */}
            <div>
              <h1 className="text-xl sm:text-2xl font-title font-bold text-foreground m-0">Tableau de bord de Transformation</h1>
              <p className="text-muted text-sm mt-1 m-0">Aperçu en temps réel des opérations agroalimentaires.</p>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <KPICard title="Trésorerie Actuelle" value="816 M FCFA" trend="up" trendValue="+4.2%" icon={Wallet} color="green" />
              <KPICard title="Rendement Global" value="84.5%" trend="up" trendValue="+1.5%" icon={FlaskConical} color="orange" />
              <KPICard title="Taux de Perte" value="1.8%" trend="down" trendValue="-0.4%" icon={AlertTriangle} color="green" />
              <KPICard title="Parc Machines" value="98.2%" trend="up" trendValue="+0.8%" icon={Wrench} color="green" />
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* RENDEMENT CHART */}
              <Card className="lg:col-span-2 p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="font-title font-bold text-foreground text-lg m-0">Évolution du Rendement &amp; Pertes</h3>
                    <p className="text-sm text-muted m-0 mt-0.5">Semaine en cours (Cible: 80%)</p>
                  </div>
                  <select className="bg-sunken border border-border text-foreground text-sm rounded-[var(--ork-use-radius-control)] px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ork-use-border-focused)] w-full sm:w-auto">
                    <option>Tous les ateliers</option>
                    <option>Jus de fruits</option>
                    <option>Mouture</option>
                  </select>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={yieldData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRendement" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--ork-use-data-1-mark)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--ork-use-data-1-mark)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ork-comp-chart-base-grid-color)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ork-comp-chart-base-axis-color)' }} dy={10} />
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ork-comp-chart-base-axis-color)' }} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ork-comp-chart-base-axis-color)' }} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'var(--ork-use-surface-overlay)', color: 'var(--ork-use-text-default)', borderRadius: '8px', border: '1px solid var(--ork-use-border-default)', boxShadow: 'var(--ork-use-elevation-overlay)' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      <Area yAxisId="left" type="monotone" dataKey="rendement" name="Rendement (%)" stroke="var(--ork-use-data-1-mark)" strokeWidth={3} fillOpacity={1} fill="url(#colorRendement)" isAnimationActive={false} />
                      <Line yAxisId="left" type="monotone" dataKey="cible" name="Cible (%)" stroke="var(--ork-use-data-other-mark)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="pertes" name="Pertes (%)" stroke="var(--ork-use-data-2-mark)" strokeWidth={2} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* STOCK CHART */}
              <Card className="p-5 sm:p-6">
                <div className="mb-6">
                  <h3 className="font-title font-bold text-foreground text-lg m-0">Répartition des Stocks</h3>
                  <p className="text-sm text-muted m-0 mt-0.5">Valeur estimée en M FCFA</p>
                </div>
                <div className="h-60 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stockData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {stockData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value) => `${value} M FCFA`}
                        contentStyle={{ backgroundColor: 'var(--ork-use-surface-overlay)', color: 'var(--ork-use-text-default)', borderRadius: '8px', border: '1px solid var(--ork-use-border-default)', boxShadow: 'var(--ork-use-elevation-overlay)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-xl font-bold text-foreground font-mono-numbers">655 M</span>
                    <span className="text-xs text-muted">FCFA Stocks</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {stockData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                      <div className="text-xs min-w-0">
                        <p className="text-foreground font-medium truncate m-0">{item.name}</p>
                        <p className="text-muted m-0 font-mono-numbers">{item.value} M FCFA</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* BOTTOM PANELS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* BATCH TRACKING */}
              <Card className="lg:col-span-2 p-0 flex flex-col">
                <div className="p-5 sm:p-6 border-b border-border flex flex-wrap justify-between items-center gap-2 bg-surface">
                  <div>
                    <h3 className="font-title font-bold text-foreground text-lg m-0">Suivi des Lots en Cours</h3>
                    <p className="text-sm text-muted m-0 mt-0.5">Traçabilité et avancement de la production</p>
                  </div>
                  <button type="button" className="text-sm text-t-brand font-medium hover:underline whitespace-nowrap shrink-0">Voir tout</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm text-left">
                    <thead className="text-xs text-muted uppercase bg-sunken/70">
                      <tr>
                        <th className="px-5 py-3.5 font-medium whitespace-nowrap">ID Lot</th>
                        <th className="px-5 py-3.5 font-medium">Produit</th>
                        <th className="px-5 py-3.5 font-medium">Phase Actuelle</th>
                        <th className="px-5 py-3.5 font-medium">Progression</th>
                        <th className="px-5 py-3.5 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeBatches.map((batch, i) => (
                        <tr key={i} className="hover:bg-sunken/50 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-foreground font-mono-numbers whitespace-nowrap">{batch.id}</td>
                          <td className="px-5 py-3.5 text-foreground">{batch.produit}</td>
                          <td className="px-5 py-3.5 text-muted whitespace-nowrap">{batch.phase}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-full min-w-[64px] bg-sunken rounded-full h-2">
                                <div 
                                  className="bg-brand h-2 rounded-full" 
                                  style={{ width: `${batch.progression}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium w-9 font-mono-numbers text-muted shrink-0">{batch.progression}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-[var(--ork-use-radius-badge)] text-xs font-medium border whitespace-nowrap",
                              batch.statut === 'En cours' ? 'bg-[var(--ork-use-background-info-subtle)] text-t-info border-[var(--ork-use-border-info)]' :
                              batch.statut === 'Optimisé' ? 'bg-[var(--ork-use-background-success-subtle)] text-t-success border-[var(--ork-use-border-success)]' :
                              'bg-[var(--ork-use-background-action-subtle)] text-t-action border-[var(--ork-use-border-warning)]'
                            )}>
                              {batch.statut}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* QUALITY ALERTS */}
              <Card className="p-0 flex flex-col">
                <div className="p-6 border-b border-border">
                  <h3 className="font-title font-bold text-foreground text-lg flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-t-action" />
                    Contrôle Qualité &amp; DLC
                  </h3>
                </div>
                <div className="p-4 flex-1">
                  <div className="space-y-4">
                    {qualityAlerts.map((alert, i) => (
                      <div key={i} className="flex items-start gap-4 p-3 rounded-[var(--ork-use-radius-control)] border border-border bg-sunken/50">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          alert.severite === 'high' ? 'bg-[var(--ork-use-background-danger-subtle)] text-t-danger' :
                          alert.severite === 'medium' ? 'bg-[var(--ork-use-background-action-subtle)] text-t-action' :
                          'bg-[var(--ork-use-background-info-subtle)] text-t-info'
                        )}>
                          {alert.type.includes('DLUO') ? <Clock className="w-5 h-5" /> : 
                           alert.type.includes('T°') ? <AlertTriangle className="w-5 h-5" /> : 
                           <Wrench className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{alert.type}</p>
                          <p className="text-xs text-muted mt-0.5">
                            {alert.produit} <span className="mx-1">•</span> Lot: {alert.lot}
                          </p>
                          <p className={cn(
                            "text-xs font-medium mt-2",
                            alert.severite === 'high' ? 'text-t-danger' : 'text-muted'
                          )}>
                            {alert.date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-6 py-2.5 rounded-[var(--ork-use-radius-button)] border border-border text-sm font-medium text-foreground hover:bg-sunken transition-colors">
                    Voir le rapport complet
                  </button>
                </div>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
