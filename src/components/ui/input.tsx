import * as React from 'react';
import { cn } from 'cn';

interface InputProps extends React.ComponentProps<'input'> {
  variant?: 'default' | 'glass';
}

function Input({ className, type, variant = 'default', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      data-variant={variant}
      className={cn(
        'border-input file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-xs transition-all outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'glass' &&
          'glass-panel bg-glass-surface/60 border-glass-border focus-visible:border-primary focus-visible:bg-glass-surface/90 backdrop-blur-md',
        className
      )}
      {...props}
    />
  );
}

export { Input, type InputProps };
