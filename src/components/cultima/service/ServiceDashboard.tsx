'use client';

import React, { useState } from 'react';
import { 
  WaterdropsIcon as Droplets,
  UsersGroupRoundedIcon as Users,
  Chart2Icon as LineChart,
  DocumentTextIcon as FileText,
  SettingsIcon as Settings,
  BellIcon as Bell,
  MagnifierIcon as Search,
  HamburgerMenuIcon as Menu,
  MenuDotsVerticalIcon as MoreVertical,
  GraphNewUpIcon as TrendingUp,
  GraphDownNewIcon as TrendingDown,
  CheckCircleIcon as CheckCircle2,
  ClockCircleIcon as Clock,
  ArrowRightIcon as ArrowRight,
  AltArrowDownIcon as ChevronDown,
  Pulse2Icon as Activity,
  MapPointIcon as MapPin,
  CalendarIcon as Calendar,
} from '@solar-icons/react/linear';
import {
  WrenchIcon as Tractor,
  WrenchIcon as Wrench,
  WalletMoneyIcon as Wallet,
} from '@solar-icons/react/bold-duotone';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts';

// --- MOCK DATA ---

const revenueData = [
  { name: 'Jan', chiffreAffaires: 240, charges: 180 },
  { name: 'Fév', chiffreAffaires: 290, charges: 195 },
  { name: 'Mar', chiffreAffaires: 410, charges: 250 },
  { name: 'Avr', chiffreAffaires: 580, charges: 310 },
  { name: 'Mai', chiffreAffaires: 620, charges: 330 },
  { name: 'Juin', chiffreAffaires: 680, charges: 360 },
];

const fleetStatusData = [
  { name: 'En mission', value: 58, color: 'var(--ork-use-data-1-mark)' },
  { name: 'Maintenance', value: 14, color: 'var(--ork-use-data-2-mark)' },
  { name: 'Au dépôt', value: 28, color: 'var(--ork-use-data-other-mark)' },
];

const activeMissions = [
  { id: 'MSN-809', type: 'Forage Profond', client: 'Ferme Cultiso', team: 'Équipe Alpha', status: 'En cours', progress: 65, equipement: 'Foreuse T-90', location: 'Parcelle Nord' },
  { id: 'MSN-810', type: 'Récolte mécanisée', client: 'Coopérative Kloto', team: 'Équipe Beta', status: 'En cours', progress: 40, equipement: 'Moissonneuse C-2', location: 'Secteur 4' },
  { id: 'MSN-811', type: 'Labour', client: 'Domaine Zio', team: 'Équipe Gamma', status: 'En attente', progress: 0, equipement: 'Tracteur 140 CV', location: 'Champs Est' },
  { id: 'MSN-812', type: 'Irrigation', client: 'Verger Agou', team: 'Équipe Delta', status: 'Terminé', progress: 100, equipement: 'Goutte-à-goutte', location: 'Vergers Sud' },
];

const pendingQuotes = [
  { id: 'DEV-1452', client: 'Domaine Agou', amount: '16 000 000 FCFA', service: 'Installation Goutte-à-goutte', status: 'Attente signature', date: 'Aujourd\'hui' },
  { id: 'DEV-1453', client: 'Ferme Zio', amount: '8 400 000 FCFA', service: 'Location Tracteur + Charrue', status: 'Négociation', date: 'Hier' },
  { id: 'DEV-1454', client: 'Agri-Plateaux', amount: '29 500 000 FCFA', service: 'Contrat Récolte 300 ha', status: 'Envoyé', date: 'Il y a 2j' },
];

