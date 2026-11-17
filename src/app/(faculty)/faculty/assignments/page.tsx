import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { AssignmentService } from '@/lib/services/assignment.service';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import { FacultyAssignmentView } from '@/components/assignments';
import type { UserDTO } from '@/types/user';
import type { AssignmentDTO } from '@/types/assignment';

export const metadata: Metadata = {
  title: 'Coursework & Gradebook | Axis LinkUp',
  description: 'Faculty coursework authoring, submission inspections, and grading verification.',
};

export default async function FacultyAssignmentsPage() {
  const session = await requireRole(['faculty', 'admin', 'super_admin']);

  let userDTO: UserDTO;
  let assignedCourses: string[] = [];
  let departmentName = 'Academic Department';

  try {
    const userDoc = await UserRepository.findById(session.userId);
    if (userDoc) {
      userDTO = toUserDTO(userDoc);
      if (userDoc.facultyProfile?.assignedCourses) {
        assignedCourses = userDoc.facultyProfile.assignedCourses.map((c) => String(c));
      }
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

  if (session.departmentId) {
    try {
      const deptDoc = await DepartmentRepository.findById(session.departmentId);
      if (deptDoc?.name) {
        departmentName = deptDoc.name;
      }
    } catch {
      // Graceful fallback
    }
  }

  // Pre-fetch live assignments for this instructor/department
  let initialAssignments: AssignmentDTO[] = [];
  try {
    const result = await AssignmentService.getAssignments(session, {
      limit: 100,
    });
    initialAssignments = result.assignments;
  } catch (err) {
    console.error('Failed to pre-fetch faculty assignments:', err);
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      <FacultyAssignmentView
        user={userDTO}
        assignedCourses={assignedCourses}
        initialAssignments={initialAssignments}
        departmentName={departmentName}
      />
    </ContentContainer>
  );
}
