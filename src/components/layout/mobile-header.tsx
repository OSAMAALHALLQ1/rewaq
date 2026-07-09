"use client";

import Link from "next/link";
import { Menu, Search, MessageSquare } from "lucide-react";
import { useState } from "react";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { AppSession } from "@/lib/auth/session";
import type { Branch, Notification } from "@/types/domain";

type MobileHeaderProps = {
  session: AppSession;
  branches: Branch[];
  notifications: Notification[];
  onMenuOpen?: () => void;
  onChatOpen?: () => void;
};

export function MobileHeader({
  session,
  branches,
  notifications,
  onMenuOpen,
  onChatOpen,
}: MobileHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setSearchOpen(false)} />
      )}

      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur md:hidden">
        {/* Main header bar */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Logo & Organization */}
          <Link href="/" className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-white text-sm font-bold">
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
              className="rounded-full p-2 transition hover:bg-primary-light"
              aria-label="بحث"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Glowing Chat Trigger Button for Mobile */}
            {onChatOpen && (
              <button
                onClick={onChatOpen}
                className="rounded-full p-2 transition hover:bg-primary-light relative"
                aria-label="الرسائل الداخلية"
              >
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <span className="absolute top-1 end-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
              </button>
            )}

            <NotificationBell notifications={notifications} />

            <button
              onClick={() => {
                if (onMenuOpen) onMenuOpen();
              }}
              className="rounded-full p-2 transition hover:bg-primary-light flex items-center gap-1"
              aria-label="القائمة"
            >
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Branch selector - shown below when branches available */}
        {branches.length > 0 && (
          <div className="px-4 pb-3 flex items-center gap-2 text-xs border-t border-border">
            <span className="text-muted-foreground">الفرع:</span>
            <select
              defaultValue={session.branchId ?? "all"}
              className="flex-1 rounded-full border border-transparent bg-muted px-3 py-1.5 text-xs hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          <div className="px-4 py-3 border-t border-border bg-muted">
            <GlobalSearch variant="mobile" autoFocus onNavigate={() => setSearchOpen(false)} />
          </div>
        )}
      </header>
    </>
  );
}
