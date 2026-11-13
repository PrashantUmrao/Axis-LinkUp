'use client';

/**
 * Mobile Navigation Drawer.
 * Full-height slide-over glass drawer with backdrop overlay for small viewports.
 * Closes automatically on route changes and backdrop clicks.
 */

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge, Button } from '@/components/ui';
import { getNavigationForRole, ROLE_PORTAL_METADATA, type NavItem } from '@/config/navigation';
import { NavIcon } from './nav-icons';
import type { UserRole } from '@/types/user';
import { GraduationCap, X, Sparkles } from 'lucide-react';

interface MobileDrawerProps {
  role: UserRole;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ role, isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const navigation = getNavigationForRole(role);
  const portalMeta = ROLE_PORTAL_METADATA[role] ?? ROLE_PORTAL_METADATA.student;

  // Automatically close drawer on pathname navigation change
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Trap Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const renderDrawerItem = (item: NavItem) => {
    const isActive =
      pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));

    if (item.disabled) {
      return (
        <div
          key={item.id}
          className="text-muted-foreground flex items-center justify-between rounded-lg px-3 py-2.5 text-sm opacity-50 select-none"
          aria-disabled="true"
        >
          <div className="flex items-center gap-3">
            <NavIcon name={item.iconName} className="size-4 shrink-0" />
            <span>{item.title}</span>
          </div>
          {item.badge && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {item.badge}
            </Badge>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onClose}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground shadow-primary/30 font-semibold shadow-xs'
            : 'text-muted-foreground hover:bg-glass-surface-hover hover:text-foreground'
        )}
      >
        <div className="flex items-center gap-3">
          <NavIcon
            name={item.iconName}
            className={cn('size-4 shrink-0', isActive ? 'text-primary-foreground' : '')}
          />
          <span>{item.title}</span>
        </div>
        {item.badge && (
          <Badge
            variant={isActive ? 'default' : 'glass'}
            className={cn(
              'px-1.5 py-0 text-[10px]',
              isActive && 'bg-primary-foreground/20 text-primary-foreground border-transparent'
            )}
          >
            {item.badge}
          </Badge>
        )}
      </Link>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Drawer"
    >
      {/* Backdrop Glass Blur Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer Panel */}
      <div className="glass-panel border-r-border/40 fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r shadow-2xl transition-transform duration-300">
        {/* Drawer Header */}
        <div className="border-b-border/40 flex h-16 items-center justify-between border-b px-4">
          <Link
            href={portalMeta.defaultDashboard}
            onClick={onClose}
            className="flex items-center gap-2.5"
          >
            <div className="bg-primary/10 text-primary ring-primary/20 flex size-9 items-center justify-center rounded-xl ring-1">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <p className="font-heading text-foreground text-sm font-bold tracking-tight">
                {portalMeta.portalTitle}
              </p>
              <p className="text-muted-foreground text-[11px] font-medium">
                {portalMeta.portalSubtitle}
              </p>
            </div>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground size-8 rounded-lg"
            aria-label="Close navigation drawer"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Drawer Navigation List */}
        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {/* Primary */}
          <div className="space-y-1">
            <p className="text-muted-foreground px-3 text-[10px] font-semibold tracking-wider uppercase">
              Workspace
            </p>
            <nav className="space-y-1">{navigation.primary.map(renderDrawerItem)}</nav>
          </div>

          {/* Modules */}
          {navigation.modules.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3">
                <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Modules
                </p>
                <Sparkles className="text-primary size-3 opacity-60" />
              </div>
              <nav className="space-y-1">{navigation.modules.map(renderDrawerItem)}</nav>
            </div>
          )}

          {/* Account */}
          <div className="space-y-1">
            <p className="text-muted-foreground px-3 text-[10px] font-semibold tracking-wider uppercase">
              Settings
            </p>
            <nav className="space-y-1">{navigation.account.map(renderDrawerItem)}</nav>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="border-t-border/40 flex items-center justify-between border-t p-4">
          <Badge variant={portalMeta.badgeVariant} className="text-[10px]">
            {portalMeta.badgeLabel}
          </Badge>
          <span className="text-muted-foreground text-[11px]">Axis LinkUp v0.1.0</span>
        </div>
      </div>
    </div>
  );
}
