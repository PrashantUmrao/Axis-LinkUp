import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import { ShieldAlert, ArrowLeft, LogOut, Home } from 'lucide-react';
import { Button } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getRoleDashboard } from '@/lib/auth/routing';

export const metadata: Metadata = {
  title: 'Access Restricted | Axis LinkUp',
  description: 'You do not have permission to access the requested resource.',
};

export default async function UnauthorizedPage() {
  const session = await getCurrentSession();
  const dashboardHref =
    session && session.status === 'active'
      ? getRoleDashboard(session.role, session.adminSubRole)
      : '/';
  const dashboardLabel =
    session && session.status === 'active'
      ? 'Return to Authorized Dashboard'
      : 'Return to Campus Home';

  return (
    <div className="glass-card border-border/40 flex flex-col items-center justify-center space-y-5 p-6 text-center shadow-xl sm:p-8">
      {/* Visual Indicator */}
      <div className="flex size-16 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-500 shadow-md">
        <ShieldAlert className="size-8" />
      </div>

      {/* Main Copy */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-0.5 text-[11px] font-semibold text-rose-500">
          HTTP 403 • FORBIDDEN
        </div>
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight">
          Access Clearance Denied
        </h1>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Your authenticated collegiate account does not possess the requisite clearance or
          departmental permissions to access this requested view.
        </p>
      </div>

      {/* Institutional Explanatory Card */}
      <div className="border-border/40 bg-muted/20 text-muted-foreground w-full rounded-xl border p-4 text-left text-xs shadow-xs">
        <h2 className="font-heading text-foreground mb-2 text-xs font-semibold">
          Security Clearance Policies:
        </h2>
        <ul className="space-y-2 text-[11px] leading-relaxed">
          <li>
            • <strong className="text-foreground">Student Accounts:</strong> Scoped strictly to
            student dashboards, enrolled course notices, and personal academic records.
          </li>
          <li>
            • <strong className="text-foreground">Faculty Accounts:</strong> Scoped to assigned
            instructional course sections and academic grading workflows.
          </li>
          <li>
            • <strong className="text-foreground">Administrative Consoles:</strong> Restricted to
            authorized departmental officers and IT leadership.
          </li>
        </ul>
      </div>

      {/* Ingress Actions */}
      <div className="flex w-full flex-col gap-2.5 pt-2">
        <Button asChild variant="glass-primary" className="w-full text-xs">
          <Link href={dashboardHref}>
            <ArrowLeft className="mr-2 size-4" />
            {dashboardLabel}
          </Link>
        </Button>

        {dashboardHref !== '/' && (
          <Button asChild variant="outline" className="w-full text-xs">
            <Link href="/">
              <Home className="mr-2 size-4" />
              Return to Campus Home
            </Link>
          </Button>
        )}

        <SignOutButton redirectUrl="/sign-in">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground w-full text-xs">
            <LogOut className="mr-2 size-4" />
            Sign In with Different Account
          </Button>
        </SignOutButton>
      </div>
    </div>
  );
}
