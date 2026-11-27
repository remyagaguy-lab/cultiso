"use client";
import React from 'react';
import { 
  ShieldCheck, 
  Stethoscope, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  User, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { VeterinaryRecord } from './types';

interface VeterinaryModuleProps {
  records: VeterinaryRecord[];
  onNewPrescription: () => void;
}

export const VeterinaryModule: React.FC<VeterinaryModuleProps> = ({
  records,
  onNewPrescription,
}) => {
  return (
    <div className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border shadow-raised overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:px-6 sm:py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-sunken/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-title font-bold text-foreground">
              Registre Sanitaire &amp; Délais d&apos;Attente Médicamenteux
            </h2>
            <p className="text-xs text-muted">
              Traçabilité vétérinaire, prophylaxie vaccinale et gestion des temps d&apos;attente (zéro résidu)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs bg-[var(--ork-use-background-warning-subtle)] text-t-warning border border-[var(--ork-use-border-warning)] px-2.5 py-1 rounded-[var(--ork-use-radius-badge)] font-medium">
            <Clock className="w-3.5 h-3.5 text-t-action shrink-0" />
            <span><strong>2 lots</strong> sous délai d&apos;attente actif</span>
          </div>
          <button
            type="button"
            onClick={onNewPrescription}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-[var(--ork-use-background-brand-bold-hover)] text-on-brand text-xs font-bold rounded-[var(--ork-use-radius-button)] transition whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Nouvelle Ordonnance</span>
          </button>
        </div>
      </div>

      {/* Sanitary Cards & Table */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Withdrawal Times (Délais d'attente) */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center justify-between">
            <span>Délais d&apos;Attente Viande / Lait</span>
            <span className="text-[10px] bg-[var(--ork-use-background-danger-subtle)] text-t-danger font-bold px-1.5 py-0.2 rounded-[var(--ork-use-radius-badge)]">Priorité Sanitaire</span>
          </h3>

          <div className="space-y-2.5">
            {records
              .filter((r) => r.isWithdrawalActive)
              .map((rec) => (
                <div
                  key={rec.id}
                  className="bg-[var(--ork-use-background-action-subtle)] border border-[var(--ork-use-border-warning)] rounded-[var(--ork-use-radius-card)] p-3.5 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[11px] font-bold bg-surface text-foreground px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] border border-border">
                        {rec.batchCode}
                      </span>
                      <span className="ml-2 text-xs font-semibold text-foreground">
                        {rec.species}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-t-action bg-surface/70 px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)]">
                      Attente active
                    </span>
                  </div>

                  <div className="mt-2 text-xs font-bold text-foreground">
                    {rec.treatmentName}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {rec.indication}
                  </div>

                  <div className="mt-3 pt-2 border-t border-[var(--ork-use-border-warning)] flex items-center justify-between text-xs">
                    <span className="text-muted text-[11px]">Fin de délai :</span>
                    <span className="font-mono font-bold text-t-action flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {rec.withdrawalEndDate}
                    </span>
                  </div>
                </div>
              ))}
          </div>

          {/* Biosecurity Checklist Pill */}
          <div className="bg-sunken border border-border rounded-[var(--ork-use-radius-card)] p-3.5 text-xs text-muted space-y-2">
            <div className="font-bold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-t-brand" />
              <span>Contrôle Biosécurité Hebdomadaire</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span>Pédiluves désinfectants (Glutaraldéhyde)</span>
              <span className="text-t-success font-bold">Renouvelé (07/09)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span>Sas sanitaire &amp; Hygiène personnel</span>
              <span className="text-t-success font-bold">100% Conforme</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span>Plan de dératisation / désinsectisation</span>
              <span className="text-t-success font-bold">Postes vérifiés</span>
            </div>
          </div>
        </div>

        {/* Right Column: Historical Veterinary Register Table */}
        <div className="lg:col-span-2">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
            Dernières Interventions &amp; Prophylaxie Vaccinale
          </h3>

          <div className="border border-border rounded-[var(--ork-use-radius-card)] overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-sunken/70 border-b border-border text-[11px] font-bold text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Lot concerné</th>
                  <th className="py-2.5 px-3">Produit &amp; Posologie</th>
                  <th className="py-2.5 px-3">Prescripteur</th>
                  <th className="py-2.5 px-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-sunken/60 transition">
                    <td className="py-2.5 px-3 font-mono text-muted whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                      {r.batchCode}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-foreground">{r.treatmentName}</div>
                      <div className="text-[11px] text-muted">{r.dosage}</div>
                    </td>
                    <td className="py-2.5 px-3 text-muted">
                      {r.administeredBy}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.isWithdrawalActive ? (
                        <span className="inline-flex items-center text-[10px] font-bold text-t-action bg-[var(--ork-use-background-action-subtle)] px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] whitespace-nowrap">
                          Attente ({r.withdrawalPeriodDays}j)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-t-success bg-[var(--ork-use-background-success-subtle)] px-2 py-0.5 rounded-[var(--ork-use-radius-badge)] inline-flex items-center gap-1 w-fit whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3 text-t-success shrink-0" />
                          Clôturé
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
