"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Layers, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import {
  appNav,
  adminNav,
  type NavGroup,
  type NavItem,
} from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/domain";

type AppSidebarProps = {
  activePath?: string;
  mode?: "app" | "admin";
  role?: Role;
  onNavigate?: () => void;
  onChatOpen?: () => void;
};

const STORAGE_GROUPS = "rewaq.sidebar.openGroups";
const STORAGE_COLLAPSE = "rewaq.sidebar.collapsed";

function canView(item: NavItem, role?: Role) {
  if (!item.roles || item.roles.length === 0) return true;
  if (!role) return true;
  return item.roles.includes(role);
}

function buildGroups(mode: "app" | "admin", role?: Role): NavGroup[] {
  if (mode === "admin") {
    return [{ title: "المنصة", icon: Layers, items: adminNav }];
  }
  return appNav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canView(item, role)),
    }))
    .filter((group) => group.items.length > 0);
}

export function AppSidebar({
  activePath = "",
  mode = "app",
  role,
  onNavigate,
  onChatOpen,
}: AppSidebarProps) {
  const pathname = usePathname();
  const currentPath = activePath || pathname;
  const groups = React.useMemo(() => buildGroups(mode, role), [mode, role]);

  const [collapsed, setCollapsed] = React.useState(false);
  const [flyout, setFlyout] = React.useState<{
    title: string;
    top: number;
    side: "left" | "right";
    offset: number;
  } | null>(null);
  const flyoutCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_COLLAPSE) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach((g) => {
      initial[g.title] = g.defaultOpen ?? false;
    });
    return initial;
  });

  React.useEffect(() => {
    let persisted: string[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_GROUPS);
      if (raw) persisted = JSON.parse(raw);
    } catch {
      persisted = [];
    }
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      groups.forEach((g) => {
        const hasActive = g.items.some(
          (i) => currentPath === i.href || (i.href !== "/dashboard" && currentPath.startsWith(`${i.href}/`)),
        );
        next[g.title] =
          persisted.includes(g.title) || hasActive || (prev[g.title] ?? false) || (g.defaultOpen ?? false);
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, groups]);

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try {
        const open = Object.entries(next)
          .filter(([, v]) => v)
          .map(([k]) => k);
        localStorage.setItem(STORAGE_GROUPS, JSON.stringify(open));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_COLLAPSE, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      setFlyout(null);
      return next;
    });
  };

  const openFlyout = (title: string, target: HTMLElement) => {
    if (!collapsed || typeof window === "undefined") return;
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    const rect = target.getBoundingClientRect();
    const opensToRight = rect.left < window.innerWidth / 2;
    setFlyout({
      title,
      top: rect.top,
      side: opensToRight ? "left" : "right",
      offset: opensToRight ? rect.right + 8 : window.innerWidth - rect.left + 8,
    });
  };

  const closeFlyoutSoon = () => {
    if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
    flyoutCloseTimer.current = setTimeout(() => setFlyout(null), 180);
  };

  const isActive = (href: string) =>
    currentPath === href || (href !== "/dashboard" && currentPath.startsWith(`${href}/`));

  const handleLinkClick = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col overflow-hidden border-e border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-text)] transition-[width] duration-200",
        collapsed ? "w-[78px]" : "w-64 xl:w-72",
      )}
    >
      {/* صفّ العلامة التجارية */}
      <div className="flex items-center gap-3 px-4 py-4">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1363DF,#1363DF)] text-lg font-black text-white shadow-sm">
          ر
          <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full bg-[var(--success)] ring-2 ring-[var(--sidebar-bg)]" />
        </span>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="block text-lg font-extrabold leading-tight text-[#000000]">رواق</span>
            <span className="text-[10px] tracking-wide text-[#000000]/65">Restaurant OS</span>
          </div>
        )}
        {!collapsed ? (
          <button
            type="button"
            onClick={toggleCollapse}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#1363DF] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[#1363DF]"
            aria-label="تصغير القائمة"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* التنقّل */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 pb-3 [scrollbar-width:thin] [scrollbar-color:var(--sidebar-border)_transparent]">

        {mode === "app" && collapsed ? (
          <button
            type="button"
            onClick={toggleCollapse}
            className="mx-auto my-2 grid h-11 w-11 place-items-center rounded-xl bg-[#E1E8FF] text-[#1363DF] shadow-sm transition hover:bg-[#D7E2FF]"
            aria-label="توسيع القائمة"
            title="توسيع القائمة"
          >
            <PanelLeftOpen className="h-5 w-5 stroke-[2.5]" />
          </button>
        ) : null}

        <div className={cn("border-t border-[var(--sidebar-border)]", collapsed ? "my-2" : "my-3")} />

        {groups.map((group) => {
          const GroupIcon = group.icon;
          const open = collapsed ? false : openGroups[group.title] ?? false;
          return (
            <div key={group.title} className="mb-1">
              {collapsed ? (
                <button
                  type="button"
                  onMouseEnter={(event) => openFlyout(group.title, event.currentTarget)}
                  onMouseLeave={closeFlyoutSoon}
                  onFocus={(event) => openFlyout(group.title, event.currentTarget)}
                  onClick={(event) => openFlyout(group.title, event.currentTarget)}
                  className="grid h-10 w-full place-items-center rounded-2xl text-[#1363DF] transition hover:bg-[var(--sidebar-hover)] hover:text-[#1363DF]"
                  aria-label={group.title}
                  aria-expanded={flyout?.title === group.title}
                >
                  <GroupIcon className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold text-[#000000] transition hover:bg-[var(--sidebar-hover)] hover:text-[#000000]"
                  aria-expanded={open}
                >
                  <GroupIcon className="h-4 w-4 shrink-0 text-[#1363DF]" />
                  <span className="flex-1 text-start">{group.title}</span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
                  />
                </button>
              )}

              {!collapsed && <div
                className={cn(
                  "grid transition-all duration-200",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <div className={cn("mt-1 space-y-1", !collapsed && "border-s border-[var(--sidebar-border)] ps-2")}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={(e) => {
                            if (item.href === "#chat" && onChatOpen) {
                              e.preventDefault();
                              onChatOpen();
                            } else {
                              handleLinkClick();
                            }
                          }}
                          title={collapsed ? item.title : undefined}
                          className={cn(
                            "flex items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-bold transition",
                            collapsed && "justify-center",
                            active
                              ? "bg-[var(--sidebar-active)] text-[#000000] border-s-2 border-[var(--sidebar-active-accent)]"
                              : "text-[#000000] hover:bg-[var(--sidebar-hover)] hover:text-[#000000]",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0 text-[#1363DF]",
                              active && "text-[#1363DF]",
                            )}
                          />
                          {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                          {!collapsed && item.badge && (
                            <span className="rounded-full bg-[var(--sidebar-hover)] px-2 py-0.5 text-[10px] font-bold text-[#000000]">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>}
            </div>
          );
        })}
      </nav>

      {collapsed && flyout ? (() => {
        const group = groups.find((candidate) => candidate.title === flyout.title);
        if (!group) return null;
        const GroupIcon = group.icon;
        return (
          <div
            role="menu"
            aria-label={group.title}
            onMouseEnter={() => {
              if (flyoutCloseTimer.current) clearTimeout(flyoutCloseTimer.current);
            }}
            onMouseLeave={closeFlyoutSoon}
            onKeyDown={(event) => {
              if (event.key === "Escape") setFlyout(null);
            }}
            className="fixed z-50 w-64 rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-2 shadow-2xl"
            style={flyout.side === "left" ? { top: flyout.top, left: flyout.offset } : { top: flyout.top, right: flyout.offset }}
          >
            <div className="flex items-center gap-2 px-2 py-2 text-xs font-extrabold text-[#000000]">
              <GroupIcon className="h-4 w-4 text-[#1363DF]" />
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    role="menuitem"
                    href={item.href}
                    onClick={(event) => {
                      if (item.href === "#chat" && onChatOpen) {
                        event.preventDefault();
                        onChatOpen();
                      } else {
                        handleLinkClick();
                      }
                      setFlyout(null);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold transition",
                      active ? "bg-[var(--sidebar-active)] text-[#000000]" : "text-[#000000] hover:bg-[var(--sidebar-hover)] hover:text-[#000000]",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.badge ? <span className="rounded-full bg-[#DCE7FF] px-2 py-0.5 text-[10px] text-[#000000]">{item.badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })() : null}

      {/* ملحوظة الخصوصية */}
      <div className="space-y-1.5 border-t border-[var(--sidebar-border)] p-3">
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-2.5 pt-1 text-[10px] text-[#000000]/60">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--success)]" />
            <span>عزل بياناتك مضمون</span>
          </div>
        )}
      </div>
    </aside>
  );
}
