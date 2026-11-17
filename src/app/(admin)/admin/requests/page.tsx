import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { ServiceRequestService } from '@/lib/services/service-request.service';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { AdminRequestsQueueView } from '@/components/requests';
import type { UserDTO } from '@/types/user';
import type { ServiceRequestDTO, ServiceRequestStatsDTO } from '@/types/service-request';

export const metadata: Metadata = {
  title: 'Administrative Service Queue | Axis LinkUp',
  description: 'Collegiate Student Service Queues, Requisition Approvals, and Digital Clearances.',
};

export default async function AdminRequestsPage() {
  const session = await requireRole(['admin', 'super_admin']);

  let userDTO: UserDTO;
  try {
    const userDoc = await UserRepository.findById(session.userId);
    if (userDoc) {
      userDTO = toUserDTO(userDoc);
    } else {
      userDTO = {
        id: session.userId,
        email: session.email,
        fullName: session.fullName || 'Administrator',
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
      fullName: session.fullName || 'Administrator',
      role: session.role,
      status: session.status || 'active',
      isProfileComplete: false,
      departmentId: session.departmentId ?? null,
      avatarUrl: session.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  let departmentScope: string | undefined;
  if (session.role === 'admin' && session.departmentId) {
    try {
      const deptDoc = await DepartmentRepository.findById(session.departmentId);
      if (deptDoc?.name) {
        departmentScope = deptDoc.name;
      }
    } catch {
      // Fallback
    }
  }

  let initialRequests: ServiceRequestDTO[] = [];
  let initialStats: ServiceRequestStatsDTO | null = null;

  try {
    const [res, statsRes] = await Promise.all([
      ServiceRequestService.listAdminQueue(session, {
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
    console.error('Failed to pre-fetch admin service queue', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <AdminRequestsQueueView
        user={userDTO}
        initialRequests={initialRequests}
        initialStats={initialStats}
        departmentScope={departmentScope}
      />
    </ContentContainer>
  );
}

