import React from 'react';
import Link from 'next/link';
import { ShieldCheck, GraduationCap } from 'lucide-react';
import { ThemeToggle } from '@/components/theme';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col transition-colors duration-200">
      {/* Ambient Optical Sky-Blue Atmosphere (Reference 1) */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,rgba(37,99,235,0.14),rgba(237,245,253,0))] dark:bg-[radial-gradient(ellipse_100%_80%_at_50%_-20%,rgba(59,130,246,0.12),rgba(8,17,31,0))]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -bottom-40 -left-40 -z-10 size-96 rounded-full bg-blue-300/25 blur-3xl dark:bg-blue-600/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -top-40 -right-40 -z-10 size-96 rounded-full bg-sky-200/35 blur-3xl dark:bg-sky-500/10"
        aria-hidden="true"
      />

      {/* Institutional Top Navigation Header */}
      <header className="glass-nav border-border/40 sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="bg-primary/10 text-primary ring-primary/20 flex size-9 items-center justify-center rounded-xl shadow-xs ring-1">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <span className="font-heading text-foreground text-base font-bold tracking-tight">
                Axis LinkUp
              </span>
              <span className="text-muted-foreground border-border/40 hidden text-xs sm:ml-2 sm:inline sm:border-l sm:pl-2">
                Axis Institute of Technology &amp; Management
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>Institutional IAM Gateway</span>
            </div>
            <ThemeToggle variant="icon-button" />
          </div>
        </div>
      </header>

      {/* Main Authentication Card Container */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl justify-center">{children}</div>
      </main>

      {/* Collegiate Security Footer */}
      <footer className="border-border/40 bg-muted/20 text-muted-foreground border-t py-4 text-center text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p>
            © {new Date().getFullYear()} Axis Institute of Technology &amp; Management (AITM). All
            rights reserved.
          </p>
          <p className="text-muted-foreground/80 mt-1 text-[11px]">
            Strictly authorized access only. Public administrator registration is permanently
            disabled.
          </p>
        </div>
      </footer>
    </div>
  );
}
