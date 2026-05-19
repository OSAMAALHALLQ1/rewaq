"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mobileMainNav } from "@/components/layout/mobile-nav-config";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white md:hidden">
      <div className="flex items-stretch justify-around">
        {mobileMainNav.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 text-xs font-semibold transition-colors border-t-2 border-transparent",
                isActive
                  ? "border-t-primary text-primary bg-blue-50/50"
                  : "text-muted-foreground hover:text-slate-900 hover:bg-slate-50"
              )}
              aria-label={item.label}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
