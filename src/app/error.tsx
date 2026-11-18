'use client';

/**
 * Next.js App Router Segment Error Boundary.
 * Renders a branded Glassmorphism recovery view with retry + dashboard escape
 * while strictly concealing internal stack traces or sensitive error internals in production.
 */

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[AppErrorBoundary]', error);
    }
  }, [error]);

  return (
    <div className="bg-background relative flex min-h-[75vh] w-full items-center justify-center overflow-hidden p-4 sm:p-6">
      {/* Ambient Institutional Glow */}
      <div
        className="bg-primary/10 pointer-events-none absolute -top-24 -right-24 size-80 rounded-full blur-3xl"
        aria-hidden="true"
      />

      <div className="glass-panel border-glass-border relative z-10 w-full max-w-lg space-y-6 rounded-2xl border p-6 text-center shadow-xl sm:p-8">
        <div className="bg-destructive/10 text-destructive ring-destructive/20 mx-auto flex size-14 items-center justify-center rounded-2xl ring-1">
          <AlertTriangle className="size-7" />
        </div>

        <div className="space-y-2">
          <p className="text-primary font-mono text-[11px] font-semibold tracking-wider uppercase">
            Axis LinkUp • Service Recovery
          </p>
          <h1 className="font-heading text-foreground text-xl font-bold tracking-tight sm:text-2xl">
            Something went wrong while loading this view
          </h1>
          <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
            An unexpected interruption occurred. Your institutional session remains protected. You
            can safely retry the operation or return to your portal dashboard.
          </p>
        </div>

        {error?.digest && (
          <div className="border-border/50 bg-muted/20 text-muted-foreground inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px]">
            <ShieldCheck className="text-primary size-3.5" />
            <span>Reference ID: {error.digest}</span>
          </div>
        )}

        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Button type="button" onClick={reset} className="w-full gap-2 sm:w-auto">
            <RefreshCw className="size-4" />
            Try Again
          </Button>
          <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
            <Link href="/auth/verify-role">
              <Home className="size-4" />
              Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
