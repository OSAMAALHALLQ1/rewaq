"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Layers, ReceiptText, ShoppingCart } from "lucide-react";
import {
  appNav,
  adminNav,
  pinnedNav,
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

const STORAGE_KEY = "rewaq.sidebar.openGroups";

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

export function AppSidebar({ activePath = "", mode = "app", role, onNavigate, onChatOpen }: AppSidebarProps) {
  const pathname = usePathname();
  const currentPath = activePath || pathname;
  const groups = React.useMemo(() => buildGroups(mode, role), [mode, role]);

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach((g) => {
      initial[g.title] = g.defaultOpen ?? false;
    });
    return initial;
  });

  // open groups that contain the active route + load persisted state
  React.useEffect(() => {
    let persisted: string[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) persisted = JSON.parse(raw);
    } catch {
      persisted = [];
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      groups.forEach((g) => {
        const hasActive = g.items.some(
          (i) => currentPath === i.href || (i.href !== "/dashboard" && currentPath.startsWith(`${i.href}/`)),
        );
        next[g.title] = persisted.includes(g.title) || hasActive || (prev[g.title] ?? false) || (g.defaultOpen ?? false);
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isActive = (href: string) =>
    currentPath === href || (href !== "/dashboard" && currentPath.startsWith(`${href}/`));

  const quickLinks: NavItem[] = [
    { title: "فاتورة توريد", href: "/dashboard/invoices", icon: ReceiptText },
    { title: "طلب شراء", href: "/dashboard/purchase-orders", icon: ShoppingCart },
  ];

  const handleLinkClick = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <aside className="flex h-full w-full flex-col bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]">
      <div className="sticky top-0 flex h-full flex-col">
        <Link href="/" className="flex items-center gap-3 border-b border-[var(--sidebar-border)] px-5 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--sidebar-active)] text-white shadow-xs">
            <Layers className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-bold text-white">رواق</span>
            <span className="text-xs text-[var(--sidebar-muted)]">ERP المحاسبة والمخزون</span>
          </span>
        </Link>

        {mode === "app" ? (
          <div className="border-b border-[var(--sidebar-border)] px-3 py-3">
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)] text-xs font-bold text-[var(--sidebar-text)] transition hover:bg-[var(--sidebar-active)] hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {pinnedNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-bold transition",
                  active
                    ? "border-s-[3px] border-[var(--sidebar-active-accent)] bg-[rgba(99,152,255,0.16)] text-white"
                    : "border-s-[3px] border-transparent text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}

          <div className="my-2 border-t border-[var(--sidebar-border)]" />

          {groups.map((group) => {
            const GroupIcon = group.icon;
            const open = openGroups[group.title] ?? false;
            return (
              <div key={group.title} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-[var(--sidebar-muted)] transition hover:bg-[var(--sidebar-hover)] hover:text-white"
                  aria-expanded={open}
                >
                  <GroupIcon className="h-4 w-4 shrink-0 text-[var(--sidebar-icon)]" />
                  <span className="flex-1 text-start">{group.title}</span>
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
                  />
                </button>

                <div
                  className={cn(
                    "grid transition-all duration-200",
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ms-3 mt-1 space-y-1 border-s border-[var(--sidebar-border)] ps-2">
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
                            className={cn(
                              "flex items-center gap-2.5 rounded-full border-s-[3px] border-transparent px-3 py-2 text-sm font-bold transition",
                              active
                                ? "border-[var(--sidebar-active-accent)] bg-[rgba(99,152,255,0.16)] text-white"
                                : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-white",
                            )}
                          >
                            <Icon className={cn("h-4 w-4 shrink-0 text-[var(--sidebar-icon)]", active && "text-[var(--sidebar-active-accent)]")} />
                            <span className="flex-1 truncate">{item.title}</span>
                            {item.badge && (
                              <span className="rounded-full bg-[rgba(99,152,255,0.16)] px-2 py-0.5 text-[10px] font-bold text-[var(--sidebar-text)]">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--sidebar-border)] p-4">
          <div className="rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)] p-4 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Layers className="h-4 w-4" />
              عزل البيانات جاهز
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--sidebar-muted)]">
              بيانات كل مؤسسة منفصلة، والصلاحيات تظهر لكل مستخدم ما يخصه فقط.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
