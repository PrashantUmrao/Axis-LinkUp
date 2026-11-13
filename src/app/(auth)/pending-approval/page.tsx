import React from 'react';
import type { Metadata } from 'next';
import { SignOutButton } from '@clerk/nextjs';
import { Clock, CheckCircle2, Mail, LogOut } from 'lucide-react';
import { Button } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Verification In Progress | Axis LinkUp',
  description: 'Your account is currently being verified against official registrar records.',
};

export default function PendingApprovalPage() {
  return (
    <div className="glass-card border-border/40 flex flex-col items-center justify-center space-y-5 p-6 text-center shadow-xl sm:p-8">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-md">
        <Clock className="size-8 animate-pulse" />
      </div>

      <div className="space-y-2">
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight">
          Verification In Progress
        </h1>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Your account is pending verification against the official Axis Institute admission roster.
          Access to student dashboards will activate automatically once verification completes.
        </p>
      </div>

      <div className="border-border/40 bg-muted/20 text-muted-foreground w-full rounded-xl border p-4 text-left text-xs shadow-xs">
        <h2 className="font-heading text-foreground mb-2 text-xs font-semibold">
          Verification Details:
        </h2>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            <span>Identity and email address confirmed via Clerk security gateway.</span>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span>Cross-referencing university roll number with registrar admissions roster.</span>
          </li>
          <li className="flex items-start gap-2">
            <Mail className="mt-0.5 size-4 shrink-0 text-indigo-500" />
            <span>
              If not approved within 24 hours, contact admissions support at{' '}
              <a
                href="mailto:admissions@axiscolleges.in"
                className="text-primary underline hover:opacity-80"
              >
                admissions@axiscolleges.in
              </a>
            </span>
          </li>
        </ul>
      </div>

      <div className="flex w-full flex-col gap-2 pt-2">
        <SignOutButton redirectUrl="/sign-in">
          <Button variant="outline" className="w-full text-xs">
            <LogOut className="mr-2 size-4" />
            Sign Out of Account
          </Button>
        </SignOutButton>
      </div>
    </div>
  );
}
