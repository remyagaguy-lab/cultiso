"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LineChart,
  ListChecks,
  Zap,
  Bot,
  TrendingUp,
  ShoppingBag,
  UserCheck,
  Search,
  Bell,
  Plus,
  ChevronDown,
  Pin,
  PinOff,
  Building2,
  Check,
  Sparkles,
  Menu,
  X,
  LogOut,
  Settings,
  User,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { Dropdown, Avatar } from "antd";
import Logo from "@/components/ui/Logo";
import {
  setCultisoTheme,
  type CultisoThemeMode,
} from "@/components/ui/DsThemeProvider";
import { createClient } from "@/lib/supabase/client";
import { useAppWorkspace } from "./AppWorkspaceContext";
import { CommandPaletteDialog } from "./CommandPaletteDialog";
import { CultisiaSidePanel } from "./CultisiaSidePanel";
import { getLocalItem, setLocalItem, subscribeLocalStore } from "./localStore";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const PILOTAGE_ITEMS: NavItem[] = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { name: "Cours des prix", href: "/marches", icon: TrendingUp },
];

const SUITE_ITEMS: NavItem[] = [
  { name: "Cultiplan", href: "/cultiplan", icon: LineChart },
  { name: "Mes plans", href: "/cultiplan/mes-plans", icon: ListChecks },
  { name: "Cultima ERP", href: "/cultima", icon: Zap },
  { name: "Cultisia IA", href: "/cultisia", icon: Bot },
];

