import Link from "next/link";
import { Boxes, FileText, Megaphone, ReceiptText, ShoppingCart, MessageSquare } from "lucide-react";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { AppSession } from "@/lib/auth/session";
import type { Branch, Notification } from "@/types/domain";

type AppHeaderProps = {
  session: AppSession;
  branches: Branch[];
  notifications: Notification[];
  onChatOpen?: () => void;
};

export function AppHeader({ session, branches, notifications, onChatOpen }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white/88 backdrop-blur">
      <div className="flex min-h-16 items-center gap-2 px-3 md:gap-3 md:px-4 lg:px-6">
        {/* Mobile spacer for menu button - handled in page-shell */}
        <div className="w-10 lg:hidden" />

        <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <GlobalSearch variant="desktop" />
          <Select className="max-w-64" defaultValue={session.branchId ?? "all"} aria-label="اختيار الفرع">
            <option value="all">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="me-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 xl:flex">
            <Button asChild variant="outline">
              <Link href="/dashboard/inventory">
                <Boxes className="h-4 w-4" />
                مخزون
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/invoices">
                <FileText className="h-4 w-4" />
                فاتورة
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/purchase-orders">
                <ShoppingCart className="h-4 w-4" />
                طلب شراء
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/marketing/create">
                <Megaphone className="h-4 w-4" />
                منشور
              </Link>
            </Button>
          </div>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/dashboard/customer-invoices/new">
              <ReceiptText className="h-4 w-4" />
              بيع سريع
            </Link>
          </Button>

          {/* Premium Glowing Chat Trigger Button */}
          {onChatOpen && (
            <Button 
              onClick={onChatOpen} 
              variant="ghost" 
              size="icon" 
              className="text-slate-600 hover:text-primary relative hover:bg-slate-50 rounded-lg transition-all h-9 w-9" 
              title="الرسائل الداخلية"
            >
              <MessageSquare className="h-4.5 w-4.5" />
              <span className="absolute top-1 end-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
            </Button>
          )}

          <NotificationBell notifications={notifications} />
          <div className="hidden text-end sm:block">
            <p className="text-sm font-semibold">{session.user.name}</p>
            <p className="text-xs text-muted-foreground">{session.organizationName}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
