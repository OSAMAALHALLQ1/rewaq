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
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="sticky top-0 flex h-full flex-col">
        <Link href="/" className="flex items-center gap-3 border-b border-border px-5 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-sm">
            <Layers className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-bold text-primary">رواق</span>
            <span className="text-xs text-muted-foreground">ERP المحاسبة والمخزون</span>
          </span>
        </Link>

        {mode === "app" ? (
          <div className="border-b border-border px-3 py-3">
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-blue-100 bg-blue-50/60 text-xs font-semibold text-blue-700 transition hover:border-primary/40 hover:bg-blue-100"
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
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-700 hover:bg-blue-50 hover:text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}

          <div className="my-2 border-t border-border" />

          {groups.map((group) => {
            const GroupIcon = group.icon;
            const open = openGroups[group.title] ?? false;
            return (
              <div key={group.title} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-primary"
                  aria-expanded={open}
                >
                  <GroupIcon className="h-4 w-4 shrink-0 text-primary/70" />
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
                    <div className="ms-3 mt-0.5 space-y-0.5 border-s-2 border-blue-100 ps-2">
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
                              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition",
                              active
                                ? "bg-blue-50 text-primary"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                            )}
                          >
                            <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                            <span className="flex-1 truncate">{item.title}</span>
                            {item.badge && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
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

        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Layers className="h-4 w-4" />
              عزل البيانات جاهز
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              بيانات كل مؤسسة منفصلة، والصلاحيات تظهر لكل مستخدم ما يخصه فقط.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
