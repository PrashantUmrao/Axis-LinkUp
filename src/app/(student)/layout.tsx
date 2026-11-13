import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import { AppShell } from '@/components/layouts';

export default async function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tier-2 Server Component Layout Ingress Gate
  const session = await getCurrentSession();

  if (!session) {
    redirect('/sign-in?redirect_url=/student/dashboard');
  }

  if (session.status === 'suspended') {
    redirect('/account-suspended');
  }

  if (session.status === 'pending_verification') {
    redirect('/pending-approval');
  }

  if (session.role !== 'student' && session.role !== 'super_admin') {
    redirect('/unauthorized');
  }

  return <AppShell user={session}>{children}</AppShell>;
}
