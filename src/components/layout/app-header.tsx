"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, FileText, Megaphone, ReceiptText, ShoppingCart, MessageSquare, Plus, ChevronLeft } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { StatusStrip } from "@/components/layout/status-strip";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { openCommandPalette } from "@/components/layout/global-hotkeys";
import { pinnedNav, appNav } from "@/components/layout/nav-config";
import type { AppSession } from "@/lib/auth/session";
import type { Branch, Notification } from "@/types/domain";

type AppHeaderProps = {
  session: AppSession;
  branches: Branch[];
  notifications: Notification[];
  onChatOpen?: () => void;
};

function useBreadcrumb(pathname: string): string {
  const flat = [
    ...pinnedNav,
    ...appNav.flatMap((g) => g.items),
  ];
  let best = flat.find((i) => i.href === pathname);
  if (!best) {
    best = flat
      .filter((i) => pathname.startsWith(`${i.href}/`) || pathname.startsWith(i.href))
      .sort((a, b) => b.href.length - a.href.length)[0];
  }
  return best?.title ?? "لوحة التشغيل";
}

export function AppHeader({ session, branches, notifications, onChatOpen }: AppHeaderProps) {
  const pathname = usePathname();
  const current = useBreadcrumb(pathname);
  const initials = (session.user.name || "م").trim().charAt(0) || "م";

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--surface-primary)]/95 backdrop-blur">
      <div className="grid grid-cols-[1fr_minmax(320px,600px)_1fr] items-center gap-3 px-4 py-3 md:px-6">
        {/* اليمين: مسار التنقّل + اختيار الفرع */}
        <div className="flex min-w-0 items-center gap-3">
          <Select
            className="hidden h-9 w-auto max-w-[11rem] lg:flex"
            defaultValue={session.branchId ?? "all"}
            aria-label="اختيار الفرع"
          >
            <option value="all">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <div className="hidden min-w-0 items-center gap-1.5 text-xs text-[var(--text-secondary)] sm:flex">
            <span>مساحة العمل</span>
            <ChevronLeft className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="truncate font-bold text-[var(--text-primary)]">{current}</span>
          </div>
        </div>

        {/* المنتصف: مشغّل لوحة الأوامر */}
        <div className="min-w-0">
          <GlobalSearch variant="desktop" />
        </div>

        {/* اليسار: إنشاء سريع + الرسائل + الإشعارات + الملف الشخصي */}
        <div className="flex items-center justify-start gap-2">
          <div className="hidden items-center gap-2 xl:flex">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/inventory">
                <Boxes className="h-4 w-4" />
                مخزون
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/invoices">
                <FileText className="h-4 w-4" />
                فاتورة
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/purchase-orders">
                <ShoppingCart className="h-4 w-4" />
                طلب شراء
              </Link>
            </Button>
          </div>

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
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--secondary)] text-xs font-extrabold text-white">
              {initials}
            </span>
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
