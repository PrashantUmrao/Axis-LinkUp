import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { FacilityService } from '@/lib/services/facility.service';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { FacultySpacesView } from '@/components/facilities';
import type { UserDTO } from '@/types/user';
import type { FacilityDTO, FacilityBookingDTO } from '@/types/facility';

export const metadata: Metadata = {
  title: 'Campus Spaces & Reservations | Axis LinkUp',
  description:
    'Discover Axis Colleges laboratories, auditoriums, and seminar rooms and submit time-slot reservations.',
};

export default async function FacultySpacesPage() {
  const session = await requireRole(['faculty', 'admin', 'super_admin']);

  let userDTO: UserDTO;
  try {
    const userDoc = await UserRepository.findById(session.userId);
    if (userDoc) {
      userDTO = toUserDTO(userDoc);
    } else {
      userDTO = {
        id: session.userId,
        email: session.email,
        fullName: session.fullName || 'Faculty Member',
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
      fullName: session.fullName || 'Faculty Member',
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

  try {
    const [facRes, bkgRes] = await Promise.all([
      FacilityService.listFacilities(session, { page: 1, limit: 100 }),
      FacilityService.listBookings(session, { page: 1, limit: 100, scope: 'mine' }),
    ]);

    initialFacilities = facRes.facilities;
    initialBookings = bkgRes.bookings;
  } catch (err) {
    console.error('Failed to pre-fetch faculty spaces workspace', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <FacultySpacesView
        user={userDTO}
        initialFacilities={initialFacilities}
        initialBookings={initialBookings}
      />
    </ContentContainer>
  );
}
