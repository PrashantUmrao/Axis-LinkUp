'use client';

/**
 * Top Navigation Bar.
 * Sticky frosted glass header supporting responsive sidebar toggles,
 * dynamic breadcrumbs, search placeholder, notifications placeholder,
 * theme toggle, and user profile menu.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui';
import { ThemeToggle } from '@/components/theme';
import { UserProfileMenu } from './user-menu';
import { TopbarNotifications } from './topbar-notifications';
import { getBreadcrumbsForPath } from '@/config/navigation';
import type { UserRole } from '@/types/user';
import { Menu, PanelLeftClose, PanelLeft, Search, ChevronRight } from 'lucide-react';

interface TopbarProps {
  user: {
    email: string;
    role: UserRole;
    fullName?: string;
    avatarUrl?: string | null;
  };
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileDrawer: () => void;
  className?: string;
}

export function Topbar({
  user,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenMobileDrawer,
  className,
}: TopbarProps) {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbsForPath(pathname, user.role);

  return (
    <header
      className={cn(
        'glass-nav border-b-border/40 sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b px-4 transition-all duration-200 sm:px-6',
        className
      )}
    >
      {/* Left: Sidebar Toggles & Breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile Drawer Trigger (<md) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobileDrawer}
          className="text-muted-foreground hover:text-foreground size-9 rounded-lg md:hidden"
          aria-label="Open mobile navigation menu"
        >
          <Menu className="size-5" />
        </Button>

        {/* Desktop Sidebar Toggle (>=md) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="text-muted-foreground hover:text-foreground hidden size-9 rounded-lg md:inline-flex"
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>

        {/* Dynamic Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="hidden items-center gap-1.5 text-xs sm:flex">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;

            return (
              <React.Fragment key={crumb.label + idx}>
                {idx > 0 && <ChevronRight className="text-muted-foreground/60 size-3.5 shrink-0" />}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      isLast
                        ? 'font-heading text-foreground font-semibold'
                        : 'text-muted-foreground'
                    )}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Search, Notifications, Theme, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Non-functional Search Trigger Placeholder */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="glass-panel text-muted-foreground hover:border-glass-border-hover hidden h-8.5 w-60 cursor-not-allowed items-center justify-between rounded-full border px-3.5 text-xs transition-all select-none md:flex"
              aria-disabled="true"
            >
              <div className="flex items-center gap-2">
                <Search className="size-3.5" />
                <span>Search campus...</span>
              </div>
              <kbd className="bg-background/80 text-muted-foreground/80 border-border/60 rounded border px-1.5 py-0.5 font-mono text-[10px] shadow-xs">
                ⌘K
              </kbd>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-semibold">Global Search</p>
            <p className="text-muted-foreground text-[10px]">
              Campus-wide search is planned for Phase 5 implementation.
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Real-time Campus Notices & Notifications */}
        <TopbarNotifications user={user} />

        {/* Theme Switcher */}
        <ThemeToggle variant="icon-button" />

        {/* User Profile Menu */}
        <UserProfileMenu user={user} />
      </div>
    </header>
  );
}
