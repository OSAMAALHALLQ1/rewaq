"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Layers, ReceiptText, ShoppingCart, X } from "lucide-react";
import {
  appNav,
  adminNav,
  pinnedNav,
  type NavGroup,
  type NavItem,
} from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/domain";

type MobileMenuProps = {
  mode?: "app" | "admin";
  role?: Role;
  onClose?: () => void;
  onChatOpen?: () => void;
};

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

export function MobileMenu({ mode = "app", role, onClose, onChatOpen }: MobileMenuProps) {
  const pathname = usePathname();
  const groups = React.useMemo(() => buildGroups(mode, role), [mode, role]);

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groups.forEach((g) => {
      initial[g.title] = g.defaultOpen ?? false;
    });
    return initial;
  });

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = { ...prev };
      groups.forEach((g) => {
        next[g.title] = prev[g.title] ?? g.defaultOpen ?? false;
      });
      return next;
    });
  }, [groups]);

  const toggleGroup = (title: string) =>
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  const quickLinks: NavItem[] = [
    { title: "فاتورة توريد", href: "/dashboard/invoices", icon: ReceiptText },
    { title: "طلب شراء", href: "/dashboard/purchase-orders", icon: ShoppingCart },
  ];

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3" onClick={handleLinkClick}>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-sm">
            <Layers className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-bold text-primary">رواق</span>
            <span className="text-xs text-muted-foreground">ERP المحاسبة والمخزون</span>
          </span>
        </Link>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          aria-label="إغلاق القائمة"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {mode === "app" && (
        <div className="border-b border-border px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50/60 text-sm font-semibold text-blue-700 transition hover:border-primary/40 hover:bg-blue-100"
                >
                  <Icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {pinnedNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}

        {groups.map((group) => {
          const GroupIcon = group.icon;
          const open = openGroups[group.title] ?? false;
          return (
            <div key={group.title}>
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-xs font-bold text-slate-500"
                aria-expanded={open}
              >
                <GroupIcon className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="flex-1 text-start">{group.title}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
              </button>
              <div className={cn("grid transition-all duration-200", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden">
                  <div className="ms-2 grid grid-cols-1 gap-1 border-s-2 border-blue-100 ps-2">
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
                              if (onClose) onClose();
                              onChatOpen();
                            } else {
                              handleLinkClick();
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950",
                            active && "bg-blue-50 text-primary font-semibold",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
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
    </div>
  );
}
