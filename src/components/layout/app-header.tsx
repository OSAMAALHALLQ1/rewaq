import Link from "next/link";
import { Menu, Plus, Search } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AppSession } from "@/lib/auth/session";
import type { Branch, Notification } from "@/types/domain";

type AppHeaderProps = {
  session: AppSession;
  branches: Branch[];
  notifications: Notification[];
};

export function AppHeader({ session, branches, notifications }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-4 lg:px-6">
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="فتح القائمة">
          <Menu className="h-4 w-4" />
        </Button>

        <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pe-3 ps-9" placeholder="ابحث عن مادة، مورد، وصفة، أو منشور..." />
          </div>
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
          {session.isDemo ? <Badge tone="warning">وضع التجربة</Badge> : null}
          <Link
            href="/dashboard/marketing/create"
            className="focus-ring hidden h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-teal-800 sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            منشور جديد
          </Link>
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
