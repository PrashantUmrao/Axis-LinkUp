import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { FacultyPollSection } from '../dashboard/components';

export const metadata: Metadata = {
  title: 'Course Polls | Axis LinkUp',
  description: 'Classroom surveys, interactive polls, and student feedback voting.',
};

export default async function FacultyPollsPage() {
  const session = await requireRole(['faculty', 'super_admin']);

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <FacultyPollSection
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

