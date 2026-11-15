import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { ContentContainer } from '@/components/layouts';
import { StudentPollSection } from '../dashboard/components';

export const metadata: Metadata = {
  title: 'Campus Polls & Student Sentiment | Axis LinkUp',
  description: 'Interactive campus voting and student sentiment feedback surveys.',
};

export default async function StudentPollsPage() {
  await requireRole(['student', 'super_admin']);

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <StudentPollSection />
    </ContentContainer>
  );
}

