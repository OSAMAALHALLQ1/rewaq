"use client";

import { useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { InternalChatDrawer } from "@/components/layout/internal-chat-drawer";
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
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      {/* Mobile Header (visible on lg and below) */}
      <MobileHeader
        session={session}
        branches={branches}
        notifications={notifications}
        onMenuOpen={() => setMobileMenuOpen(true)}
        onChatOpen={() => setChatOpen(true)}
      />

      {/* Mobile Menu - centered full-screen overlay */}
      {mobileMenuOpen && (
        <MobileMenu 
          mode={mode} 
          onClose={() => setMobileMenuOpen(false)} 
          onChatOpen={() => setChatOpen(true)}
        />
      )}

      {/* Internal Chat Drawer (Global) */}
      {session && session.organizationId && (
        <InternalChatDrawer
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          orgId={session.organizationId}
          branchId={session.branchId}
          currentRole={session.role}
          currentName={session.user.name}
        />
      )}

      <div className="flex relative min-h-screen">
        {/* Desktop Sidebar - visible on md+ */}
        <div className="hidden md:flex shrink-0 w-64 xl:w-72 border-s border-border bg-white">
          <AppSidebar 
            mode={mode} 
            onChatOpen={() => setChatOpen(true)}
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
              onChatOpen={() => setChatOpen(true)}
            />
          </div>

          {/* Main Content Area */}
          <main className="flex-1 mx-auto w-full max-w-7xl px-3 py-4 md:px-4 md:py-6 lg:px-6 pb-24 md:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation (visible below md) */}
      <MobileBottomNav />
    </>
  );
}
