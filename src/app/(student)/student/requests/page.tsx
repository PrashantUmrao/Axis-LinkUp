import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { ServiceRequestService } from '@/lib/services/service-request.service';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { StudentRequestsView } from '@/components/requests';
import type { UserDTO } from '@/types/user';
import type { ServiceRequestDTO, ServiceRequestStatsDTO } from '@/types/service-request';

export const metadata: Metadata = {
  title: 'Service Request Tracker | Axis LinkUp',
  description: 'Collegiate Student Requisitions, Leave Applications, and Administrative Service Tracking.',
};

export default async function StudentRequestsPage() {
  const session = await requireRole(['student', 'super_admin']);

  let userDTO: UserDTO;
  try {
    const userDoc = await UserRepository.findById(session.userId);
    if (userDoc) {
      userDTO = toUserDTO(userDoc);
    } else {
      userDTO = {
        id: session.userId,
        email: session.email,
        fullName: session.fullName || 'Student Applicant',
        role: session.role,
        status: session.status || 'active',
        isProfileComplete: false,
        departmentId: session.departmentId ?? null,
        avatarUrl: session.avatarUrl ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  } catch {
    userDTO = {
      id: session.userId,
      email: session.email,
      fullName: session.fullName || 'Student Applicant',
      role: session.role,
      status: session.status || 'active',
      isProfileComplete: false,
      departmentId: session.departmentId ?? null,
      avatarUrl: session.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  let initialRequests: ServiceRequestDTO[] = [];
  let initialStats: ServiceRequestStatsDTO | null = null;

  try {
    const [res, statsRes] = await Promise.all([
      ServiceRequestService.listStudentRequests(session, {
        page: 1,
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
      ServiceRequestService.getRequestStats(session),
    ]);

    initialRequests = res.requests;
    initialStats = statsRes;
  } catch (err) {
    console.error('Failed to pre-fetch student service requests', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <StudentRequestsView
        user={userDTO}
        initialRequests={initialRequests}
        initialStats={initialStats}
      />
    </ContentContainer>
  );
}