const UPCOMING_ITEMS = [
  { name: "Cultishop", desc: "Achats d'intrants", icon: ShoppingBag },
  { name: "Cultiseil", desc: "Experts agronomes", icon: UserCheck },
];

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/marches": "Cours des prix",
  "/cultiplan": "Cultiplan",
  "/cultiplan/mes-plans": "Mes plans",
  "/cultima": "Cultima ERP",
  "/cultisia": "Cultisia IA",
  "/cultiseil": "Cultiseil",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const {
    userDisplayName,
    userInitials,
    userRole,
    tokensBalance,
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    openCommand,
    isCultisiaOpen,
    toggleCultisia,
  } = useAppWorkspace();

  const savedPinned = useSyncExternalStore(
    subscribeLocalStore,
    () => getLocalItem("cultiso_sidebar_pinned"),
    () => "true"
  );
  const isPinned = savedPinned !== "false";

  const [isHovered, setIsHovered] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<CultisoThemeMode>("light");

  const mobileDialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideMobileRef = useRef(false);

  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    const syncTheme = () =>
      setThemeMode(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
    syncTheme();
    const obs = new MutationObserver(syncTheme);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const toggleThemeMode = () => {
    const next: CultisoThemeMode = themeMode === "dark" ? "light" : "dark";
    setCultisoTheme(next);
    setThemeMode(next);
  };

  useEffect(() => {
    const dialog = mobileDialogRef.current;
    if (!dialog) return;
    if (isMobileDrawerOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isMobileDrawerOpen]);

  const togglePinned = () => {
    const next = !isPinned;
    setLocalItem("cultiso_sidebar_pinned", String(next));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isExpanded = isPinned || isHovered;

  const currentSectionTitle = useMemo(() => {
    const match = Object.entries(ROUTE_TITLES).find(([prefix]) =>
      pathname?.startsWith(prefix)
    );
    return match ? match[1] : "Espace Cultiso";
  }, [pathname]);

  const activeCultisiaContext = pathname?.startsWith("/cultima")
    ? "cultima"
    : pathname?.startsWith("/cultiplan")
      ? "cultiplan"
      : "cultisia";

  const workspaceMenu = {
    items: [
      {
        key: "header",
        type: "group" as const,
        label: (
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted">
            Mes exploitations
          </span>
        ),
        children: workspaces.map((ws) => ({
          key: ws.id,
          onClick: () => setActiveWorkspaceId(ws.id),
          label: (
            <div className="flex items-center justify-between gap-4 py-0.5 min-w-[200px]">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                  <span className="truncate">{ws.name}</span>
                  {ws.isDemo && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-[var(--ork-use-radius-badge)] bg-sunken text-muted border border-border">
                      Démo
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted truncate">
                  {ws.location || ws.domain || "Exploitation agricole"}
                </div>
              </div>
              {ws.id === activeWorkspace.id && (
                <Check className="w-4 h-4 text-t-brand shrink-0" />
              )}
            </div>
          ),
        })),
      },
      { type: "divider" as const },
      {
        key: "new-project",
        icon: <Plus className="w-3.5 h-3.5 text-t-action" />,
        label: (
          <span className="text-[13px] font-semibold text-t-action">
            Nouveau projet Cultiplan
          </span>
        ),
        onClick: () => router.push("/cultiplan"),
      },
    ],
  };

  const quickCreateMenu = {
    items: [
      {
        key: "new-bp",
        icon: <LineChart className="w-4 h-4 text-t-brand" />,
        label: "Nouveau Business Plan (Cultiplan)",
        onClick: () => router.push("/cultiplan"),
      },
      {
        key: "new-tx",
        icon: <Zap className="w-4 h-4 text-t-action" />,
        label: "Saisir une opération (Cultima)",
        onClick: () => router.push("/cultima?view=finance"),
      },
      {
        key: "new-ai",
        icon: <Sparkles className="w-4 h-4 text-t-brand" />,
        label: "Consulter Cultisia IA",
        onClick: () => toggleCultisia(activeCultisiaContext),
      },
    ],
  };

  const notificationMenu = {
    items: [
      {
        key: "notif-title",
        disabled: true,
        label: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Centre d&apos;alertes
          </span>
        ),
      },
      {
        key: "notif-1",
        label: (
          <div className="max-w-[260px] py-1">
            <div className="text-[12.5px] font-semibold text-foreground">
              Cours des marchés à jour
            </div>
            <div className="text-[11.5px] text-muted">
              Consultez les derniers prix relevés dans « Cours des prix ».
            </div>
          </div>
        ),
        onClick: () => router.push("/marches"),
      },
      {
        key: "notif-2",
        label: (
          <div className="max-w-[260px] py-1">
            <div className="text-[12.5px] font-semibold text-foreground">
              Copilote Cultisia disponible
            </div>
            <div className="text-[11.5px] text-muted">
              Ouvrez le panneau IA depuis n&apos;importe quelle page via la barre du haut.
            </div>
          </div>
        ),
        onClick: () => toggleCultisia(activeCultisiaContext),
      },
    ],
  };

  const userMenuItems = {
    items: [
      {
        key: "user-info",
        disabled: true,
        label: (
          <div className="py-0.5">
            <div className="text-xs font-bold text-foreground">
              {userDisplayName}
            </div>
            <div className="text-[11px] text-muted capitalize">
              {userRole}
            </div>
          </div>
        ),
      },
      { type: "divider" as const },
      {
        key: "dashboard",
        label: "Tableau de bord",
        icon: <User className="w-3.5 h-3.5" />,
        onClick: () => router.push("/dashboard"),
      },
      {
        key: "cultima",
        label: "Configuration Cultima",
        icon: <Settings className="w-3.5 h-3.5" />,
        onClick: () => router.push("/cultima"),
      },
      { type: "divider" as const },
      {
        key: "logout",
        label: "Se déconnecter",
        icon: <LogOut className="w-3.5 h-3.5" />,
        onClick: handleLogout,
        danger: true,
      },
    ],
  };

  const renderSidebarNavContent = (expanded: boolean) => (
    <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5 custom-scrollbar">
      {/* Workspace Switcher */}
      <div>
        <Dropdown menu={workspaceMenu} trigger={["click"]} placement="bottomLeft">
          <button
            type="button"
            aria-label="Changer d'exploitation active"
            className={`w-full flex items-center gap-2.5 rounded-[var(--ork-use-radius-control)] border border-border bg-sunken/70 hover:bg-sunken transition-colors text-left ${
              expanded ? "px-2.5 py-2 justify-between" : "p-2 justify-center"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-[var(--ork-use-radius-control)] bg-brand text-on-brand flex items-center justify-center text-xs font-bold shrink-0">
                {activeWorkspace.name.slice(0, 2).toUpperCase()}
              </span>
              {expanded && (
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold text-foreground truncate">
                    {activeWorkspace.name}
                  </div>
                  <div className="text-[10.5px] text-muted truncate">
                    {activeWorkspace.location || "Exploitation"}
                  </div>
                </div>
              )}
            </div>
            {expanded && (
              <ChevronDown
                className="w-3.5 h-3.5 text-muted shrink-0"
                aria-hidden="true"
              />
            )}
          </button>
        </Dropdown>
      </div>

      {/* Pilotage Group */}
      <div>
        {expanded && (
          <div className="px-2.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted">
            Pilotage
          </div>
        )}
        <ul className="list-none m-0 p-0 space-y-1">
          {PILOTAGE_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={!expanded ? item.name : undefined}
                  className={`flex items-center gap-2.5 h-9 rounded-[var(--ork-use-radius-control)] text-[13.5px] font-medium no-underline transition-colors ${
                    expanded ? "px-2.5 justify-start" : "justify-center px-0"
                  } ${
                    isActive
                      ? "bg-selected text-t-brand font-semibold ring-1 ring-inset ring-[var(--ork-use-border-selected)]"
                      : "text-foreground/85 hover:text-foreground hover:bg-sunken"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-t-brand" : "text-muted"
                    }`}
                  />
                  {expanded && <span className="truncate">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Modules Suite Cultiso */}
      <div>
        {expanded && (
          <div className="px-2.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted">
            Modules Cultiso
          </div>
        )}
        <ul className="list-none m-0 p-0 space-y-1">
          {SUITE_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={!expanded ? item.name : undefined}
                  className={`flex items-center gap-2.5 h-9 rounded-[var(--ork-use-radius-control)] text-[13.5px] font-medium no-underline transition-colors ${
                    expanded ? "px-2.5 justify-start" : "justify-center px-0"
                  } ${
                    isActive
                      ? "bg-selected text-t-brand font-semibold ring-1 ring-inset ring-[var(--ork-use-border-selected)]"
                      : "text-foreground/85 hover:text-foreground hover:bg-sunken"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-t-brand" : "text-muted"
                    }`}
                  />
                  {expanded && <span className="truncate">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Upcoming Modules (discreet) */}
      <div>
        {expanded && (
          <div className="px-2.5 mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted opacity-80">
            Prochainement
          </div>
        )}
        <ul className="list-none m-0 p-0 space-y-1">
          {UPCOMING_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.name} title={!expanded ? `${item.name} (Bientôt)` : undefined}>
                <div
                  aria-disabled="true"
                  className={`flex items-center gap-2.5 h-9 rounded-[var(--ork-use-radius-control)] text-[13px] text-muted opacity-70 cursor-default select-none ${
                    expanded ? "px-2.5 justify-between" : "justify-center px-0"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 shrink-0 opacity-75" />
                    {expanded && <span className="truncate">{item.name}</span>}
                  </div>
                  {expanded && (
                    <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--ork-use-radius-badge)] bg-sunken text-muted">
                      Bientôt
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  const isOutsideMobileDialog = (e: React.PointerEvent<HTMLDialogElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground flex flex-col lg:flex-row">
      {/* ══ DESKTOP SIDEBAR (ClickUp-inspired structured rail) ══ */}
      <aside
        aria-label="Navigation principale"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden lg:flex inset-y-0 left-0 z-30 flex-col bg-surface border-r border-border absolute h-full transition-all duration-200 ease-out ${
          isExpanded
            ? "w-[236px] shadow-overlay"
            : "w-[64px]"
        }`}
      >
        {/* Brand Row */}
        <div className="flex h-[52px] items-center justify-between px-3.5 shrink-0 border-b border-border">
          <Link
            href="/dashboard"
            className={`flex items-center no-underline overflow-hidden ${
              isExpanded ? "w-[126px]" : "w-7 mx-auto"
            }`}
          >
            {isExpanded ? (
              <>
                <span className="contents [[data-theme=dark]_&]:hidden">
                  <Logo variant="horizontal" size="sm" tone="on-light" priority className="w-full" />
                </span>
                <span className="hidden [[data-theme=dark]_&]:contents">
                  <Logo variant="horizontal" size="sm" tone="on-dark" priority className="w-full" />
                </span>
              </>
            ) : (
              <>
                <span className="contents [[data-theme=dark]_&]:hidden">
                  <Logo variant="symbol" size="sm" tone="on-light" className="w-7" />
                </span>
                <span className="hidden [[data-theme=dark]_&]:contents">
                  <Logo variant="symbol" size="sm" tone="on-dark" className="w-7" />
                </span>
              </>
            )}
          </Link>
        </div>

        {renderSidebarNavContent(isExpanded)}

        {/* Pin Toggle */}
        <div className="border-t border-border p-2.5 shrink-0 bg-sunken/50">
          <button
            type="button"
            onClick={togglePinned}
            aria-label={isPinned ? "Détacher la barre latérale" : "Épingler la barre latérale"}
            className={`w-full flex items-center gap-2.5 h-8 rounded-[var(--ork-use-radius-control)] text-xs font-medium text-muted hover:text-foreground hover:bg-sunken transition-colors ${
              isExpanded ? "px-2.5 justify-start" : "justify-center"
            }`}
          >
            {isPinned ? (
              <PinOff className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Pin className="w-3.5 h-3.5 shrink-0" />
            )}
            {isExpanded && (
              <span className="truncate">
                {isPinned ? "Réduire le menu" : "Épingler le menu"}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ══ MOBILE NAVIGATION DRAWER (<dialog>) ══ */}
      <dialog
        ref={mobileDialogRef}
        aria-label="Menu de navigation Cultiso"
        {...({ closedby: "any" } as Record<string, string>)}
        onClose={() => setIsMobileDrawerOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          setIsMobileDrawerOpen(false);
        }}
        onPointerDown={(e) => {
          pressedOutsideMobileRef.current = isOutsideMobileDialog(e);
        }}
        onPointerUp={(e) => {
          if (pressedOutsideMobileRef.current && isOutsideMobileDialog(e)) {
            setIsMobileDrawerOpen(false);
          }
          pressedOutsideMobileRef.current = false;
        }}
        className="m-0 h-dvh max-h-dvh w-[min(280px,82dvw)] max-w-none border-r border-border bg-surface p-0 text-foreground shadow-overlay open:flex open:flex-col"
      >
        <div className="h-[52px] px-4 border-b border-border flex items-center justify-between shrink-0">
          <Link href="/dashboard" onClick={() => setIsMobileDrawerOpen(false)} className="block w-[122px]">
            <span className="contents [[data-theme=dark]_&]:hidden">
              <Logo variant="horizontal" size="sm" tone="on-light" />
            </span>
            <span className="hidden [[data-theme=dark]_&]:contents">
              <Logo variant="horizontal" size="sm" tone="on-dark" />
            </span>
          </Link>
          <button
            type="button"
            autoFocus
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-label="Fermer le menu"
            className="p-1.5 rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-sunken"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) {
              setIsMobileDrawerOpen(false);
            }
          }}
        >
          {isMobileDrawerOpen && renderSidebarNavContent(true)}
        </div>
      </dialog>

      {/* ══ MAIN COLUMN ══ */}
      <div
        className={`flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-200 ease-out ${
          isPinned ? "lg:ml-[236px]" : "lg:ml-[64px]"
        } pb-16 lg:pb-0`}
      >
        {/* Unified Topbar (52px, present on every route) */}
        <header className="h-[52px] shrink-0 bg-surface border-b border-border px-3 sm:px-5 flex items-center justify-between gap-3 z-20">
          {/* Left: Mobile menu + Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              aria-label="Ouvrir le menu de navigation"
              aria-expanded={isMobileDrawerOpen}
              className="lg:hidden p-1.5 rounded-[var(--ork-use-radius-control)] text-foreground hover:bg-sunken transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[13px] min-w-0">
              <span className="hidden md:inline-flex items-center gap-1.5 text-muted font-medium truncate max-w-[150px]">
                <Building2 className="w-3.5 h-3.5 text-t-brand shrink-0" aria-hidden="true" />
                <span className="truncate">{activeWorkspace.name}</span>
              </span>
              <ChevronRight
                className="hidden md:inline w-3.5 h-3.5 text-muted/70 shrink-0"
                aria-hidden="true"
              />
              <span className="font-title font-bold text-foreground truncate">
                {currentSectionTitle}
              </span>
            </nav>
          </div>

          {/* Center: Command Palette Trigger */}
          <button
            type="button"
            onClick={openCommand}
            aria-label="Rechercher ou exécuter une commande (Ctrl+K)"
            className="hidden lg:flex items-center justify-between gap-4 w-full max-w-[340px] h-8 px-3 rounded-[var(--ork-use-radius-control)] bg-sunken hover:bg-selected/50 border border-border text-xs text-muted transition-colors"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Rechercher, naviguer, créer...</span>
            </span>
            <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-muted bg-surface border border-border rounded">
              ⌘K
            </kbd>
          </button>

          {/* Right: Theme switch + Quick actions + Cultisia Brain + Tokens + Alerts + Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={openCommand}
              aria-label="Rechercher"
              className="lg:hidden p-2 rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-sunken"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={toggleThemeMode}
              aria-label={themeMode === "dark" ? "Activer le mode clair" : "Activer le mode nuit"}
              title={themeMode === "dark" ? "Passer en thème clair" : "Passer en thème nuit"}
              className="p-2 rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-sunken transition-colors"
            >
              {themeMode === "dark" ? (
                <Sun className="w-4 h-4 text-[var(--ork-use-icon-warning)]" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <Dropdown menu={quickCreateMenu} trigger={["click"]} placement="bottomRight">
              <button
                type="button"
                aria-label="Créer un nouvel élément"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-[var(--ork-use-radius-button)] bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action text-xs font-semibold transition-colors shadow-raised"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Nouveau</span>
              </button>
            </Dropdown>

            <button
              type="button"
              onClick={() => toggleCultisia(activeCultisiaContext)}
              aria-label="Ouvrir le copilote Cultisia"
              aria-pressed={isCultisiaOpen}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-[var(--ork-use-radius-button)] border text-xs font-semibold transition-colors ${
                isCultisiaOpen
                  ? "bg-selected text-t-brand border-[var(--ork-use-border-selected)] ring-1 ring-inset ring-[var(--ork-use-border-selected)]"
                  : "bg-[var(--ork-use-background-brand-subtle)] hover:bg-selected text-t-brand border-[var(--ork-use-border-selected)]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Cultisia</span>
            </button>

            <div className="hidden xl:flex items-center gap-1 bg-[var(--ork-use-background-brand-subtle)] text-t-brand px-2 py-1 rounded-[var(--ork-use-radius-badge)] border border-[var(--ork-use-border-selected)]">
              <Zap className="w-3 h-3 text-t-action" aria-hidden="true" />
              <span className="text-[11.5px] font-bold font-mono-numbers">
                {new Intl.NumberFormat("fr-FR").format(tokensBalance)}
              </span>
            </div>

            <Dropdown menu={notificationMenu} trigger={["click"]} placement="bottomRight">
              <button
                type="button"
                aria-label="Notifications"
                className="relative p-1.5 rounded-[var(--ork-use-radius-control)] text-muted hover:text-foreground hover:bg-sunken transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-action" />
              </button>
            </Dropdown>

            <Dropdown menu={userMenuItems} trigger={["click"]} placement="bottomRight">
              <button
                type="button"
                aria-label={`Menu de ${userDisplayName}`}
                className="flex items-center gap-2 pl-1 pr-1.5 py-0.5 rounded-full hover:bg-sunken transition-colors"
              >
                <Avatar
                  size={28}
                  style={{
                    backgroundColor: "var(--ork-comp-avatar-base-container-color)",
                    color: "var(--ork-comp-avatar-base-label-color)",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {userInitials}
                </Avatar>
                <span className="hidden xl:inline text-xs font-semibold text-foreground max-w-[110px] truncate">
                  {userDisplayName.split(" ")[0]}
                </span>
              </button>
            </Dropdown>
          </div>
        </header>

        {/* Body + Optional Global Cultisia Copilote Drawer */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
            {children}
          </main>
          <CultisiaSidePanel />
        </div>
      </div>

      {/* ══ MOBILE BOTTOM NAVIGATION (Clean 4 items + Menu) ══ */}
      <nav
        aria-label="Navigation rapide mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around items-center h-16 z-30"
      >
        {[
          { name: "Accueil", href: "/dashboard", icon: LayoutDashboard },
          { name: "Cultiplan", href: "/cultiplan", icon: LineChart },
          { name: "Cultima", href: "/cultima", icon: Zap },
          { name: "Marchés", href: "/marches", icon: TrendingUp },
        ].map((item) => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 no-underline transition-colors ${
                isActive ? "text-t-brand" : "text-muted"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10.5px] font-semibold">{item.name}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-muted"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10.5px] font-semibold">Plus</span>
        </button>
      </nav>

      {/* Native <dialog> Command Palette */}
      <CommandPaletteDialog />
    </div>
  );
}
