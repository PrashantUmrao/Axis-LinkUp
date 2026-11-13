import React from 'react';
import type { Metadata } from 'next';
import { SignOutButton } from '@clerk/nextjs';
import { AlertOctagon, Mail, Building2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Account Suspended | Axis LinkUp',
  description: 'Your account has been placed on administrative hold.',
};

export default function AccountSuspendedPage() {
  return (
    <div className="glass-card border-border/40 flex flex-col items-center justify-center space-y-5 p-6 text-center shadow-xl sm:p-8">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-500 shadow-md">
        <AlertOctagon className="size-8" />
      </div>

      <div className="space-y-2">
        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight">
          Account Under Administrative Hold
        </h1>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Your Axis LinkUp account has been temporarily suspended by the Office of the Dean of
          Academic Affairs or Campus IT Administration. Access to collegiate services is restricted.
        </p>
      </div>

      <div className="border-border/40 bg-muted/20 text-muted-foreground w-full rounded-xl border p-4 text-left text-xs shadow-xs">
        <h2 className="font-heading text-foreground mb-2 text-xs font-semibold">
          Required Resolution Actions:
        </h2>
        <ul className="space-y-2.5">
          <li className="flex items-start gap-2">
            <Building2 className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span>Visit the Campus Administration Block (Room 102, Main Academic Building).</span>
          </li>
          <li className="flex items-start gap-2">
            <Mail className="mt-0.5 size-4 shrink-0 text-cyan-500" />
            <span>
              Contact Academic Inquiries at{' '}
              <a
                href="mailto:registrar@axiscolleges.in"
                className="text-primary underline hover:opacity-80"
              >
                registrar@axiscolleges.in
              </a>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Mail className="mt-0.5 size-4 shrink-0 text-indigo-500" />
            <span>
              Campus IT Helpdesk at{' '}
              <a
                href="mailto:it-support@axiscolleges.in"
                className="text-primary underline hover:opacity-80"
              >
                it-support@axiscolleges.in
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
