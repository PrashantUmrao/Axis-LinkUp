import * as React from 'react';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps extends React.ComponentProps<'div'> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  glass?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  glass = true,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center sm:p-12',
        glass
          ? 'glass-card border-dashed'
          : 'border-border/60 bg-muted/20 rounded-xl border border-dashed',
        className
      )}
      {...props}
    >
      <div className="bg-primary/10 text-primary border-primary/20 mb-4 flex size-12 items-center justify-center rounded-xl border shadow-xs">
        {icon || <Inbox className="size-6 stroke-[1.5]" />}
      </div>

      <h3 className="font-heading text-foreground text-base font-semibold">{title}</h3>

      {description && (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-xs leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-5">
          <Button size="sm" onClick={action.onClick} className="text-xs font-medium">
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
