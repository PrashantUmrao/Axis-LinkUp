'use client';

/**
 * Next.js Root Global Error Boundary.
 * Catches catastrophic root layout failures outside the main AppShell.
 * Renders a self-contained HTML shell with retry and safe portal return controls,
 * strictly avoiding raw stack traces or sensitive error internals in production.
 */

import React, { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[GlobalErrorBoundary]', error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <main className="flex min-h-screen w-full items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
              <span className="text-2xl font-bold" aria-hidden="true">
                !
              </span>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[11px] font-semibold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                Axis LinkUp • Institutional Campus Portal
              </p>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Unexpected Application Error
              </h1>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-sm dark:text-slate-400">
                We encountered an unexpected issue rendering the campus workspace. Please retry or
                return to the dashboard.
              </p>
            </div>

            {error?.digest && (
              <div className="inline-block rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-mono text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                Reference ID: {error.digest}
              </div>
            )}

            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="w-full rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
              >
                Try Again
              </button>
              <a
                href="/auth/verify-role"
                className="w-full rounded-xl border border-slate-300 bg-transparent px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Return to Dashboard
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
