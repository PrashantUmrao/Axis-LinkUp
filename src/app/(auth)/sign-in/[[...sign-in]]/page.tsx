'use client';

/**
 * Three-Door Role Ingress & Authentication Experience.
 * Seamlessly transitions between the Three-Door Portal Selector and the Role-Specific Login Experience.
 * Enforces zero-trust role-vs-portal verification via Clerk provider integration.
 */

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { RoleSelector, type PortalType } from '@/components/auth/role-selector';
import { RoleLoginForm } from '@/components/auth/role-login-form';
import { LoadingState } from '@/components/ui/loading-state';

function SignInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const portalParam = searchParams.get('portal') as PortalType | null;
  const redirectUrl = searchParams.get('redirect_url') || undefined;

  const isValidPortal =
    portalParam === 'student' || portalParam === 'faculty' || portalParam === 'admin';

  if (!isValidPortal) {
    return (
      <div className="mx-auto w-full max-w-4xl py-4">
        <RoleSelector
          isStandalonePage
          onSelectPortal={(selected) => {
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
        portal={portalParam}
        onChangePortal={() => {
          router.push(
            `/sign-in${redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ''}`
          );
        }}
        redirectUrl={redirectUrl}
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
