"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Megaphone, ReceiptText, Shield, ShoppingCart, X } from "lucide-react";
import { appNav, adminNav } from "@/components/layout/nav-config";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MobileMenuProps = {
  mode?: "app" | "admin";
  onClose?: () => void;
};

export function MobileMenu({ mode = "app", onClose }: MobileMenuProps) {
  const pathname = usePathname();
  const sections = mode === "app" ? appNav : [{ title: "Platform", items: adminNav }];
  const quickLinks = [
    { title: "بيع", href: "/dashboard/customer-invoices/new", icon: ReceiptText },
    { title: "شراء", href: "/dashboard/purchase-orders", icon: ShoppingCart },
    { title: "نشر", href: "/dashboard/marketing/create", icon: Megaphone },
  ];

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <Link href="/" className="flex items-center gap-3" onClick={handleLinkClick}>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white shadow-sm">
            <Layers className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-bold text-primary">رواق</span>
            <span className="text-xs text-muted-foreground">نظام أعمال متكامل</span>
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

      {/* Quick Actions */}
      {mode === "app" && (
        <div className="border-b border-border px-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border bg-slate-50 text-sm font-semibold text-slate-700 transition hover:border-primary/40 hover:bg-blue-50 hover:text-primary"
                >
                  <Icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation - scrollable */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                      isActive && "bg-blue-50 text-primary font-semibold",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-primary" />
            عزل البيانات جاهز
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            بيانات كل مطعم منفصلة، والصلاحيات تظهر لكل مستخدم ما يخصه فقط.
          </p>
          <Badge className="mt-3" tone="success">
            متعدد العملاء
          </Badge>
        </div>
      </div>
    </div>
  );
}
