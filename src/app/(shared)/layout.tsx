import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { AppShell } from '@/components/layouts';

export default async function SharedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tier-2 Server Component Layout Ingress Gate (Any Authenticated Persona)
  const session = await getCurrentSession();

  if (!session) {
    redirect('/sign-in?redirect_url=/shared/profile');
  }

  if (session.status === 'suspended') {
    redirect('/account-suspended');
  }

  if (session.status === 'pending_verification' || session.status === 'invited') {
    redirect('/pending-approval');
  }

  if (session.status && session.status !== 'active') {
    redirect('/unauthorized');
  }

  return <AppShell user={session}>{children}</AppShell>;
}
