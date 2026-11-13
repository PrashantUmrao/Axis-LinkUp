import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.ComponentProps<'textarea'> {
  variant?: 'default' | 'glass';
}

export function Textarea({ className, variant = 'default', ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      data-variant={variant}
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/30 flex min-h-[80px] w-full rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs transition-all outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'glass' &&
          'bg-glass-surface/60 border-glass-border focus-visible:border-primary focus-visible:bg-glass-surface/90 backdrop-blur-md',
        className
      )}
      {...props}
    />
  );
}
