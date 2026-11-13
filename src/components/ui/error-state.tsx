import * as React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps extends React.ComponentProps<'div'> {
  title?: string;
  message?: string;
  errorCode?: string;
  onRetry?: () => void;
  retryLabel?: string;
  glass?: boolean;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while processing this request.',
  errorCode,
  onRetry,
  retryLabel = 'Try again',
  glass = true,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center sm:p-10',
        glass
          ? 'glass-card border-destructive/30'
          : 'border-destructive/20 bg-destructive/5 rounded-xl border',
        className
      )}
      {...props}
    >
      <div className="bg-destructive/15 text-destructive border-destructive/30 mb-3.5 flex size-12 items-center justify-center rounded-xl border shadow-xs">
        <AlertTriangle className="size-6 stroke-[1.75]" />
      </div>

      <h3 className="font-heading text-foreground text-base font-semibold">{title}</h3>

      <p className="text-muted-foreground mt-1.5 max-w-sm text-xs leading-relaxed">{message}</p>

      {errorCode && (
        <span className="bg-muted text-muted-foreground border-border mt-3 rounded-md border px-2 py-0.5 font-mono text-[11px]">
          Code: {errorCode}
        </span>
      )}

      {onRetry && (
        <div className="mt-5">
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="border-destructive/30 hover:bg-destructive/10 text-xs font-medium"
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
