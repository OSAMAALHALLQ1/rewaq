import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/types/domain";

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const unread = notifications.filter((notification) => !notification.readAt);

  return (
    <div className="relative">
      <Button variant="outline" size="icon" aria-label="الإشعارات">
        <Bell className="h-4 w-4" />
      </Button>
      {unread.length > 0 ? (
        <Badge tone="danger" className="absolute -end-2 -top-2 h-5 min-w-5 justify-center px-1">
          {unread.length}
        </Badge>
      ) : null}
    </div>
  );
}
