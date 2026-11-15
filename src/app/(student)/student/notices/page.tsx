import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { StudentNoticeFeed } from '../dashboard/components';

export const metadata: Metadata = {
  title: 'Campus Notices | Axis LinkUp',
  description:
    'Official bulletins and departmental circulars dispatched by college administration and department HOD.',
};

export default async function StudentNoticesPage() {
  await requireRole(['student', 'super_admin']);

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <StudentNoticeFeed />
    </ContentContainer>
  );
}

