import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps extends React.ComponentProps<'svg'> {
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl';
}

const sizeClasses = {
  xs: 'size-3',
  sm: 'size-4',
  default: 'size-6',
  lg: 'size-8',
  xl: 'size-12',
};

export function LoadingSpinner({ size = 'default', className, ...props }: LoadingSpinnerProps) {
  return (
    <Loader2
      data-slot="loading-spinner"
      className={cn('text-primary animate-spin', sizeClasses[size], className)}
      {...props}
    />
  );
}

interface LoadingStateProps extends React.ComponentProps<'div'> {
  message?: string;
  description?: string;
  size?: 'sm' | 'default' | 'lg';
  glass?: boolean;
}

export function LoadingState({
  message = 'Loading data...',
  description,
  size = 'default',
  glass = false,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      data-slot="loading-state"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center',
        glass && 'glass-panel rounded-xl',
        className
      )}
      {...props}
    >
      <LoadingSpinner size={size} className="mb-3" />
      <p className="text-foreground text-sm font-medium">{message}</p>
      {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
    </div>
  );
}

export function LoadingOverlay({
  message = 'Please wait...',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="loading-overlay"
      className={cn(
        'bg-background/60 absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-xs',
        className
      )}
    >
      <div className="glass-panel flex flex-col items-center justify-center gap-2 rounded-xl px-6 py-4 shadow-lg">
        <LoadingSpinner size="default" />
        <span className="text-foreground text-xs font-medium">{message}</span>
      </div>
    </div>
  );
}
