"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { X, Maximize2, Sparkles } from "lucide-react";
import { SharedChat } from "@/components/cultisia/SharedChat";
import { useAppWorkspace } from "./AppWorkspaceContext";

/**
 * Copilote latéral Cultisia accessible depuis n'importe quelle vue (modèle ClickUp Brain).
 * Panneau non-bloquant sur desktop pour garder les données visibles à côté.
 */
export function CultisiaSidePanel() {
  const { isCultisiaOpen, closeCultisia, cultisiaContext } = useAppWorkspace();

  useEffect(() => {
    if (!isCultisiaOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCultisia();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCultisiaOpen, closeCultisia]);

  if (!isCultisiaOpen) return null;

  return (
    <aside
      aria-label="Assistant Cultisia"
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] lg:static lg:z-auto lg:w-[400px] xl:w-[420px] h-full bg-surface border-l border-border flex flex-col shrink-0 shadow-overlay lg:shadow-none"
    >
      <div className="h-[52px] shrink-0 px-4 border-b border-border bg-sunken/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="ork-avatar ork-avatar--ai w-8 h-8 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-title font-bold text-foreground flex items-center gap-1.5 truncate">
              <span className="truncate">Cultisia Copilote</span>
              <span className="ork-avatar-ai-label shrink-0">IA</span>
            </div>
            <div className="text-[11px] text-muted truncate">
              Contexte : {cultisiaContext === "cultima" ? "Cultima ERP" : cultisiaContext === "cultiplan" ? "Cultiplan" : "Agronomie & Business"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link
            href="/cultisia"
            onClick={closeCultisia}
            title="Ouvrir en plein écran"
            aria-label="Ouvrir Cultisia en plein écran"
            className="p-1.5 rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            onClick={closeCultisia}
            aria-label="Fermer le panneau Cultisia"
            className="p-1.5 rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <SharedChat
          key={cultisiaContext}
          toolContext={cultisiaContext}
          title="Cultisia"
          subtitle="Assistant agrobusiness"
          isEmbedded={true}
          hideSidebar={true}
          headingLevel="h2"
        />
      </div>
    </aside>
  );
}
