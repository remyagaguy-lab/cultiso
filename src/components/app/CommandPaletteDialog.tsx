"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  LineChart,
  Zap,
  Bot,
  TrendingUp,
  Plus,
  ArrowRight,
  Building2,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { useAppWorkspace } from "./AppWorkspaceContext";

interface CommandItem {
  id: string;
  group: "Navigation" | "Actions rapides" | "Business Plans" | "Exploitations";
  label: string;
  hint?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

/**
 * Palette de commandes native (<dialog>.showModal()) inspirée de ClickUp (⌘K / Ctrl+K).
 */
export function CommandPaletteDialog() {
  const {
    isCommandOpen,
    closeCommand,
    businessPlans,
    workspaces,
    setActiveWorkspaceId,
    openCultisia,
  } = useAppWorkspace();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressedOutsideRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isCommandOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isCommandOpen]);

  const handleClose = () => {
    setQuery("");
    setActiveIndex(0);
    closeCommand();
  };

  const items = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = [
      {
        id: "nav-dashboard",
        group: "Navigation",
        label: "Tableau de bord",
        hint: "Centre de commandement",
        icon: <LayoutDashboard className="w-4 h-4 text-t-brand" />,
        onSelect: () => router.push("/dashboard"),
      },
      {
        id: "nav-cultiplan",
        group: "Navigation",
        label: "Cultiplan",
        hint: "Simuler & modéliser un business plan",
        icon: <LineChart className="w-4 h-4 text-t-brand" />,
        onSelect: () => router.push("/cultiplan"),
      },
      {
        id: "nav-cultima",
        group: "Navigation",
        label: "Cultima ERP",
        hint: "Parcelles, élevage, trésorerie & stocks",
        icon: <Zap className="w-4 h-4 text-t-action" />,
        onSelect: () => router.push("/cultima"),
      },
      {
        id: "nav-marches",
        group: "Navigation",
        label: "Cours des prix agricoles",
        hint: "Relevés des marchés locaux",
        icon: <TrendingUp className="w-4 h-4 text-t-brand" />,
        onSelect: () => router.push("/marches"),
      },
      {
        id: "nav-cultisia",
        group: "Navigation",
        label: "Cultisia (Plein écran)",
        hint: "Historique & discussions agronomiques",
        icon: <Bot className="w-4 h-4 text-t-brand" />,
        onSelect: () => router.push("/cultisia"),
      },
    ];

    const quickActions: CommandItem[] = [
      {
        id: "act-new-plan",
        group: "Actions rapides",
        label: "Créer un nouveau Business Plan",
        hint: "Ouvrir le copilote Cultiplan",
        icon: <Plus className="w-4 h-4 text-t-action" />,
        onSelect: () => router.push("/cultiplan"),
      },
      {
        id: "act-ask-cultisia",
        group: "Actions rapides",
        label: "Ouvrir le copilote Cultisia (panneau latéral)",
        hint: "Poser une question sur n'importe quelle page",
        icon: <Bot className="w-4 h-4 text-t-brand" />,
        onSelect: () => openCultisia("cultisia"),
      },
      {
        id: "act-treasury",
        group: "Actions rapides",
        label: "Ouvrir la Trésorerie (Cultima)",
        hint: "Saisir une recette ou une dépense en FCFA",
        icon: <Zap className="w-4 h-4 text-t-action" />,
        onSelect: () => router.push("/cultima?view=finance"),
      },
    ];

    const planItems: CommandItem[] = businessPlans.slice(0, 6).map((plan) => ({
      id: `plan-${plan.id}`,
      group: "Business Plans",
      label: plan.title,
      hint: "Cultiplan",
      icon: <FileSpreadsheet className="w-4 h-4 text-muted" />,
      onSelect: () => router.push("/cultiplan"),
    }));

    const wsItems: CommandItem[] = workspaces.map((ws) => ({
      id: `ws-${ws.id}`,
      group: "Exploitations",
      label: ws.name,
      hint: ws.location || ws.domain || "Espace d'exploitation",
      icon: <Building2 className="w-4 h-4 text-t-brand" />,
      onSelect: () => setActiveWorkspaceId(ws.id),
    }));

    return [...quickActions, ...navItems, ...planItems, ...wsItems];
  }, [businessPlans, workspaces, router, openCultisia, setActiveWorkspaceId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.hint && item.hint.toLowerCase().includes(q)) ||
        item.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const list = groups.get(item.group) ?? [];
      list.push(item);
      groups.set(item.group, list);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const executeItem = (item: CommandItem) => {
    handleClose();
    item.onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0
      );
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      executeItem(filtered[activeIndex]);
    }
  };

  const isOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="command-palette-title"
      {...({ closedby: "any" } as Record<string, string>)}
      onClose={() => handleClose()}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onPointerDown={(e) => {
        pressedOutsideRef.current = isOutsideDialog(e);
      }}
      onPointerUp={(e) => {
        if (pressedOutsideRef.current && isOutsideDialog(e)) {
          handleClose();
        }
        pressedOutsideRef.current = false;
      }}
      className="m-auto w-[min(600px,calc(100dvw-2rem))] max-h-[min(520px,80dvh)] rounded-[var(--ork-use-radius-dialog)] border border-border bg-surface p-0 text-foreground shadow-overlay open:flex open:flex-col overflow-hidden"
    >
      <h2 id="command-palette-title" className="sr-only">
        Recherche et commandes rapides Cultiso
      </h2>

      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Search className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Aller à un module, un projet, une exploitation..."
          aria-label="Rechercher dans Cultiso"
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
        />
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fermer la recherche rapide"
          className="p-1.5 rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-sunken transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-foreground mb-1">
              Aucun résultat pour « {query} »
            </p>
            <p className="text-xs text-muted mb-4">
              Essayez un module (Cultiplan, Cultima) ou posez la question à Cultisia.
            </p>
            <button
              type="button"
              onClick={() => {
                closeCommand();
                openCultisia("cultisia");
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[var(--ork-use-radius-button)] bg-brand text-on-brand text-xs font-semibold hover:bg-[var(--ork-use-background-brand-bold-hover)] transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              Demander à Cultisia
            </button>
          </div>
        ) : (
          grouped.map(([groupName, groupItems]) => (
            <div key={groupName} className="mb-2 last:mb-0">
              <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                {groupName}
              </div>
              <ul className="list-none m-0 p-0 space-y-0.5">
                {groupItems.map((item) => {
                  const flatIndex = filtered.indexOf(item);
                  const isActive = flatIndex === activeIndex;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-[var(--ork-use-radius-control)] text-left transition-colors ${
                          isActive
                            ? "bg-selected text-foreground ring-1 ring-inset ring-[var(--ork-use-border-selected)]"
                            : "text-foreground hover:bg-sunken"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-[var(--ork-use-radius-control)] bg-surface border border-border flex items-center justify-center shrink-0">
                            {item.icon}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold truncate">
                              {item.label}
                            </div>
                            {item.hint && (
                              <div className="text-[11.5px] text-muted truncate">
                                {item.hint}
                              </div>
                            )}
                          </div>
                        </div>
                        <ArrowRight
                          className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                            isActive ? "opacity-100 text-t-brand" : "opacity-0"
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 bg-sunken border-t border-border flex items-center justify-between text-[11px] text-muted">
        <span>↑↓ pour naviguer · Entrée pour ouvrir</span>
        <span>Échap pour fermer</span>
      </div>
    </dialog>
  );
}
