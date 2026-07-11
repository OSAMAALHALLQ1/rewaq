"use client";

import { useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { GlobalHotkeys } from "@/components/layout/global-hotkeys";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileMenu } from "@/components/layout/mobile-menu";
import type { AppSession } from "@/lib/auth/session";
import type { Branch, Notification } from "@/types/domain";

type ResponsivePageShellProps = {
  children: React.ReactNode;
  session: AppSession;
  branches: Branch[];
  notifications: Notification[];
  mode?: "app" | "admin";
};

/**
 * Responsive Page Shell
 *
 * Desktop (lg+):
 * - Persistent sidebar on left
 * - Desktop header with search, branch selector, action buttons
 * - Full-width main content
 *
 * Mobile/Tablet (below lg):
 * - Mobile header with hamburger, search, notifications
 * - Hamburger opens centered full-screen menu with all nav options
 * - Bottom navigation for quick access
 * - Content optimized for touch
 */
export function ResponsivePageShell({
  children,
  session,
  branches,
  notifications,
  mode = "app",
}: ResponsivePageShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <GlobalHotkeys />
      <CommandPalette />

      {/* Mobile Header (visible on lg and below) */}
      <MobileHeader
        session={session}
        branches={branches}
        notifications={notifications}
        onMenuOpen={() => setMobileMenuOpen(true)}
      />

      {/* Mobile Menu - centered full-screen overlay */}
      {mobileMenuOpen && (
        <MobileMenu 
          mode={mode} 
          role={session.role}
          onClose={() => setMobileMenuOpen(false)} 
        />
      )}



      <div className="relative flex min-h-screen bg-background">
        {/* Desktop Sidebar - visible on md+ */}
        <div className="hidden w-64 shrink-0 border-s border-border/80 bg-muted md:flex xl:w-72">
          <AppSidebar 
            mode={mode} 
            role={session.role}
          />
        </div>

        {/* Main Content */}
        <div className="min-w-0 flex-1 flex flex-col">
          {/* Desktop Header (visible on md and up) */}
          <div className="hidden md:block sticky top-0 z-20">
            <AppHeader 
              session={session} 
              branches={branches} 
              notifications={notifications} 
            />
          </div>

          {/* Main Content Area */}
          <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 pb-24 md:px-5 md:py-6 md:pb-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation (visible below md) */}
      <MobileBottomNav />
    </>
  );
}
