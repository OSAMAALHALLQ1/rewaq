"use client";

import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { AppSession } from "@/lib/auth/session";
import type { Branch, Notification } from "@/types/domain";

type MobileHeaderProps = {
  session: AppSession;
  branches: Branch[];
  notifications: Notification[];
  onMenuOpen?: () => void;
};

export function MobileHeader({
  session,
  branches,
  notifications,
  onMenuOpen,
}: MobileHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setSearchOpen(false)} />
      )}

      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur md:hidden">
        {/* Main header bar */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Logo & Organization */}
          <Link href="/" className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-white text-sm font-bold">
                ر
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary truncate">{session.organizationName}</p>
                <p className="text-xs text-muted-foreground truncate">{session.user.name}</p>
              </div>
            </div>
          </Link>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition"
              aria-label="بحث"
            >
              <Search className="h-5 w-5 text-slate-600" />
            </button>

            <NotificationBell notifications={notifications} />

            <button
              onClick={() => {
                if (onMenuOpen) onMenuOpen();
              }}
              className="p-2 hover:bg-slate-100 rounded-lg transition flex items-center gap-1"
              aria-label="القائمة"
            >
              <Menu className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Branch selector - shown below when branches available */}
        {branches.length > 0 && (
          <div className="px-4 pb-3 flex items-center gap-2 text-xs border-t border-border">
            <span className="text-muted-foreground">الفرع:</span>
            <select
              defaultValue={session.branchId ?? "all"}
              className="flex-1 rounded border border-input bg-white px-2 py-1 text-xs hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              suppressHydrationWarning
            >
              <option value="all">كل الفروع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search bar - slides in from top */}
        {searchOpen && (
          <div className="px-4 py-3 border-t border-border bg-slate-50">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              <input
                type="text"
                placeholder="بحث: صنف، فاتورة، مورد..."
                className="w-full rounded-lg border border-input bg-white ps-9 pe-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          </div>
        )}
      </header>
    </>
  );
}
