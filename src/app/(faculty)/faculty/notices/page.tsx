import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { FacultyNoticeSection } from '../dashboard/components';

export const metadata: Metadata = {
  title: 'Course Notices | Axis LinkUp',
  description:
    'Departmental bulletins, collegiate circulars, and course-level broadcast channels.',
};

export default async function FacultyNoticesPage() {
  const session = await requireRole(['faculty', 'super_admin']);

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <FacultyNoticeSection
        user={{
          id: session.userId,
          role: session.role,
          departmentId: session.departmentId,
          adminSubRole: session.adminSubRole,
        }}
      />
    </ContentContainer>
  );
}

