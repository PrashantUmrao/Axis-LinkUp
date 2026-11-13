import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

const glassPanelVariants = cva(
  'relative overflow-hidden transition-all duration-200 bg-clip-padding',
  {
    variants: {
      variant: {
        primary:
          'bg-glass-surface border border-glass-border shadow-[var(--glass-shadow)] shadow-[var(--glass-highlight)]',
        secondary:
          'bg-glass-surface-secondary border border-glass-border/70 shadow-[var(--glass-shadow)]',
        interactive:
          'bg-glass-surface border border-glass-border shadow-[var(--glass-shadow)] shadow-[var(--glass-highlight)] hover:bg-glass-surface-hover hover:border-glass-border-hover hover:shadow-lg cursor-pointer',
        elevated:
          'bg-glass-surface border border-glass-border shadow-xl shadow-[var(--glass-highlight)]',
        subtle: 'bg-glass-surface/40 border border-glass-border/50',
        canvas: 'glass-canvas',
      },
      blur: {
        none: '',
        sm: 'backdrop-blur-sm',
        md: 'backdrop-blur-md',
        lg: 'backdrop-blur-lg',
        xl: 'backdrop-blur-xl',
        '2xl': 'backdrop-blur-2xl',
      },
      radius: {
        none: 'rounded-none',
        sm: 'rounded-md',
        md: 'rounded-lg',
        lg: 'rounded-xl',
        xl: 'rounded-2xl',
        '3xl': 'rounded-3xl',
        canvas: 'rounded-[32px]',
        full: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      blur: 'md',
      radius: 'lg',
    },
  }
);

export interface GlassPanelProps
  extends React.ComponentProps<'div'>, VariantProps<typeof glassPanelVariants> {
  asChild?: boolean;
}

export function GlassPanel({
  className,
  variant,
  blur,
  radius,
  asChild = false,
  ...props
}: GlassPanelProps) {
  const Comp = asChild ? Slot.Root : 'div';

  return (
    <Comp
      data-slot="glass-panel"
      className={cn(glassPanelVariants({ variant, blur, radius, className }))}
      {...props}
    />
  );
}
