import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import {
  FacultyWelcomeBanner,
  FacultyMetricsOverview,
  FacultyTeachingModules,
  FacultyClassRoster,
  FacultyAssignmentManagement,
  FacultyAcademicGroupsCard,
  FacultyStudentOverview,
  FacultyNoticeSection,
  FacultyPollSection,
  FacultyQuickActions,
  FacultyRecentActivity,
} from './components';
import { ConcentricProgress } from '@/components/dashboard/concentric-progress';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import type { UserDTO } from '@/types/user';
import { ShieldCheck, Building2, Activity } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Faculty Dashboard | Axis LinkUp',
  description:
    'Academic evaluation cockpit, course sections, and instructional management dashboard.',
};

export default async function FacultyDashboardPage() {
  // 1. Tier-2 Server Component Role Ingress Gate
  const session = await requireRole(['faculty', 'super_admin']);

  // 2. Fetch authoritative user document from MongoDB Atlas
  let userDTO: UserDTO;
  try {
    const userDoc =
      (await UserRepository.findById(session.userId)) ||
      (session.authProviderId
        ? await UserRepository.findByAuthProviderId(session.authProviderId)
        : null);

    if (userDoc) {
      userDTO = toUserDTO(userDoc);
    } else {
      // Safe fallback if webhook synchronization is still pending
      userDTO = {
        id: session.userId,
        email: session.email,
        fullName:
          session.fullName ||
          (session.email ? session.email.split('@')[0] : '') ||
          'Faculty Member',
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
    // Database connection fallback
    userDTO = {
      id: session.userId,
      email: session.email,
      fullName:
        session.fullName || (session.email ? session.email.split('@')[0] : '') || 'Faculty Member',
      role: session.role,
      status: session.status || 'active',
      isProfileComplete: false,
      departmentId: session.departmentId ?? null,
      avatarUrl: session.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      {/* 1. Welcome Hero Section */}
      <FacultyWelcomeBanner user={userDTO} />

      {/* 2. Overview Metrics Grid (Reference 2 KPI Row) */}
      <FacultyMetricsOverview user={userDTO} />

      {/* 3. Main Dashboard Grid (2/3 Main Canvas + 1/3 Right Rail) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Teaching Modules, Roster, Assignments, Groups, Notices */}
        <div className="space-y-6 lg:col-span-2">
          {/* Active Teaching Allocations (Reference 2 Project Cards) */}
          <FacultyTeachingModules />

          {/* Class & Subject Roster */}
          <FacultyClassRoster />

          {/* Assignment Management & Gradebook */}
          <FacultyAssignmentManagement />

          {/* Moderated Academic Communication Groups */}
          <FacultyAcademicGroupsCard />

          {/* Department Notices & Circulars */}
          <FacultyNoticeSection user={userDTO} />

          {/* Classroom Polls & Student Sentiment */}
          <FacultyPollSection user={userDTO} />

          {/* Quick Actions Shortcuts */}
          <FacultyQuickActions />
        </div>

        {/* Right Column (1 Col): Syllabus Gauge, Student Overview, Activity */}
        <div className="space-y-6">
          {/* Concentric Progress Gauge Card (Reference 2 Signature Ring) */}
          <Card variant="glass" className="border-glass-border space-y-4 border p-5">
            <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="text-primary size-4" />
                <CardTitle className="font-heading text-foreground text-sm font-semibold">
                  Instructional Coverage
                </CardTitle>
              </div>
              <Badge variant="glass" className="text-[10px]">
                Session 2026
              </Badge>
            </CardHeader>

            <CardContent className="flex flex-col items-center p-0 pt-2">
              <ConcentricProgress
                rings={[
                  {
                    label: 'Syllabus Taught',
                    value: 82.0,
                    color: '#2563eb', // Royal blue
                  },
                  {
                    label: 'Evaluations Met',
                    value: 94.0,
                    color: '#10b981', // Emerald green
                  },
                ]}
                centerValue="82.0%"
                centerLabel="Syllabus"
                size={150}
                strokeWidth={10}
              />

              <div className="border-border/30 mt-4 grid w-full grid-cols-2 gap-2 border-t pt-3 text-center text-xs">
                <div className="bg-card/40 border-glass-border rounded-lg border p-2">
                  <div className="text-muted-foreground text-[10px] uppercase">Mid-Term SLA</div>
                  <div className="font-mono text-xs font-semibold text-emerald-500">
                    On Schedule
                  </div>
                </div>
                <div className="bg-card/40 border-glass-border rounded-lg border p-2">
                  <div className="text-muted-foreground text-[10px] uppercase">Graded Tasks</div>
                  <div className="text-foreground font-mono text-xs font-semibold">128 Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enrolled Students & Cohort Overview */}
          <FacultyStudentOverview />

          {/* Recent Telemetry & Security Activity */}
          <FacultyRecentActivity user={userDTO} />

          {/* Departmental Governance Boundary Card */}
          <Card variant="glass" className="border-glass-border space-y-3 border p-5 shadow-sm">
            <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-emerald-500" />
                <CardTitle className="text-xs font-semibold">Departmental Governance</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                AITM Academic Council
              </Badge>
            </CardHeader>

            <CardContent className="text-muted-foreground space-y-2 p-0 text-xs leading-relaxed">
              <div className="flex items-center justify-between">
                <span>Faculty Role:</span>
                <span className="text-foreground font-medium capitalize">{userDTO.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Access Scope:</span>
                <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-500">
                  <ShieldCheck className="size-3" />
                  ABAC Instructor Scope (OWN)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Authorization Gate:</span>
                <span className="text-foreground font-mono text-[11px]">DOC-AUTH-005 Matrix</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ContentContainer>
  );
}
