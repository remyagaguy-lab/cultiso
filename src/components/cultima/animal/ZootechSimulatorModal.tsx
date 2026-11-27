"use client";
import React, { useState } from 'react';
import { 
  CloseIcon as X,
  CalculatorIcon as Calculator,
  GraphNewUpIcon as TrendingUp,
  DollarIcon as DollarSign,
  ScaleIcon as Scale,
  QuestionCircleIcon as HelpCircle,
  CheckCircleIcon as CheckCircle,
  ArrowRightIcon as ArrowRight,
} from '@solar-icons/react/linear';
import {
  StarsIcon as Sparkles,
} from '@solar-icons/react/bold-duotone';

interface ZootechSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ZootechSimulatorModal: React.FC<ZootechSimulatorModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // Simulation State
  const [headCount, setHeadCount] = useState<number>(20000); // Effectif bande
  const [targetWeight, setTargetWeight] = useState<number>(2.40); // kg vif par sujet
  const [currentFcr, setCurrentFcr] = useState<number>(1.60); // IC actuel
  const [optimizedFcr, setOptimizedFcr] = useState<number>(1.52); // IC cible optimisé
  const [feedCostPerKg, setFeedCostPerKg] = useState<number>(0.44); // Prix du kg d'aliment (€/kg)
  const [sellingPricePerKg, setSellingPricePerKg] = useState<number>(1.65); // Prix de vente (€/kg vif)
  const [chickDayCost, setChickDayCost] = useState<number>(0.55); // Coût du poussin d'un jour (€)

  // Calculations
  const totalBiomassKg = headCount * targetWeight;
  const currentFeedConsumedKg = totalBiomassKg * currentFcr;
  const optimizedFeedConsumedKg = totalBiomassKg * optimizedFcr;

  const currentTotalFeedCost = currentFeedConsumedKg * feedCostPerKg;
  const optimizedTotalFeedCost = optimizedFeedConsumedKg * feedCostPerKg;

  const totalRevenue = totalBiomassKg * sellingPricePerKg;

  const currentGrossMarginFeed = totalRevenue - currentTotalFeedCost;
  const optimizedGrossMarginFeed = totalRevenue - optimizedTotalFeedCost;

  const financialGain = optimizedGrossMarginFeed - currentGrossMarginFeed;
  const feedSavedTons = (currentFeedConsumedKg - optimizedFeedConsumedKg) / 1000;

  // Break-even FCR (where Revenue == Feed Cost + Chick Cost)
  const breakEvenFcr = (sellingPricePerKg - (chickDayCost / targetWeight)) / feedCostPerKg;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-brand-green px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                Simulateur Zootechnique & Marge sur Coût Alimentaire (MCAS)
              </h3>
              <p className="text-xs text-emerald-200">
                Calcul d'impact de l'Indice de Conversion (FCR) sur la rentabilité nette du cheptel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Explainer */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
            <p>
              En élevage intensif, une variation de seulement <strong>0.05 point d'IC</strong> représente des milliers d'euros d'économie en provende. Ajustez vos paramètres ci-dessous pour calculer le gain direct :
            </p>
          </div>

          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Effectif du Lot (Nombre de sujets)
              </label>
              <input
                type="number"
                value={headCount}
                onChange={(e) => setHeadCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-green font-mono font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Poids Vif Cible par Sujet (kg)
              </label>
              <input
                type="number"
                step="0.05"
                value={targetWeight}
                onChange={(e) => setTargetWeight(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-green font-mono font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Indice de Conversion Actuel (IC / FCR)
              </label>
              <input
                type="number"
                step="0.01"
                value={currentFcr}
                onChange={(e) => setCurrentFcr(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-green font-mono font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-brand-green block mb-1">
                Indice de Conversion Optimisé (Cible)
              </label>
              <input
                type="number"
                step="0.01"
                value={optimizedFcr}
                onChange={(e) => setOptimizedFcr(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-emerald-500 rounded-lg focus:ring-1 focus:ring-brand-green font-mono font-bold text-brand-green bg-emerald-50/50"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Prix Moyen Provende (€ / kg d'aliment)
              </label>
              <input
                type="number"
                step="0.01"
                value={feedCostPerKg}
                onChange={(e) => setFeedCostPerKg(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-green font-mono font-semibold"
              />
              <span className="text-[10px] text-slate-400">Soit {(feedCostPerKg * 1000).toFixed(0)} € / Tonne</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Prix de Vente Vif Marché (€ / kg)
              </label>
              <input
                type="number"
                step="0.05"
                value={sellingPricePerKg}
                onChange={(e) => setSellingPricePerKg(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-green font-mono font-semibold"
              />
            </div>
          </div>

          {/* Results Bento Box */}
          <div className="bg-gradient-to-br from-[var(--ork-ref-primary-10)] to-[var(--ork-ref-primary-20)] rounded-[var(--ork-use-radius-card)] p-5 text-white shadow-overlay">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--ork-ref-primary-70)]">
                Gain Économique Direct pour la Bande
              </span>
              <span className="text-xs bg-action text-on-action font-bold px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] font-mono">
                +{((financialGain / currentGrossMarginFeed) * 100).toFixed(1)}% Marge
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-center sm:text-left">
              <div>
                <span className="text-[11px] text-white/75 block uppercase font-medium">
                  Économie d&apos;Aliment
                </span>
                <span className="text-2xl font-black font-mono text-white">
                  {feedSavedTons.toFixed(1)} T
                </span>
                <span className="text-[10px] text-[var(--ork-ref-primary-70)] block">de provende économisée</span>
              </div>

              <div>
                <span className="text-[11px] text-white/75 block uppercase font-medium">
                  Gain Trésorerie Net
                </span>
                <span className="text-2xl font-black font-mono text-[var(--ork-ref-primary-70)]">
                  +{financialGain.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                </span>
                <span className="text-[10px] text-[var(--ork-ref-primary-70)] block">
                  soit +{(financialGain / headCount).toFixed(2)} € / sujet
                </span>
              </div>

              <div>
                <span className="text-[11px] text-white/75 block uppercase font-medium">
                  Seuil Rentabilité IC Max
                </span>
                <span className="text-2xl font-black font-mono text-[var(--ork-ref-secondary-70)]">
                  {breakEvenFcr.toFixed(2)}
                </span>
                <span className="text-[10px] text-[var(--ork-ref-secondary-80)] block">
                  Au-delà, le lot est déficitaire
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-sunken border-t border-border px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-muted font-medium">
            Biomasse totale simulée : <strong className="text-foreground">{totalBiomassKg.toLocaleString('fr-FR')} kg vif</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand hover:bg-[var(--ork-use-background-brand-bold-hover)] text-on-brand text-xs font-bold rounded-[var(--ork-use-radius-button)] transition"
          >
            Fermer le simulateur
          </button>
        </div>
      </div>
    </div>
  );
};
