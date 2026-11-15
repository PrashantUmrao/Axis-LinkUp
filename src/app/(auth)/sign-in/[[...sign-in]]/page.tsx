'use client';

/**
 * Three-Door Role Ingress & Authentication Experience.
 * Seamlessly transitions between the Three-Door Portal Selector and the Role-Specific Login Experience.
 * Enforces zero-trust role-vs-portal verification via Clerk provider integration.
 */

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';
import { ShieldAlert, UserX, ArrowLeft, LogOut, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui';
import { RoleSelector, type PortalType } from '@/components/auth/role-selector';
import { RoleLoginForm } from '@/components/auth/role-login-form';
import { LoadingState } from '@/components/ui/loading-state';

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const portalParam = searchParams.get('portal') as PortalType | null;
  const redirectUrl = searchParams.get('redirect_url') || undefined;
  const errorParam = searchParams.get('error');
  const actualParam = searchParams.get('actual');

  // Persist portal across Clerk sub-path navigation steps (e.g. /sign-in/factor-one)
  const [cookiePortal, setCookiePortal] = React.useState<PortalType | null>(null);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)axis_selected_portal=([^;]+)/);
      if (match && (match[1] === 'student' || match[1] === 'faculty' || match[1] === 'admin')) {
        setCookiePortal(match[1] as PortalType);
      }
    }
  }, []);

  React.useEffect(() => {
    if (errorParam === 'not_provisioned' || errorParam === 'inactive_account') {
      if (typeof document !== 'undefined') {
        document.cookie = 'axis_selected_portal=; path=/; max-age=0; SameSite=Lax';
      }
      setCookiePortal(null);
    } else if (portalParam && (portalParam === 'student' || portalParam === 'faculty' || portalParam === 'admin')) {
      document.cookie = `axis_selected_portal=${portalParam}; path=/; max-age=3600; SameSite=Lax`;
      setCookiePortal(portalParam);
    }
  }, [portalParam, errorParam]);

  // CRITICAL LOOP BREAKER: If user is authenticated in Clerk but not provisioned in MongoDB,
  // DO NOT mount Clerk's <SignIn> component (which triggers client-side auto-redirect to forceRedirectUrl).
  // Instead, render a stable terminal card with a Clerk SignOutButton to cleanly reset session.
  if (errorParam === 'not_provisioned' || errorParam === 'inactive_account') {
    const isInactive = errorParam === 'inactive_account';
    return (
      <div className="mx-auto w-full max-w-md py-6">
        <div className="glass-card border-glass-border space-y-6 border p-6 text-center shadow-xl backdrop-blur-xl sm:p-8">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-md">
            {isInactive ? <ShieldAlert className="size-7" /> : <UserX className="size-7" />}
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-0.5 text-[11px] font-semibold text-amber-500">
              {isInactive ? 'ACCOUNT INACTIVE' : 'CLOSED ACCESS POLICY • NOT PROVISIONED'}
            </div>
            <h1 className="font-heading text-foreground text-xl font-bold tracking-tight sm:text-2xl">
              {isInactive ? 'Account Status Inactive' : 'Collegiate Account Not Found'}
            </h1>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {isInactive
                ? 'Your collegiate account is inactive or has been archived. Please contact the Office of Academic Affairs to restore access.'
                : 'This signed-in account is not registered in the Axis LinkUp institutional database. Access is strictly restricted to administrator-provisioned students, faculty, and administrative staff.'}
            </p>
          </div>

          <div className="border-border/40 bg-muted/20 text-muted-foreground rounded-xl border p-4 text-left text-xs space-y-1.5 shadow-xs">
            <p className="font-medium text-foreground text-[11px]">Authorized Recovery:</p>
            <p className="text-[11px] leading-relaxed">
              • To access your dashboard, sign out of this account and sign in with your provisioned institutional credentials.
            </p>
            <p className="text-[11px] leading-relaxed">
              • If you received an account activation key from campus administration, complete your setup via Account Activation.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <SignOutButton redirectUrl="/sign-in">
              <Button variant="pill-primary" className="w-full text-xs">
                <LogOut className="mr-2 size-3.5" />
                Sign Out &amp; Use Authorized Account
              </Button>
            </SignOutButton>

            <Button asChild variant="outline" className="w-full text-xs">
              <Link href="/">
                <ArrowLeft className="mr-2 size-3.5" />
                Return to Campus Home
              </Link>
            </Button>
          </div>

          <div className="border-border/40 border-t pt-3 text-center">
            <Link
              href="/activate"
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs font-medium hover:underline transition-colors"
            >
              <KeyRound className="size-3.5" />
              <span>Have an activation code? Activate Account</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activePortal = portalParam || cookiePortal;

  let errorMessage: string | undefined = undefined;
  if (errorParam === 'role_mismatch') {
    errorMessage = `Clearance Mismatch: Your authenticated credentials belong to a different collegiate persona${
      actualParam ? ` (${actualParam.toUpperCase()})` : ''
    }. Please sign in with authorized credentials for this portal.`;
  } else if (errorParam === 'not_provisioned') {
    errorMessage =
      'Closed Access Policy: This account is not provisioned in the campus database. Please contact campus administration.';
  } else if (errorParam === 'inactive_account') {
    errorMessage =
      'Account Inactive: Your collegiate account is inactive or has been archived. Please contact Academic Affairs.';
  }

  const isValidPortal =
    activePortal === 'student' || activePortal === 'faculty' || activePortal === 'admin';

  if (!isValidPortal) {
    return (
      <div className="mx-auto w-full max-w-4xl py-4 space-y-4">
        {errorMessage && (
          <div className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center text-xs text-destructive">
            {errorMessage}
          </div>
        )}
        <RoleSelector
          isStandalonePage
          onSelectPortal={(selected) => {
            document.cookie = `axis_selected_portal=${selected}; path=/; max-age=3600; SameSite=Lax`;
            setCookiePortal(selected);
            router.push(
              `/sign-in?portal=${selected}${redirectUrl ? `&redirect_url=${encodeURIComponent(redirectUrl)}` : ''}`
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md py-2">
      <RoleLoginForm
        portal={activePortal}
        onChangePortal={() => {
          document.cookie = 'axis_selected_portal=; path=/; max-age=0; SameSite=Lax';
          setCookiePortal(null);
          router.push(
            `/sign-in${redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ''}`
          );
        }}
        redirectUrl={redirectUrl}
        errorMessage={errorMessage}
      />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <LoadingState message="Loading Institutional Ingress..." glass />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
