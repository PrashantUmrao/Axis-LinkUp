import React from 'react';
import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { ProfileService } from '@/lib/services/profile.service';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { ContentContainer } from '@/components/layouts';
import { ProfileClientView } from './components';

export const metadata: Metadata = {
  title: 'Profile & Settings | Axis LinkUp',
  description: 'Manage collegiate identity, contact details, academic cohorts, and privacy preferences.',
};

export default async function UserProfilePage() {
  const session = await requireAuth();

  // Retrieve authoritative owner profile projection
  const ownerProfile = await ProfileService.getOwnProfile(session);

  // If user has administrative or faculty privileges, load active departments for roster filtering
  let departmentsList: Array<{ id: string; name: string; code: string }> = [];
  if (session.role !== 'student') {
    try {
      const activeDepts = await DepartmentRepository.findAllActive();
      departmentsList = activeDepts.map((d) => ({
        id: d._id.toString(),
        name: d.name,
        code: d.code,
      }));
    } catch {
      departmentsList = [];
    }
  }

  return (
    <ContentContainer maxWidth="narrow" className="space-y-6">
      <ProfileClientView
        initialProfile={ownerProfile}
        availableDepartments={departmentsList}
      />
    </ContentContainer>
  );
}
