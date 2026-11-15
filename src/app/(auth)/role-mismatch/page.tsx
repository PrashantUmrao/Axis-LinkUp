import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import { ShieldAlert, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { getRoleDashboard } from '@/lib/auth/routing';

export const metadata: Metadata = {
  title: 'Portal Clearance Mismatch | Axis LinkUp',
  description: 'Your collegiate role does not match the selected ingress portal door.',
};

export const dynamic = 'force-dynamic';

interface RoleMismatchPageProps {
  searchParams: Promise<{
    expected?: string;
    actual?: string;
    portal?: string;
  }>;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  student: 'Enrolled Student',
  faculty: 'Faculty Member',
  admin: 'Department / Academic Administrator',
  super_admin: 'System Administrator',
};

const PORTAL_DISPLAY_NAMES: Record<string, string> = {
  student: 'Student Portal',
  faculty: 'Faculty Workspace',
  admin: 'Administration Console',
};

export default async function RoleMismatchPage({ searchParams }: RoleMismatchPageProps) {
  const { expected, actual, portal } = await searchParams;

  const actualRoleDisplay =
    (actual && ROLE_DISPLAY_NAMES[actual]) || (actual ? actual.toUpperCase() : 'Collegiate Member');
  const targetPortalDisplay =
    (portal && PORTAL_DISPLAY_NAMES[portal]) ||
    (expected && PORTAL_DISPLAY_NAMES[expected]) ||
    'Selected Portal';

  const authorizedDashboard = getRoleDashboard(actual);

  return (
    <div className="glass-card border-glass-border mx-auto flex w-full max-w-lg flex-col items-center justify-center space-y-6 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8">
      {/* Visual Alert Badge */}
      <div className="flex size-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-md">
        <ShieldAlert className="size-8" />
      </div>

      {/* Main Copy */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          CLEARANCE MISMATCH • ACCESS RESTRICTED
        </div>
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight">
          Role-to-Portal Mismatch Detected
        </h1>
        <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
          You authenticated as an{' '}
          <strong className="text-foreground font-semibold">{actualRoleDisplay}</strong>, but you
          attempted to enter via the{' '}
          <strong className="text-foreground font-semibold">{targetPortalDisplay}</strong> door.
        </p>
      </div>

      {/* Collegiate Policy Card */}
      <div className="border-border/40 bg-muted/20 text-muted-foreground w-full rounded-xl border p-4 text-left text-xs shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <CheckCircle2 className="size-4 text-primary" />
          <span>Zero-Trust Persona Separation Policy</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Axis LinkUp strictly enforces collegiate boundary isolation. Accounts provisioned for
          students cannot authenticate into the Faculty Workspace or Administration Console, and
          vice-versa.
        </p>
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col gap-3 pt-2">
        {/* Action 1: Proceed to Authorized Dashboard */}
        <Button asChild variant="pill-primary" className="w-full h-10 text-xs font-semibold shadow-md shadow-primary/20">
          <Link href={authorizedDashboard}>
            <span>Continue to Your Authorized Dashboard</span>
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>

        {/* Action 2: Sign Out & Re-Authenticate */}
        <SignOutButton redirectUrl={`/sign-in${portal ? `?portal=${encodeURIComponent(portal)}` : ''}`}>
          <Button variant="outline" className="w-full h-10 text-xs">
            <LogOut className="mr-2 size-4" />
            <span>Sign Out &amp; Use a Different Account</span>
          </Button>
        </SignOutButton>
      </div>

      {/* Return to Portal Selection */}
      <div className="pt-2">
        <Link
          href="/sign-in"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          ← Return to Portal Door Selection
        </Link>
      </div>
    </div>
  );
}

