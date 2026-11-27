"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CloseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@solar-icons/react/linear";
import {
  CompassIcon as CompassBoldDuotoneIcon,
  CheckCircleIcon as CheckCircleBoldDuotoneIcon,
} from "@solar-icons/react/bold-duotone";

export interface TourStep {
  id: string;
  selector: string;
  title: string;
  description: string;
  tip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "workspace",
    selector: '[data-tour="workspace-banner"]',
    title: "1. Votre exploitation active (Ferme Cultiso)",
    description:
      "Vous explorez actuellement la ferme de démonstration pour découvrir Cultiso en conditions réelles. Vous pourrez créer ou basculer vers vos propres exploitations à tout moment.",
    tip: "Astuce : le bandeau affiche aussi la météo locale de la parcelle.",
  },
  {
    id: "kpis",
    selector: '[data-tour="kpis-row"]',
    title: "2. Vos 4 indicateurs de décision",
    description:
      "En un coup d'œil, suivez votre trésorerie disponible, votre marge brute prévisionnelle en FCFA, le ROI moyen de vos plans Cultiplan et l'indice de santé de vos ateliers.",
  },
  {
    id: "ateliers",
    selector: '[data-tour="ateliers-section"]',
    title: "3. Pilotage consolidé de vos ateliers",
    description:
      "Comparez vos flux réels (Cultima) au prévisionnel (Cultiplan) et suivez chaque atelier (Végétal, Élevage, Transformation) sans ressaisie.",
    tip: "Cliquez sur n'importe quel atelier pour ouvrir son tableau de bord dédié.",
  },
  {
    id: "decisions",
    selector: '[data-tour="decisions-section"]',
    title: "4. Alertes & décisions du jour",
    description:
      "Cultiso fait remonter les urgences terrain (rupture de provende, fenêtre de traitement) et les opportunités de marché pour agir au bon moment.",
  },
  {
    id: "cultisia",
    selector: '[data-tour="cultisia-card"]',
    title: "5. Votre copilote IA & Business Plan",
    description:
      "Besoin d'un diagnostic agronomique ou de simuler un nouveau projet avant d'investir ? Ouvrez Cultisia IA ou démarrez un business plan dans Cultiplan.",
  },
];

interface DashboardTourProps {
  open: boolean;
  onClose: () => void;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function DashboardTour({ open, onClose }: DashboardTourProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const measureTarget = useCallback(() => {
    if (!open || !currentStep) return;
    const el = document.querySelector(currentStep.selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const updateRect = () => {
      const box = el.getBoundingClientRect();
      setRect({
        top: Math.max(8, box.top - 6),
        left: Math.max(8, box.left - 6),
        width: box.width + 12,
        height: box.height + 12,
      });
    };
    updateRect();
    const timer = window.setTimeout(updateRect, 280);
    return () => window.clearTimeout(timer);
  }, [open, currentStep]);

  useEffect(() => {
    if (!open) return;
    const cleanup = measureTarget();
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      if (cleanup) cleanup();
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [open, measureTarget]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        if (isLast) onClose();
        else setStepIndex((i) => i + 1);
      } else if (e.key === "ArrowLeft") {
        setStepIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isLast, onClose]);

  if (!open) return null;

  // Positionnement intelligent de la carte (au-dessous si possible, sinon au-dessus ou centrée en bas)
  const cardStyle: React.CSSProperties = (() => {
    if (!rect || typeof window === "undefined") {
      return { bottom: 24, left: "50%", transform: "translateX(-50%)" };
    }
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const left = Math.min(
      Math.max(16, rect.left),
      Math.max(16, window.innerWidth - 396)
    );
    if (spaceBelow >= 240) {
      return { top: rect.top + rect.height + 12, left };
    }
    if (rect.top >= 240) {
      return { top: Math.max(16, rect.top - 228), left };
    }
    return { bottom: 20, left: "50%", transform: "translateX(-50%)" };
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visite guidée du tableau de bord Cultiso"
      className="fixed inset-0 z-50"
    >
      {/* Voile sombre */}
      <div
        className="fixed inset-0 bg-black/55 transition-opacity"
        onClick={onClose}
      />

      {/* Cadre de surbrillance */}
      {rect && (
        <div
          aria-hidden="true"
          className="fixed rounded-[var(--ork-use-radius-card)] border-2 border-[var(--ork-use-border-brand)] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none transition-all duration-200"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}

      {/* Carte d'explication */}
      <div
        className="fixed z-10 w-[min(380px,calc(100vw-2rem))] rounded-[var(--ork-use-radius-dialog)] bg-surface border border-border shadow-overlay p-4 space-y-3 text-foreground"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center shrink-0">
              <CompassBoldDuotoneIcon className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-t-brand">
              Visite guidée · {stepIndex + 1}/{TOUR_STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la visite guidée"
            className="p-1 rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-sunken transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-[14.5px] font-title font-bold text-foreground m-0">
            {currentStep.title}
          </h3>
          <p className="text-xs text-foreground/85 leading-relaxed m-0">
            {currentStep.description}
          </p>
          {currentStep.tip && (
            <p className="text-[11.5px] text-t-brand font-medium m-0 pt-0.5">
              {currentStep.tip}
            </p>
          )}
        </div>

        {/* Barre de progression */}
        <div className="flex items-center gap-1 pt-0.5">
          {TOUR_STEPS.map((s, idx) => (
            <span
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx <= stepIndex ? "bg-brand" : "bg-sunken"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-muted hover:text-foreground transition-colors"
          >
            Passer
          </button>

          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--ork-use-radius-button)] border border-border bg-surface hover:bg-sunken text-xs font-semibold text-foreground transition-colors"
              >
                <ArrowLeftIcon className="w-3.5 h-3.5" />
                Précédent
              </button>
            )}

            {isLast ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push("/cultiplan");
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--ork-use-radius-button)] border border-[var(--ork-use-border-selected)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand text-xs font-semibold hover:bg-selected transition-colors"
                >
                  Ouvrir Cultiplan
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--ork-use-radius-button)] bg-brand hover:bg-[var(--ork-use-background-brand-bold-hover)] text-on-brand text-xs font-semibold transition-colors"
                >
                  <CheckCircleBoldDuotoneIcon className="w-3.5 h-3.5" />
                  Explorer
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--ork-use-radius-button)] bg-brand hover:bg-[var(--ork-use-background-brand-bold-hover)] text-on-brand text-xs font-semibold transition-colors"
              >
                Suivant
                <ArrowRightIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
