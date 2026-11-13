import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { AppShell } from '@/components/layouts';

export default async function SuperAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tier-2 Server Component Layout Ingress Gate (Strict Super Admin Only)
  const session = await getCurrentSession();

  if (!session) {
    redirect('/sign-in?redirect_url=/super-admin/dashboard');
  }

  if (session.status === 'suspended') {
    redirect('/account-suspended');
  }

  if (session.status === 'pending_verification') {
    redirect('/pending-approval');
  }

  if (session.role !== 'super_admin') {
    redirect('/unauthorized');
  }

  return <AppShell user={session}>{children}</AppShell>;
}
