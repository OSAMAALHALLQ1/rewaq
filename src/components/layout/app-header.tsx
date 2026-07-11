"use client";

import { MessageSquare, Plus } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { StatusStrip } from "@/components/layout/status-strip";
import { Button } from "@/components/ui/button";
import { openCommandPalette } from "@/components/layout/global-hotkeys";
import type { AppSession } from "@/lib/auth/session";
import type { Notification } from "@/types/domain";

type AppHeaderProps = {
  session: AppSession;
  notifications: Notification[];
  onChatOpen?: () => void;
};

export function AppHeader({ session, notifications, onChatOpen }: AppHeaderProps) {

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--surface-primary)]/95 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <GlobalSearch variant="desktop" />
        </div>

        <div className="flex shrink-0 items-center justify-start gap-2">
          <Button
            onClick={() => openCommandPalette("جديد")}
            size="sm"
            className="hidden gap-1.5 sm:inline-flex"
            title="إنشاء سريع (Alt+N)"
          >
            <Plus className="h-4 w-4" />
            إنشاء سريع
            <kbd className="ms-1 rounded border border-white/25 bg-white/15 px-1 text-[10px] font-bold">
              Alt N
            </kbd>
          </Button>

          {onChatOpen && (
            <Button
              onClick={onChatOpen}
              variant="ghost"
              size="icon"
              className="relative h-11 w-11 text-muted-foreground transition-all hover:bg-primary-light hover:text-primary"
              title="الرسائل الداخلية"
            >
              <MessageSquare className="h-4.5 w-4.5" />
            </Button>
          )}

          <NotificationBell notifications={notifications} />

          <div className="hidden items-center gap-2 text-end sm:flex">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{session.user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{session.organizationName}</p>
            </div>
          </div>
        </div>
      </div>

      <StatusStrip
        items={[
          { kind: "ok", label: "النظام يعمل طبيعيًا" },
          { kind: "info", label: "12 جهاز POS متصل" },
          { kind: "warn", label: "1 طابعة تحتاج مراجعة" },
          { label: "آخر مزامنة: قبل 34ث" },
        ]}
      />
    </header>
  );
}
