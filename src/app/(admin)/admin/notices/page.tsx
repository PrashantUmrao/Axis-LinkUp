import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { AdminNoticeManagement } from '../dashboard/components';

export const metadata: Metadata = {
  title: 'College Circulars | Axis LinkUp',
  description:
    'Institution-wide official notices, emergency sirens, and departmental circular desks.',
};

export default async function AdminNoticesPage() {
  const session = await requireRole(['admin', 'super_admin']);

  const activeScope =
    session.adminSubRole === 'director'
      ? 'director'
      : session.adminSubRole === 'hod'
        ? 'hod'
        : 'sys_admin';

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <AdminNoticeManagement activeScope={activeScope} />
    </ContentContainer>
  );
}

