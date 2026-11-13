'use client';

/**
 * Global Authenticated Application Shell.
 * Orchestrates the collapsible desktop sidebar, responsive mobile drawer,
 * sticky glass topbar, and main content container.
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/navigation/sidebar';
import { Topbar } from '@/components/navigation/topbar';
import { MobileDrawer } from '@/components/navigation/mobile-drawer';
import type { UserRole } from '@/types/user';

interface AppShellUser {
  email: string;
  role: UserRole;
  fullName?: string;
  avatarUrl?: string | null;
}

interface AppShellProps {
  user: AppShellUser;
  children: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'axis-linkup-sidebar-collapsed';

export function AppShell({ user, children }: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Synchronize sidebar state from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) {
        setIsSidebarCollapsed(stored === 'true');
      }
    } catch {
      // Safe fallback if localStorage is disabled
    }
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Safe fallback
      }
      return next;
    });
  };

  const handleOpenMobileDrawer = () => setIsMobileDrawerOpen(true);
  const handleCloseMobileDrawer = () => setIsMobileDrawerOpen(false);

  return (
    <div className="bg-background text-foreground relative flex min-h-screen w-full flex-col overflow-x-hidden transition-colors duration-200">
      {/* Ambient Sky-Blue Optical Glass Atmosphere (Reference 1) */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,rgba(37,99,235,0.12),rgba(237,245,253,0))] dark:bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,rgba(59,130,246,0.10),rgba(8,17,31,0))]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -bottom-32 -left-32 -z-10 size-96 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-600/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -top-32 -right-32 -z-10 size-96 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10"
        aria-hidden="true"
      />

      {/* Desktop & Tablet Collapsible Sidebar */}
      <Sidebar
        role={user.role}
        isCollapsed={isMounted ? isSidebarCollapsed : false}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Mobile Drawer (<=md) */}
      <MobileDrawer
        role={user.role}
        isOpen={isMobileDrawerOpen}
        onClose={handleCloseMobileDrawer}
      />

      {/* Main Dynamic Viewport */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-in-out',
          (isMounted ? isSidebarCollapsed : false) ? 'md:ml-20' : 'md:ml-64'
        )}
      >
        {/* Sticky Glass Topbar */}
        <Topbar
          user={user}
          isSidebarCollapsed={isMounted ? isSidebarCollapsed : false}
          onToggleSidebar={handleToggleSidebar}
          onOpenMobileDrawer={handleOpenMobileDrawer}
        />

        {/* Dynamic Main Content Slot */}
        <main className="w-full min-w-0 flex-1 pb-12">{children}</main>

        {/* Institutional Shell Footer */}
        <footer className="border-t-border/30 text-muted-foreground border-t py-4 text-center text-xs">
          <p>Axis LinkUp • Axis Institute of Technology &amp; Management (AITM)</p>
        </footer>
      </div>
    </div>
  );
}
