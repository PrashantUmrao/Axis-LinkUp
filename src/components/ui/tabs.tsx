'use client';

import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: 'default' | 'glass';
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-1',
        variant === 'glass' &&
          'glass-panel bg-glass-surface/50 border-glass-border backdrop-blur-md',
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'focus-visible:border-ring focus-visible:ring-ring/40 data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:font-semibold data-[state=active]:shadow-xs',
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'focus-visible:border-ring focus-visible:ring-ring/40 mt-2 outline-none focus-visible:ring-2',
        className
      )}
      {...props}
    />
  );
}
