import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { AdminPollManagement } from '../dashboard/components';

export const metadata: Metadata = {
  title: 'Campus Polls & Sentiment | Axis LinkUp',
  description:
    'Campus-wide opinion surveys, student feedback, and institutional voting oversight.',
};

export default async function AdminPollsPage() {
  const session = await requireRole(['admin', 'super_admin']);

  const activeScope =
    session.adminSubRole === 'director'
      ? 'director'
      : session.adminSubRole === 'hod'
        ? 'hod'
        : 'sys_admin';

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <AdminPollManagement activeScope={activeScope} />
    </ContentContainer>
  );
}

