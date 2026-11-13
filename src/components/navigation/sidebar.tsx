'use client';

/**
 * Premium Glassmorphism Desktop & Tablet Sidebar.
 * Supports collapsible rail view, active route highlights, role-based modules,
 * and tooltips when collapsed.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, Badge, Button } from '@/components/ui';
import { getNavigationForRole, ROLE_PORTAL_METADATA, type NavItem } from '@/config/navigation';
import { NavIcon } from './nav-icons';
import type { UserRole } from '@/types/user';
import { GraduationCap, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface SidebarProps {
  role: UserRole;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export function Sidebar({ role, isCollapsed, onToggleCollapse, className }: SidebarProps) {
  const pathname = usePathname();
  const navigation = getNavigationForRole(role);
  const portalMeta = ROLE_PORTAL_METADATA[role] ?? ROLE_PORTAL_METADATA.student;

  const renderNavItem = (item: NavItem) => {
    const isActive =
      pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));

    const content = (
      <div
        className={cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150',
          isActive
            ? 'bg-primary text-primary-foreground shadow-primary/30 font-semibold shadow-xs'
            : 'text-muted-foreground hover:bg-glass-surface-hover hover:text-foreground',
          item.disabled &&
            'hover:text-muted-foreground cursor-not-allowed opacity-55 hover:bg-transparent',
          isCollapsed && 'justify-center px-2'
        )}
      >
        <NavIcon
          name={item.iconName}
          className={cn(
            'size-4 shrink-0 transition-transform group-hover:scale-105',
            isActive
              ? 'text-primary-foreground'
              : 'text-muted-foreground group-hover:text-foreground'
          )}
        />

        {!isCollapsed && <span className="flex-1 truncate">{item.title}</span>}

        {!isCollapsed && item.badge && (
          <Badge
            variant={isActive ? 'default' : item.disabled ? 'outline' : 'glass'}
            className={cn(
              'px-1.5 py-0 text-[9px] font-normal tracking-tight',
              isActive && 'bg-primary-foreground/20 text-primary-foreground border-transparent'
            )}
          >
            {item.badge}
          </Badge>
        )}
      </div>
    );

    if (item.disabled) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <div className="cursor-not-allowed select-none" aria-disabled="true">
              {content}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <p className="font-semibold">{item.title}</p>
            <p className="text-muted-foreground text-[10px]">
              {item.description || 'Module planned for Phase 5 implementation.'}
            </p>
          </TooltipContent>
        </Tooltip>
      );
    }

    if (isCollapsed) {
      return (
        <Tooltip key={item.id}>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className="focus-visible:ring-primary rounded-lg focus-visible:ring-1 focus-visible:outline-hidden"
            >
              {content}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            <p>{item.title}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        className="focus-visible:ring-primary rounded-lg focus-visible:ring-1 focus-visible:outline-hidden"
      >
        {content}
      </Link>
    );
  };

  return (
    <aside
      aria-label="Sidebar navigation"
      className={cn(
        'glass-panel border-r-border/40 fixed inset-y-0 left-0 z-30 hidden flex-col border-r transition-[width] duration-300 ease-in-out md:flex',
        isCollapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      {/* Sidebar Header & Institutional Crest */}
      <div className="border-b-border/40 flex h-16 items-center justify-between border-b px-4">
        <Link
          href={portalMeta.defaultDashboard}
          className={cn(
            'flex items-center gap-2.5 overflow-hidden transition-all duration-200',
            isCollapsed && 'w-full justify-center'
          )}
        >
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-9 shrink-0 items-center justify-center rounded-xl shadow-xs ring-1">
            <GraduationCap className="size-5" />
          </div>

          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-heading text-foreground truncate text-sm font-bold tracking-tight">
                {portalMeta.portalTitle}
              </span>
              <span className="text-muted-foreground truncate text-[11px] font-medium">
                {portalMeta.portalSubtitle}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {/* Primary Workspace */}
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="text-muted-foreground px-3 text-[10px] font-semibold tracking-wider uppercase">
              Workspace
            </p>
          )}
          <nav className="space-y-1" aria-label="Primary navigation">
            {navigation.primary.map(renderNavItem)}
          </nav>
        </div>

        {/* Academic / Operational Modules */}
        {navigation.modules.length > 0 && (
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="flex items-center justify-between px-3">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Modules
                </p>
                <Sparkles className="text-primary size-3 opacity-60" />
              </div>
            )}
            <nav className="space-y-1" aria-label="Module navigation">
              {navigation.modules.map(renderNavItem)}
            </nav>
          </div>
        )}

        {/* Account & Profile */}
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="text-muted-foreground px-3 text-[10px] font-semibold tracking-wider uppercase">
              Settings
            </p>
          )}
          <nav className="space-y-1" aria-label="Account navigation">
            {navigation.account.map(renderNavItem)}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer & Collapse Toggle */}
      <div className="border-t-border/40 flex items-center justify-between border-t p-3">
        {!isCollapsed && (
          <Badge
            variant={portalMeta.badgeVariant}
            className="text-[10px] font-medium tracking-tight"
          >
            {portalMeta.badgeLabel}
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className={cn(
            'text-muted-foreground hover:text-foreground size-8 rounded-lg',
            isCollapsed && 'w-full'
          )}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>
    </aside>
  );
}
