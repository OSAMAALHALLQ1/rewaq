"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Shield } from "lucide-react";
import { appNav, adminNav } from "@/components/layout/nav-config";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  activePath?: string;
  mode?: "app" | "admin";
};

export function AppSidebar({ activePath = "", mode = "app" }: AppSidebarProps) {
  const pathname = usePathname();
  const currentPath = activePath || pathname;
  const sections = mode === "app" ? appNav : [{ title: "Platform", items: adminNav }];

  return (
    <aside className="hidden w-72 shrink-0 border-e border-border bg-white/90 lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <Link href="/" className="flex items-center gap-3 border-b border-border px-5 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white">
            <Leaf className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-bold text-primary">رواق</span>
            <span className="text-xs text-muted-foreground">منصة إدارة المطاعم</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
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
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                        isActive && "bg-teal-50 text-primary",
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
              كل الجداول مربوطة بـ organization_id وسياسات عزل بيانات.
            </p>
            <Badge className="mt-3" tone="success">
              متعدد العملاء
            </Badge>
          </div>
        </div>
      </div>
    </aside>
  );
}
