"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/domain";

// Map notification types to custom Arabic icons and styles
const notificationConfig: Record<string, { title: string; icon: any; color: string }> = {
  low_stock: { title: "📉 نقص في المخزون", icon: AlertTriangle, color: "text-amber-500" },
  price_increase: { title: "📈 ارتفاع أسعار المورد", icon: AlertCircle, color: "text-rose-500" },
  high_food_cost: { title: "⚠️ تكلفة وجبات مرتفعة", icon: AlertCircle, color: "text-red-600" },
  purchase_received: { title: "📦 تم استلام بضاعة", icon: CheckCircle2, color: "text-emerald-500" },
  waste_logged: { title: "🗑️ تسجيل هدر جديد", icon: Info, color: "text-blue-500" },
  publish_failed: { title: "❌ فشل النشر التلقائي", icon: AlertCircle, color: "text-red-500" },
};

export function NotificationBell({ notifications: initialNotifications }: { notifications: Notification[] }) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const unread = notifications.filter((n) => !n.readAt);

  useEffect(() => {
    // 1. Request permission for native push notifications on boot
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    // 2. Realtime WebSocket subscription for notifications table
    const channel = supabase
      .channel("live-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const newNotification = payload.new as any;
          
          const camelNotification: Notification = {
            id: newNotification.id,
            organizationId: newNotification.organization_id,
            type: newNotification.type,
            title: newNotification.title,
            body: newNotification.body,
            severity: newNotification.severity,
            readAt: newNotification.read_at,
            createdAt: newNotification.created_at,
          };

          // Prepend the new notification to state
          setNotifications((prev) => [camelNotification, ...prev]);

          // Play premium chime sound effect
          playNotificationSound();

          // Trigger standard browser window alert
          showNativeNotification(camelNotification);
        }
      )
      .subscribe();

    // Close the dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [supabase]);

  // Dynamic sound chime synthesis via AudioContext
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Tone D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // Tone A5
      
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.25);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.log("Audio notification skipped");
    }
  };

  const showNativeNotification = (notification: Notification) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const config = notificationConfig[notification.type] || { title: "تنبيه جديد" };
      new Notification(config.title, {
        body: notification.body,
        icon: "/favicon.ico",
      });
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const now = new Date().toISOString();
    
    // Update local state immediately for blazing fast feedback
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: now } : n))
    );

    // Save update in Supabase database
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", id);
  };

  const handleMarkAllAsRead = async () => {
    const now = new Date().toISOString();
    
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: now })));

    if (notifications.length > 0) {
      await supabase
        .from("notifications")
        .update({ read_at: now })
        .is("read_at", null);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="icon"
        aria-label="الإشعارات"
        className="relative hover:bg-slate-50 transition-all active:scale-95"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-4.5 w-4.5 text-slate-700" />
        {unread.length > 0 ? (
          <Badge
            tone="danger"
            className="absolute -end-1.5 -top-1.5 h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-bold animate-pulse shadow-sm"
          >
            {unread.length}
          </Badge>
        ) : null}
      </Button>

      {isOpen && (
        <div className="absolute end-0 mt-2.5 w-80 max-w-sm rounded-xl border border-slate-100 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3 bg-slate-50/50">
            <span className="font-semibold text-xs text-slate-900">التنبيهات الفورية</span>
            {unread.length > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[10px] text-primary hover:underline font-semibold"
              >
                قراءة الكل
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Bell className="h-8 w-8 stroke-[1.5] mb-2 text-slate-300" />
                <span className="text-[11px] font-medium">لا توجد تنبيهات حالياً</span>
              </div>
            ) : (
              notifications.map((notification) => {
                const config = notificationConfig[notification.type] || {
                  title: notification.title,
                  icon: Info,
                  color: "text-slate-500",
                };
                const Icon = config.icon;
                const isUnread = !notification.readAt;

                return (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 p-3 transition-colors text-right relative ${
                      isUnread ? "bg-slate-50 hover:bg-slate-100/70" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white shadow-sm border border-slate-100">
                      <Icon className={`h-4.5 w-4.5 ${config.color}`} />
                    </span>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 leading-tight">
                        {config.title}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 leading-normal line-clamp-2">
                        {notification.body}
                      </p>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {new Date(notification.createdAt).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        title="تعليم كمقروء"
                        className="self-center p-1 rounded-full hover:bg-white border border-slate-100 text-slate-400 hover:text-primary transition-colors shrink-0"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
