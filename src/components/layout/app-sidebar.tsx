"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Layers, PackageMinus, ReceiptText, Shield } from "lucide-react";
import { appNav, adminNav } from "@/components/layout/nav-config";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  activePath?: string;
  mode?: "app" | "admin";
  onNavigate?: () => void;
  onChatOpen?: () => void;
};

export function AppSidebar({ activePath = "", mode = "app", onNavigate, onChatOpen }: AppSidebarProps) {
  const pathname = usePathname();
  const currentPath = activePath || pathname;
  const sections = mode === "app" ? appNav : [{ title: "Platform", items: adminNav }];
  const quickLinks = [
    { title: "توريد", href: "/dashboard/invoices", icon: ReceiptText },
    { title: "طلب قسم", href: "/dashboard/purchase-orders", icon: ClipboardCheck },
    { title: "تالف", href: "/dashboard/waste", icon: PackageMinus },
  ];

  const handleLinkClick = () => {
    if (onNavigate) onNavigate();
  };

  return (
    <aside className="flex h-screen w-full flex-col bg-white/95">
      <div className="sticky top-0 flex h-screen flex-col">
        <Link href="/" className="flex items-center gap-3 border-b border-border px-5 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white shadow-sm">
            <Layers className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-bold text-primary">رواق</span>
            <span className="text-xs text-muted-foreground">نظام إدارة مخزن</span>
          </span>
        </Link>

        {mode === "app" ? (
          <div className="border-b border-border px-3 py-3">
            <div className="grid grid-cols-3 gap-2">
              {quickLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border bg-slate-50 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:bg-blue-50 hover:text-primary"
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="mb-2 px-3 text-xs font-semibold text-muted-foreground">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    currentPath === item.href ||
                    (item.href !== "/dashboard" && currentPath.startsWith(`${item.href}/`));

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
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                        isActive && "bg-blue-50 text-primary",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-primary" />
              عزل البيانات جاهز
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              بيانات كل قسم منفصلة، والصلاحيات تظهر لكل مستخدم ما يخصه فقط.
            </p>
            <Badge className="mt-3" tone="success">
              مخزني فقط
            </Badge>
          </div>
        </div>
      </div>
    </aside>
  );
}
