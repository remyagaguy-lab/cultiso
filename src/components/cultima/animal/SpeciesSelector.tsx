"use client";
import React from 'react';
import { 
  Egg, 
  Fish, 
  Layers, 
  Milk, 
  Beef,
  Sparkles
} from 'lucide-react';
import { SpeciesCategory } from './types';

interface SpeciesSelectorProps {
  selectedSpecies: SpeciesCategory;
  onSelect: (species: SpeciesCategory) => void;
  counts: {
    all: number;
    poultry: number;
    cattle: number;
    swine: number;
    aquaculture: number;
  };
}

export const SpeciesSelector: React.FC<SpeciesSelectorProps> = ({
  selectedSpecies,
  onSelect,
  counts,
}) => {
  const tabs = [
    {
      id: 'all' as SpeciesCategory,
      label: 'Vue Consolidée',
      sublabel: 'Tous ateliers confondus',
      icon: Layers,
      count: counts.all,
      highlight: '5 Ateliers Actifs',
      color: 'border-slate-800 text-slate-900',
    },
    {
      id: 'poultry' as SpeciesCategory,
      label: 'Aviculture',
      sublabel: 'Chair (Cobb 500) & Pondeuses (ISA)',
      icon: Egg,
      count: counts.poultry,
      highlight: '38 450 œufs/j • IC 1.56',
      color: 'border-brand-green text-brand-green',
    },
    {
      id: 'cattle' as SpeciesCategory,
      label: 'Bétail & Ruminants',
      sublabel: 'Laitier (Holstein) & Embouche',
      icon: Milk,
      count: counts.cattle,
      highlight: '4 820 L/j • TB 40.2 g/kg',
      color: 'border-brand-green text-brand-green',
    },
    {
      id: 'swine' as SpeciesCategory,
      label: 'Filière Porcine',
      sublabel: 'Naisseur-Engraisseur (Large White)',
      icon: Beef,
      count: counts.swine,
      highlight: 'GMQ 810 g/j • IC 2.62',
      color: 'border-brand-orange text-brand-orange',
    },
    {
      id: 'aquaculture' as SpeciesCategory,
      label: 'Pisciculture',
      sublabel: 'Bassins Tilapia GIFT & Silure',
      icon: Fish,
      count: counts.aquaculture,
      highlight: 'O2: 5.9 mg/L • IC 1.22',
      color: 'border-teal-700 text-teal-800',
    },
  ];

  return (
    <div className="bg-surface border-b border-border px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-[1360px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedSpecies === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--ork-use-radius-card)] text-left transition border min-w-0 ${
                  isSelected
                    ? 'bg-selected text-foreground border-[var(--ork-use-border-selected)] ring-1 ring-inset ring-[var(--ork-use-border-selected)]'
                    : 'bg-surface hover:bg-[var(--ork-use-background-neutral-default-hover)] text-foreground border-border hover:border-[var(--ork-use-border-selected)]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-[var(--ork-use-radius-control)] flex items-center justify-center shrink-0 transition ${
                    isSelected
                      ? tab.id === 'swine'
                        ? 'bg-action text-on-action'
                        : 'bg-brand text-on-brand'
                      : 'bg-[var(--ork-use-background-brand-subtle)] text-t-brand'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-t-brand' : 'text-foreground'}`}>
                      {tab.label}
                    </span>
                    <span
                      className={`text-[10.5px] font-mono-numbers px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] font-semibold shrink-0 whitespace-nowrap ${
                        isSelected
                          ? 'bg-[var(--ork-use-background-brand-subtle)] text-t-brand'
                          : 'bg-sunken text-muted'
                      }`}
                    >
                      {tab.count.toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div className="text-[10.5px] truncate font-medium mt-0.5 text-muted">
                    {tab.highlight}
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
};
