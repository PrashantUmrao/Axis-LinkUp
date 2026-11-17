import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { FacilityService } from '@/lib/services/facility.service';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { AdminSpacesView } from '@/components/facilities';
import type { UserDTO } from '@/types/user';
import type {
  FacilityDTO,
  FacilityBookingDTO,
  FacilityStatsDTO,
} from '@/types/facility';

export const metadata: Metadata = {
  title: 'Facility Bookings & Campus Spaces | Axis LinkUp',
  description:
    'Manage Axis Colleges campus spaces, computing laboratories, seminar halls, and space booking approvals.',
};

export default async function AdminSpacesPage() {
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

  let initialFacilities: FacilityDTO[] = [];
  let initialBookings: FacilityBookingDTO[] = [];
  let initialStats: FacilityStatsDTO | null = null;

  try {
    const [facRes, bkgRes, statsRes] = await Promise.all([
      FacilityService.listFacilities(session, { page: 1, limit: 100 }),
      FacilityService.listBookings(session, { page: 1, limit: 100 }),
      FacilityService.getBookingStats(session),
    ]);

    initialFacilities = facRes.facilities;
    initialBookings = bkgRes.bookings;
    initialStats = statsRes;
  } catch (err) {
    console.error('Failed to pre-fetch admin facility bookings console', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <AdminSpacesView
        user={userDTO}
        initialFacilities={initialFacilities}
        initialBookings={initialBookings}
        initialStats={initialStats}
      />
    </ContentContainer>
  );
}
