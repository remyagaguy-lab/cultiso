"use client";
import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle, 
  Scale, 
  Calendar, 
  Clock, 
  ChevronRight,
  ShieldAlert,
  ArrowUpDown,
  Tag
} from 'lucide-react';
import { BatchItem, SpeciesCategory } from './types';

interface BatchesTableProps {
  batches: BatchItem[];
  selectedSpecies: SpeciesCategory;
  onSelectBatch: (batch: BatchItem) => void;
}

export const BatchesTable: React.FC<BatchesTableProps> = ({
  batches,
  selectedSpecies,
  onSelectBatch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  // Filter batches based on species, phase, search
  const filteredBatches = batches.filter((b) => {
    const matchesSpecies = selectedSpecies === 'all' || b.species === selectedSpecies;
    const matchesSearch = 
      b.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.breed.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.building.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPhase = phaseFilter === 'all' || b.phase === phaseFilter;

    return matchesSpecies && matchesSearch && matchesPhase;
  });

  return (
    <div className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border shadow-raised overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:px-6 sm:py-3.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sunken/70">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-title font-bold text-foreground">
            Bandes &amp; Lots en Production Active
          </h2>
          <span className="text-xs bg-[var(--ork-use-background-brand-subtle)] text-t-brand font-bold px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] font-mono whitespace-nowrap shrink-0">
            {filteredBatches.length} {filteredBatches.length > 1 ? 'lots' : 'lot'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Rechercher par code, souche, bâtiment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border rounded-[var(--ork-use-radius-control)] focus:outline-none focus:ring-1 focus:ring-[var(--ork-use-border-focused)] text-foreground placeholder:text-muted"
            />
          </div>

          {/* Phase Filter */}
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-surface border border-border rounded-[var(--ork-use-radius-control)] text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-[var(--ork-use-border-focused)]"
          >
            <option value="all">Toutes phases</option>
            <option value="Démarrage">Démarrage</option>
            <option value="Croissance">Croissance</option>
            <option value="Finition">Finition</option>
            <option value="Ponte Pic">Ponte Pic</option>
            <option value="Production Lait">Production Lait</option>
            <option value="Grossissement">Grossissement</option>
          </select>
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider bg-sunken/70">
              <th className="py-3 px-4 sm:px-6">Lot / Souche</th>
              <th className="py-3 px-3">Bâtiment / Bassin</th>
              <th className="py-3 px-3">Âge physiologique</th>
              <th className="py-3 px-3">Effectif Actif</th>
              <th className="py-3 px-3">Mortalité (%)</th>
              <th className="py-3 px-3">Poids Moyen</th>
              <th className="py-3 px-3">Indice IC (FCR)</th>
              <th className="py-3 px-3">Prochaine Intervention</th>
              <th className="py-3 px-4 text-right">Fiche Zootech</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs text-foreground font-medium">
            {filteredBatches.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted">
                  Aucun lot trouvé correspondant aux critères.
                </td>
              </tr>
            ) : (
              filteredBatches.map((batch) => {
                const isMortalityHigh = batch.mortalityPercent > 1.8;
                const isFcrOptimal = batch.fcrCurrent <= batch.fcrTarget;

                return (
                  <tr 
                    key={batch.id} 
                    className="hover:bg-sunken/60 transition group cursor-pointer"
                    onClick={() => onSelectBatch(batch)}
                  >
                    {/* Code & Name */}
                    <td className="py-3 px-4 sm:px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground bg-sunken px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] text-[11px] border border-border whitespace-nowrap shrink-0">
                          {batch.code}
                        </span>
                        {batch.status === 'harvest_ready' && (
                          <span className="text-[10px] bg-[var(--ork-use-background-success-subtle)] text-t-success font-bold px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] whitespace-nowrap shrink-0">
                            Prêt Récolte
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-foreground mt-1">
                        {batch.name}
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                        <Tag className="w-3 h-3 text-muted" />
                        <span>{batch.breed}</span>
                      </div>
                    </td>

                    {/* Building */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-foreground">{batch.building}</div>
                      <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] bg-sunken text-muted">
                        {batch.phase}
                      </span>
                    </td>

                    {/* Age */}
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-foreground">
                        {batch.ageWeeks ? `Sem ${batch.ageWeeks} (${batch.ageDays}j)` : `${batch.ageDays} jours`}
                      </div>
                      <div className="text-[10px] text-muted">Démarré le {batch.startDate}</div>
                    </td>

                    {/* Count */}
                    <td className="py-3 px-3 font-mono">
                      <div className="font-bold text-foreground">
                        {batch.currentCount.toLocaleString('fr-FR')}
                      </div>
                      <div className="text-[10px] text-muted">
                        Init : {batch.initialCount.toLocaleString('fr-FR')}
                      </div>
                    </td>

                    {/* Mortality */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-bold ${
                          isMortalityHigh ? 'text-t-danger' : 'text-t-success'
                        }`}>
                          {batch.mortalityPercent.toFixed(2)}%
                        </span>
                        {isMortalityHigh && <ShieldAlert className="w-3.5 h-3.5 text-t-danger" />}
                      </div>
                      <div className="text-[10px] text-muted font-mono">
                        {batch.mortalityCount} pertes
                      </div>
                    </td>

                    {/* Weight */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono font-bold text-foreground">
                          {batch.species === 'cattle' || batch.species === 'swine' || batch.currentWeightAvg <= 100
                            ? `${batch.currentWeightAvg} kg`
                            : `${batch.currentWeightAvg} g`}
                        </span>
                        <span className="text-[10px] text-muted">
                          / {batch.species === 'cattle' || batch.species === 'swine' || batch.targetWeightAvg <= 100
                            ? `${batch.targetWeightAvg} kg`
                            : `${batch.targetWeightAvg} g`}
                        </span>
                      </div>
                      <div className="text-[10px] text-t-success font-semibold">
                        GMQ: +{batch.gmqActual}g/j
                      </div>
                    </td>

                    {/* FCR (IC) */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] text-xs ${
                          isFcrOptimal 
                            ? 'bg-[var(--ork-use-background-success-subtle)] text-t-success border border-[var(--ork-use-border-success)]' 
                            : 'bg-[var(--ork-use-background-warning-subtle)] text-t-warning border border-[var(--ork-use-border-warning)]'
                        }`}>
                          {batch.fcrCurrent.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted font-mono">
                          (cible {batch.fcrTarget.toFixed(2)})
                        </span>
                      </div>
                      {batch.epef && (
                        <div className="text-[10px] text-muted mt-0.5">
                          EPEF: <span className="font-bold text-foreground">{batch.epef}</span>
                        </div>
                      )}
                    </td>

                    {/* Next action */}
                    <td className="py-3 px-3 max-w-[210px]">
                      <div className="text-[11px] text-foreground line-clamp-1 font-semibold">
                        {batch.nextAction.description}
                      </div>
                      <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5 font-mono">
                        <Clock className="w-3 h-3 text-muted" />
                        <span>Échéance : {batch.nextAction.dueDate}</span>
                      </div>
                    </td>

                    {/* Detail Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectBatch(batch);
                        }}
                        className="p-1.5 rounded-[var(--ork-use-radius-control)] text-muted hover:text-t-brand hover:bg-selected transition"
                        title="Consulter le dossier zootechnique complet"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
