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
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3" onClick={handleLinkClick}>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-white shadow-sm">
            <Layers className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-extrabold text-primary">رواق</span>
            <span className="text-xs text-muted-foreground">ERP المحاسبة والمخزون</span>
          </span>
        </Link>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-muted-foreground shadow-soft transition hover:bg-primary-light hover:text-primary"
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
                  className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-primary-light bg-white text-sm font-bold text-primary transition hover:border-primary hover:bg-primary-light"
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
                "flex items-center gap-3 rounded-full px-3 py-3 text-sm font-bold transition",
                active
                  ? "bg-secondary text-white shadow-sm"
                  : "bg-white text-foreground hover:bg-primary-light hover:text-primary",
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
                className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-muted-foreground"
                aria-expanded={open}
              >
                <GroupIcon className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="flex-1 text-start">{group.title}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
              </button>
              <div className={cn("grid transition-all duration-200", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden">
                  <div className="ms-2 grid grid-cols-1 gap-1 border-s-2 border-primary-light ps-2">
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
                            "flex items-center gap-2.5 rounded-full px-3 py-3 text-sm font-bold text-muted-foreground transition hover:bg-white hover:text-foreground",
                            active && "bg-primary text-white",
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