import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { AppShell } from '@/components/layouts';
import { getRoleDashboard } from '@/lib/auth/routing';

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tier-2 Server Component Layout Ingress Gate
  const session = await getCurrentSession();

  if (!session) {
    redirect('/sign-in?redirect_url=/admin/dashboard');
  }

  if (session.status === 'suspended') {
    redirect('/account-suspended');
  }

  if (session.status === 'pending_verification') {
    redirect('/pending-approval');
  }

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    redirect(getRoleDashboard(session.role, session.adminSubRole));
  }

  return <AppShell user={session}>{children}</AppShell>;
}
