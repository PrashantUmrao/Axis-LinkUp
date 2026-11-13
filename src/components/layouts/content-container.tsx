/**
 * Reusable Main Content Container.
 * Provides standardized padding, responsive max-width bounds,
 * and optional page header slots (title, subtitle, badge, action buttons).
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface ContentContainerProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'default' | 'narrow' | 'wide' | 'full';
  className?: string;
}

const MAX_WIDTH_MAP = {
  narrow: 'max-w-4xl',
  default: 'max-w-7xl',
  wide: 'max-w-(--breakpoint-2xl)',
  full: 'max-w-full',
};

export function ContentContainer({
  title,
  subtitle,
  badge,
  actions,
  children,
  maxWidth = 'default',
  className,
}: ContentContainerProps) {
  const hasHeader = Boolean(title || subtitle || badge || actions);

  return (
    <div
      className={cn(
        'mx-auto w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8',
        MAX_WIDTH_MAP[maxWidth],
        className
      )}
    >
      {hasHeader && (
        <header className="border-border/40 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              {title && (
                <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                  {title}
                </h1>
              )}
              {badge}
            </div>
            {subtitle && (
              <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">{subtitle}</p>
            )}
          </div>

          {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
        </header>
      )}

      {children}
    </div>
  );
}
