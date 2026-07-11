"use client";

import { useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { X } from "lucide-react";
import type { AppSession } from "@/lib/auth/session";
import type { Notification } from "@/types/domain";

type PageShellProps = {
  children: React.ReactNode;
  session: AppSession;
  notifications: Notification[];
  mode?: "app" | "admin";
};

export function PageShellClient({
  children,
  session,
  notifications,
  mode = "app",
}: PageShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen bg-background">
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm transition-opacity lg:hidden ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar - end-0 = left side in RTL */}
      <div
        className={`fixed inset-y-0 end-0 z-50 w-72 shrink-0 border-s border-border/80 bg-muted transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-30 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 end-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-muted-foreground shadow-soft transition hover:bg-primary-light hover:text-primary lg:hidden"
          aria-label="إغلاق القائمة"
        >
          <X className="h-5 w-5" />
        </button>

        <AppSidebar mode={mode} role={session.role} onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="min-w-0 flex-1 flex flex-col">
        <AppHeader session={session} notifications={notifications} />
        <main className="mx-auto w-full max-w-7xl px-3 py-4 md:px-5 md:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
