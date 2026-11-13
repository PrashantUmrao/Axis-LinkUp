import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldAlert, ArrowRight, ArrowLeft, Mail, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Public Registration Closed | Axis LinkUp',
  description:
    'Self-service account registration is permanently closed. Accounts are provisioned exclusively through authorized administration workflows.',
};

export default function SignUpPage() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-6 py-4">
      {/* Header Badge & Title */}
      <div className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-500">
          <ShieldAlert className="size-4" />
          <span>Closed Institutional Access Policy</span>
        </div>

        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          Public Registration Closed
        </h1>

        <p className="text-muted-foreground mx-auto max-w-sm text-xs leading-relaxed sm:text-sm">
          Self-service account creation has been permanently retired in accordance with Axis
          Institute of Technology &amp; Management security policies.
        </p>
      </div>

      {/* Main Glass Informational Card */}
      <div className="glass-card border-glass-border space-y-6 border p-6 text-left shadow-xl backdrop-blur-xl sm:p-8">
        <div className="space-y-3">
          <h2 className="font-heading text-foreground text-sm font-semibold">
            How to Obtain Collegiate Access
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            All Axis LinkUp accounts for students, instructional faculty, and department
            administrators are provisioned through verified institutional channels.
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="bg-muted/30 border-border/40 flex items-start gap-3 rounded-xl border p-3.5">
            <Building2 className="text-primary mt-0.5 size-4 shrink-0" />
            <div className="space-y-0.5 text-xs">
              <span className="text-foreground font-semibold">Enrolled Students:</span>
              <p className="text-muted-foreground">
                Your credentials are created automatically upon semester enrollment verification.
                Contact your Department Registrar or HOD office to collect your activation link.
              </p>
            </div>
          </div>

          <div className="bg-muted/30 border-border/40 flex items-start gap-3 rounded-xl border p-3.5">
            <Mail className="text-primary mt-0.5 size-4 shrink-0" />
            <div className="space-y-0.5 text-xs">
              <span className="text-foreground font-semibold">Faculty &amp; Staff:</span>
              <p className="text-muted-foreground">
                Accounts are provisioned by the Office of Academic Affairs. Invitations with initial
                credentials are sent directly to your registered institutional email.
              </p>
            </div>
          </div>
        </div>

        {/* Ingress Actions */}
        <div className="space-y-3 pt-2">
          <Button
            asChild
            variant="pill-primary"
            className="h-10 w-full gap-2 text-xs font-semibold"
          >
            <Link href="/sign-in">
              <span>Proceed to Portal Sign In</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-10 w-full gap-2 text-xs">
            <Link href="/">
              <ArrowLeft className="size-3.5" />
              <span>Return to Campus Home</span>
            </Link>
          </Button>
        </div>

        <div className="border-border/40 border-t pt-4 text-center">
          <p className="text-muted-foreground text-[11px]">
            Emergency IT Support:{' '}
            <a
              href="mailto:it-support@axis.edu.in"
              className="text-primary font-medium hover:underline"
            >
              it-support@axis.edu.in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
