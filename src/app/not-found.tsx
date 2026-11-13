import React from 'react';
import Link from 'next/link';
import { FileQuestion, ArrowLeft, Home, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui';
import { ThemeToggle } from '@/components/theme';

export default function NotFound() {
  return (
    <div className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center p-4 text-center transition-colors duration-200">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(52,86,209,0.06),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(130,154,255,0.04),rgba(0,0,0,0))]"
        aria-hidden="true"
      />

      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle variant="icon-button" />
      </div>

      <div className="glass-card border-border/40 w-full max-w-md p-6 shadow-2xl backdrop-blur-md sm:p-8">
        {/* Brand Crest */}
        <div className="bg-primary/10 text-primary ring-primary/20 mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl shadow-md ring-1">
          <FileQuestion className="size-7" />
        </div>

        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold text-amber-500">
          HTTP 404 • NOT FOUND
        </div>

        <h1 className="font-heading text-foreground mb-2 text-2xl font-bold tracking-tight">
          Resource Not Found
        </h1>
        <p className="text-muted-foreground mb-6 text-xs leading-relaxed">
          The requested collegiate resource, module, or URL could not be located on the Axis LinkUp
          platform.
        </p>

        <div className="flex flex-col gap-2.5">
          <Button asChild variant="default" className="w-full text-xs font-medium">
            <Link href="/">
              <Home className="mr-2 size-4" />
              Return to Campus Home
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full text-xs">
            <Link href="/sign-in">
              <ArrowLeft className="mr-2 size-4" />
              Sign In to Your Account
            </Link>
          </Button>
        </div>

        <div className="border-border/40 text-muted-foreground mt-6 border-t pt-4 text-[11px]">
          <p className="flex items-center justify-center gap-1.5">
            <GraduationCap className="text-primary size-3.5" />
            Axis Institute of Technology &amp; Management
          </p>
        </div>
      </div>
    </div>
  );
}