export default function ServiceDashboard({ embedded = false }: { embedded?: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className={embedded ? "flex flex-col bg-background text-foreground" : "min-h-screen flex bg-background font-sans text-foreground"}>
      
      {/* --- SIDEBAR --- */}
      {!embedded && (
        <aside 
          className={`${sidebarOpen ? 'w-64' : 'w-20'} flex-shrink-0 bg-[var(--ork-ref-primary-15)] text-white transition-all duration-300 flex flex-col sticky top-0 h-screen z-50`}
        >
          <div className="h-20 flex items-center justify-between px-5 border-b border-white/10">
            {sidebarOpen ? (
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-action rounded-[var(--ork-use-radius-control)] flex items-center justify-center shadow-raised">
                     <Tractor size={24} className="text-on-action" />
                  </div>
                  <span className="font-title font-bold text-2xl tracking-wide">Cultima</span>
               </div>
            ) : (
               <div className="w-10 h-10 bg-action rounded-[var(--ork-use-radius-control)] flex items-center justify-center mx-auto shadow-raised">
                  <Tractor size={24} className="text-on-action" />
               </div>
            )}
          </div>
          
          <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
             <NavItem icon={<LineChart size={20} />} label="Tableau de Bord" active collapsed={!sidebarOpen} />
             <NavItem icon={<Wallet size={20} />} label="Trésorerie" collapsed={!sidebarOpen} />
             <NavItem icon={<MapPin size={20} />} label="Dispatch & Planning" collapsed={!sidebarOpen} />
             <NavItem icon={<Wrench size={20} />} label="Flotte & Matériel" collapsed={!sidebarOpen} />
             <NavItem icon={<Users size={20} />} label="Équipes & RH" collapsed={!sidebarOpen} />
             <NavItem icon={<FileText size={20} />} label="CRM & Devis" collapsed={!sidebarOpen} />
          </nav>

          <div className="p-4 border-t border-white/10">
            <NavItem icon={<Settings size={20} />} label="Paramètres" collapsed={!sidebarOpen} />
          </div>
        </aside>
      )}

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* TOP HEADER */}
        {!embedded && (
          <header className="h-20 bg-surface border-b border-border flex items-center justify-between px-6 lg:px-10 z-10">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-[var(--ork-use-radius-control)] text-muted hover:bg-sunken transition-colors"
              >
                <Menu size={20} />
              </button>
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher un devis, matériel, équipe..." 
                  className="pl-10 pr-4 py-2 bg-sunken border border-border rounded-[var(--ork-use-radius-control)] text-sm text-foreground placeholder:text-muted focus:border-[var(--ork-use-border-brand)] outline-none w-80 transition-all focus:bg-surface"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-5">
              <button className="relative p-2 text-muted hover:text-t-brand transition-colors">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-action rounded-full border-2 border-surface"></span>
              </button>
              <div className="h-8 w-px bg-border"></div>
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-[var(--ork-use-background-brand-subtle)] flex items-center justify-center text-t-brand font-bold text-sm">
                  JD
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-semibold text-foreground group-hover:text-t-brand transition-colors">Jean Dupont</p>
                  <p className="text-xs text-muted">Dir. Opérations</p>
                </div>
                <ChevronDown size={16} className="text-muted hidden md:block" />
              </div>
            </div>
          </header>
        )}

        {/* DASHBOARD CONTENT */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-[1360px] mx-auto">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-title font-bold text-foreground tracking-tight m-0">Vue d&apos;Ensemble Opérationnelle</h1>
              <p className="text-muted text-sm mt-1 m-0">Supervision de l&apos;activité, trésorerie et flotte matérielle en temps réel.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" className="px-3.5 py-2 bg-surface border border-border rounded-[var(--ork-use-radius-button)] text-xs font-semibold text-foreground hover:bg-sunken transition-colors flex items-center gap-2 whitespace-nowrap">
                <Calendar size={15} />
                Période : Ce Mois
              </button>
              <button type="button" className="px-3.5 py-2 bg-action text-on-action rounded-[var(--ork-use-radius-button)] text-xs font-semibold hover:bg-[var(--ork-use-background-action-bold-hover)] transition-colors flex items-center gap-2 whitespace-nowrap">
                Nouvelle Mission
              </button>
            </div>
          </div>

          {/* KPI ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            
            <KpiCard 
              title="Trésorerie Nette" 
              value="296 M FCFA" 
              trend="+12.5%" 
              isPositive={true} 
              icon={<Wallet size={20} className="text-t-brand" />}
              iconBg="bg-[var(--ork-use-background-brand-subtle)]"
              subtext="vs mois dernier"
            />
            
            <KpiCard 
              title="Occupation Flotte" 
              value="84%" 
              trend="+4.2%" 
              isPositive={true} 
              icon={<Tractor size={20} className="text-t-action" />}
              iconBg="bg-[var(--ork-use-background-action-subtle)]"
              subtext="Objectif: >80%"
            />
            
            <KpiCard 
              title="Missions en Cours" 
              value="18" 
              trend="-2" 
              isPositive={false} 
              icon={<Activity size={20} className="text-t-brand" />}
              iconBg="bg-[var(--ork-use-background-brand-subtle)]"
              subtext="3 nécessitent attention"
            />
            
            <KpiCard 
              title="Pipeline Devis (CRM)" 
              value="820 M FCFA" 
              trend="+18%" 
              isPositive={true} 
              icon={<FileText size={20} className="text-t-action" />}
              iconBg="bg-[var(--ork-use-background-action-subtle)]"
              subtext="32 devis en attente"
            />

          </div>

          {/* CHARTS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Financial Chart */}
            <div className="bg-surface rounded-[var(--ork-use-radius-card)] shadow-raised border border-border p-5 sm:p-6 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                <div>
                  <h2 className="text-lg font-title font-bold text-foreground m-0">Performances Financières</h2>
                  <p className="text-sm text-muted m-0 mt-0.5">Chiffre d&apos;affaires vs Charges (en M FCFA)</p>
                </div>
                <button type="button" className="text-xs sm:text-sm text-t-brand font-semibold hover:underline flex items-center gap-1 whitespace-nowrap shrink-0">
                  Rapport complet <ArrowRight size={14} />
                </button>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--ork-use-data-1-mark)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--ork-use-data-1-mark)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCharges" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--ork-use-data-2-mark)" stopOpacity={0.12}/>
                        <stop offset="95%" stopColor="var(--ork-use-data-2-mark)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ork-comp-chart-base-grid-color)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--ork-comp-chart-base-axis-color)', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--ork-comp-chart-base-axis-color)', fontSize: 12}} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--ork-use-surface-overlay)', color: 'var(--ork-use-text-default)', borderRadius: '12px', border: '1px solid var(--ork-use-border-default)', boxShadow: 'var(--ork-use-elevation-overlay)' }}
                    />
                    <Area type="monotone" dataKey="chiffreAffaires" name="CA Brut" stroke="var(--ork-use-data-1-mark)" strokeWidth={3} fillOpacity={1} fill="url(#colorCA)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="charges" name="Charges" stroke="var(--ork-use-data-2-mark)" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorCharges)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Fleet Status Donut */}
            <div className="bg-surface rounded-[var(--ork-use-radius-card)] shadow-raised border border-border p-5 sm:p-6 flex flex-col">
              <div className="mb-4">
                <h2 className="text-lg font-title font-bold text-foreground m-0">Disponibilité du Matériel</h2>
                <p className="text-sm text-muted m-0 mt-0.5">Répartition du parc actuel</p>
              </div>
              <div className="flex-1 min-h-[200px] relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fleetStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {fleetStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--ork-use-surface-overlay)', color: 'var(--ork-use-text-default)', borderRadius: '8px', border: '1px solid var(--ork-use-border-default)', boxShadow: 'var(--ork-use-elevation-overlay)' }}
                      itemStyle={{ color: 'var(--ork-use-text-default)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-foreground font-mono-numbers">100</span>
                  <span className="text-xs text-muted">Unités totales</span>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {fleetStatusData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-muted">{item.name}</span>
                    </div>
                    <span className="font-semibold text-foreground font-mono-numbers">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
            
          </div>

          {/* TABLES ROW */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Active Missions */}
            <div className="bg-surface rounded-[var(--ork-use-radius-card)] shadow-raised border border-border overflow-hidden flex flex-col">
              <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between gap-2">
                 <div>
                    <h2 className="text-lg font-title font-bold text-foreground m-0">Missions Terrain (Live)</h2>
                    <p className="text-sm text-muted m-0 mt-0.5">Dispatching des équipes et avancement</p>
                 </div>
                 <button type="button" aria-label="Options des missions terrain" className="p-2 hover:bg-sunken rounded-[var(--ork-use-radius-control)] text-muted transition-colors shrink-0">
                    <MoreVertical size={18} />
                 </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left border-collapse">
                  <thead>
                    <tr className="bg-sunken/70 text-muted text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">Mission / Localisation</th>
                      <th className="px-4 py-3 font-medium">Équipe & Matériel</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 font-medium">Progression</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {activeMissions.map((mission) => (
                      <tr key={mission.id} className="hover:bg-sunken/50 transition-colors group">
                        <td className="px-4 py-3.5 align-top">
                          <p className="font-semibold text-foreground m-0">{mission.type}</p>
                          <div className="flex items-start gap-1.5 text-muted mt-1 text-xs">
                             <MapPin size={12} className="shrink-0 mt-0.5" />
                             <span>{mission.location} ({mission.client})</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <p className="text-foreground m-0">{mission.team}</p>
                          <p className="text-muted text-xs mt-0.5 m-0">{mission.equipement}</p>
                        </td>
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-[var(--ork-use-radius-badge)] text-xs font-medium border whitespace-nowrap ${
                            mission.status === 'En cours' ? 'bg-[var(--ork-use-background-info-subtle)] text-t-info border-[var(--ork-use-border-info)]' :
                            mission.status === 'Terminé' ? 'bg-[var(--ork-use-background-success-subtle)] text-t-success border-[var(--ork-use-border-success)]' :
                            'bg-[var(--ork-use-background-action-subtle)] text-t-action border-[var(--ork-use-border-warning)]'
                          }`}>
                            {mission.status === 'En cours' && <Activity size={10} className="mr-1.5 shrink-0" />}
                            {mission.status === 'Terminé' && <CheckCircle2 size={10} className="mr-1.5 shrink-0" />}
                            {mission.status === 'En attente' && <Clock size={10} className="mr-1.5 shrink-0" />}
                            {mission.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex items-center gap-2.5 min-w-[84px]">
                            <div className="w-full bg-sunken rounded-full h-2">
                              <div 
                                className="h-2 rounded-full bg-brand" 
                                style={{ width: `${mission.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium font-mono-numbers text-muted w-9 shrink-0">{mission.progress}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-border text-center">
                 <button type="button" className="text-sm font-medium text-t-brand hover:underline">Voir le planning complet</button>
              </div>
            </div>

            {/* CRM Pending Quotes */}
            <div className="bg-surface rounded-[var(--ork-use-radius-card)] shadow-raised border border-border flex flex-col">
              <div className="p-5 sm:p-6 border-b border-border flex flex-wrap items-center justify-between gap-2">
                 <div>
                    <h2 className="text-lg font-title font-bold text-foreground m-0">Derniers Devis (CRM)</h2>
                    <p className="text-sm text-muted m-0 mt-0.5">Opportunités en cours de négociation</p>
                 </div>
                 <button type="button" className="text-xs sm:text-sm px-3 py-1.5 rounded-[var(--ork-use-radius-button)] border border-border text-foreground hover:bg-sunken font-medium transition-colors whitespace-nowrap shrink-0">
                    Nouveau Devis
                 </button>
              </div>
              
              <div className="flex-1 p-5 sm:p-6 space-y-4">
                {pendingQuotes.map((quote) => (
                  <div key={quote.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[var(--ork-use-radius-card)] border border-border hover:border-[var(--ork-use-border-selected)] transition-all group bg-sunken/40">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-[var(--ork-use-radius-control)] bg-surface border border-border flex items-center justify-center text-muted group-hover:text-t-brand group-hover:bg-[var(--ork-use-background-brand-subtle)] transition-colors shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground group-hover:text-t-brand transition-colors m-0">{quote.client}</h3>
                        <p className="text-sm text-muted mt-0.5 m-0">{quote.service}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                           <span className="text-xs text-muted flex items-center gap-1 whitespace-nowrap">
                             <Clock size={12} /> {quote.date}
                           </span>
                           <span className="text-xs font-medium px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] bg-sunken text-foreground whitespace-nowrap">
                             {quote.status}
                           </span>
                        </div>
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0 pl-13 sm:pl-0">
                      <p className="font-bold text-sm sm:text-base text-foreground font-mono-numbers whitespace-nowrap m-0">{quote.amount}</p>
                      <p className="text-xs text-muted mt-0.5 font-mono-numbers whitespace-nowrap m-0">{quote.id}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-border text-center">
                 <button type="button" className="text-sm font-medium text-foreground hover:text-t-brand flex items-center justify-center gap-2 w-full">
                    Accéder au CRM <ArrowRight size={16} />
                 </button>
              </div>
            </div>

          </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// --- SUB-COMPONENTS ---

function NavItem({ icon, label, active = false, collapsed = false }: { icon: React.ReactNode, label: string, active?: boolean, collapsed?: boolean }) {
  return (
    <button className={`w-full flex items-center gap-3 px-3 py-3 rounded-[var(--ork-use-radius-control)] transition-all group ${
      active 
        ? 'bg-white/15 text-white shadow-raised' 
        : 'text-white/75 hover:bg-white/10 hover:text-white'
    } ${collapsed ? 'justify-center' : 'justify-start'}`}>
      <span className={`${active ? 'text-white' : 'text-white/75 group-hover:text-white'} transition-colors`}>
        {icon}
      </span>
      {!collapsed && <span className="font-medium text-sm whitespace-nowrap">{label}</span>}
      
      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className="absolute left-20 bg-[var(--ork-ref-primary-15)] text-white text-xs px-2.5 py-1.5 rounded-[var(--ork-use-radius-badge)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </button>
  )
}

function KpiCard({ title, value, trend, isPositive, icon, iconBg, subtext }: { 
  title: string, value: string, trend: string, isPositive: boolean, icon: React.ReactNode, iconBg: string, subtext: string 
}) {
  return (
    <div className="bg-surface rounded-[var(--ork-use-radius-card)] p-6 shadow-raised border border-border">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-[var(--ork-use-radius-control)] ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-[var(--ork-use-radius-badge)] text-xs font-semibold ${
          isPositive ? 'bg-[var(--ork-use-background-success-subtle)] text-t-success' : 'bg-[var(--ork-use-background-danger-subtle)] text-t-danger'
        }`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend}
        </div>
      </div>
      <div>
        <h3 className="text-muted text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-foreground font-mono-numbers mt-1 tracking-tight">{value}</p>
        <p className="text-xs text-muted mt-2">{subtext}</p>
      </div>
    </div>
  )
}
