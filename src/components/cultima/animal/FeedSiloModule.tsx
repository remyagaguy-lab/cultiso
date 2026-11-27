"use client";
import React from 'react';
import { 
  Wheat, 
  AlertTriangle, 
  CheckCircle, 
  Truck, 
  Clock, 
  TrendingDown, 
  Layers,
  ArrowRight,
  Plus
} from 'lucide-react';
import { SiloItem } from './types';

interface FeedSiloModuleProps {
  silos: SiloItem[];
  onOrderFeed: (silo: SiloItem) => void;
}

export const FeedSiloModule: React.FC<FeedSiloModuleProps> = ({ silos, onOrderFeed }) => {
  return (
    <div className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border shadow-raised overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:px-6 sm:py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-sunken/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center">
            <Wheat className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-title font-bold text-foreground">
              Gestion Alimentaire &amp; Télémétrie Silos (Provendes)
            </h2>
            <p className="text-xs text-muted">
              Niveaux en temps réel, vitesse d&apos;épuisement et gestion des réapprovisionnements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-medium">
            Capacité totale : <strong className="text-foreground">91 Tonnes</strong>
          </span>
        </div>
      </div>

      {/* Silos Grid */}
      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {silos.map((silo) => {
          const isCritical = silo.daysRemaining < 3;
          const isWarning = silo.daysRemaining >= 3 && silo.daysRemaining < 5;

          return (
            <div
              key={silo.id}
              className={`rounded-[var(--ork-use-radius-card)] border p-4 flex flex-col justify-between transition relative overflow-hidden ${
                isCritical
                  ? 'border-[var(--ork-use-border-danger)] bg-[var(--ork-use-background-danger-subtle)]'
                  : isWarning
                  ? 'border-[var(--ork-use-border-warning)] bg-[var(--ork-use-background-warning-subtle)]'
                  : 'border-border bg-surface hover:border-[var(--ork-use-border-selected)]'
              }`}
            >
              {/* Top info */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-muted uppercase">
                    {silo.name.split('—')[0].trim()}
                  </span>
                  {isCritical ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-action text-on-action px-1.5 py-0.2 rounded-[var(--ork-use-radius-badge)]">
                      <AlertTriangle className="w-3 h-3" />
                      Critique
                    </span>
                  ) : isWarning ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-[var(--ork-use-background-warning-subtle)] text-t-warning px-1.5 py-0.2 rounded-[var(--ork-use-radius-badge)]">
                      Alerte
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-[var(--ork-use-background-success-subtle)] text-t-success px-1.5 py-0.2 rounded-[var(--ork-use-radius-badge)]">
                      Nominal
                    </span>
                  )}
                </div>

                <div className="mt-2 font-bold text-foreground text-sm leading-tight">
                  {silo.name.split('—')[1] || silo.name}
                </div>
                <div className="text-[11px] text-muted font-medium mt-0.5 line-clamp-1">
                  {silo.feedType}
                </div>

                {/* Visual Silo Gauge Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted text-[11px]">Remplissage</span>
                    <span className="font-mono font-bold text-foreground">{silo.fillPercentage}%</span>
                  </div>
                  <div className="w-full h-3.5 bg-sunken rounded-full overflow-hidden p-0.5 border border-border">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCritical
                          ? 'bg-action'
                          : isWarning
                          ? 'bg-warning'
                          : 'bg-brand'
                      }`}
                      style={{ width: `${silo.fillPercentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Stock Stats */}
                <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted block uppercase font-semibold">Stock Actuel</span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {silo.currentTons} T
                    </span>
                    <span className="text-[10px] text-muted block font-mono">/ {silo.capacityTons} T</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block uppercase font-semibold">Autonomie</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        isCritical ? 'text-t-action' : 'text-foreground'
                      }`}
                    >
                      {silo.daysRemaining.toFixed(1)} j
                    </span>
                    <span className="text-[10px] text-muted block font-mono">
                      -{silo.dailyConsumptionTons} T/j
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="mt-4 pt-3 border-t border-border">
                <button
                  onClick={() => onOrderFeed(silo)}
                  className={`w-full py-1.5 px-2.5 rounded-[var(--ork-use-radius-button)] text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    isCritical
                      ? 'bg-action text-on-action hover:bg-[var(--ork-use-background-action-bold-hover)]'
                      : 'bg-sunken hover:bg-selected text-foreground'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>{isCritical ? 'Commander d\'urgence' : 'Commander provende'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
