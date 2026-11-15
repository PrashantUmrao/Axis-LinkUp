import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import {
  StudentWelcomeBanner,
  StudentMetricsOverview,
  StudentCourseModules,
  StudentAssignmentOverview,
  StudentGrievancePortalCard,
  StudentNoticeFeed,
  StudentPollSection,
  StudentAcademicCalendar,
  StudentFacultyMentors,
  StudentQuickActions,
  StudentRecentActivity,
} from './components';
import { ConcentricProgress } from '@/components/dashboard/concentric-progress';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import type { UserDTO } from '@/types/user';
import { ShieldCheck, School, Activity } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Student Dashboard | Axis LinkUp',
  description: 'Personalized student academic workspace, notices, and coursework dropboxes.',
};

export default async function StudentDashboardPage() {
  // 1. Tier-2 Server Component Role Ingress Gate
  const session = await requireRole(['student', 'super_admin']);

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
          session.fullName || (session.email ? session.email.split('@')[0] : '') || 'Student',
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
      fullName: session.fullName || (session.email ? session.email.split('@')[0] : '') || 'Student',
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
      {/* 1. Welcome Section */}
      <StudentWelcomeBanner user={userDTO} />

      {/* 2. Overview Metrics Cards (Reference 2 KPI Row) */}
      <StudentMetricsOverview user={userDTO} />

      {/* 3. Main Dashboard Grid (2/3 Main Canvas + 1/3 Side Rail) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Enrolled Modules, Coursework, Grievance Portal, Notices */}
        <div className="space-y-6 lg:col-span-2">
          {/* Enrolled Course Modules (Reference 2: Project Cards) */}
          <StudentCourseModules />

          {/* Assignment Overview Section */}
          <StudentAssignmentOverview />

          {/* Statutory Grievance Redressal Desk (AICTE/UGC) */}
          <StudentGrievancePortalCard />

          {/* College Notices Section */}
          <StudentNoticeFeed />

          {/* Interactive Campus Polls & Sentiment Section */}
          <StudentPollSection />

          {/* Quick Actions Area */}
          <StudentQuickActions />
        </div>

        {/* Right Column (1 Col): Progress Ring, Mentors Rail, Calendar, Recent Activity */}
        <div className="space-y-6">
          {/* Concentric Progress Gauge (Reference 2 Signature Ring) */}
          <Card variant="glass" className="border-glass-border space-y-4 border p-5">
            <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="text-primary size-4" />
                <CardTitle className="font-heading text-foreground text-sm font-semibold">
                  Academic Progress
                </CardTitle>
              </div>
              <Badge variant="glass" className="text-[10px]">
                Semester 6
              </Badge>
            </CardHeader>

            <CardContent className="flex flex-col items-center p-0 pt-2">
              <ConcentricProgress
                rings={[
                  {
                    label: 'Attendance',
                    value: 84.5,
                    color: '#2563eb', // Royal blue
                  },
                  {
                    label: 'Syllabus',
                    value: 78.0,
                    color: '#0284c7', // Sky cyan
                  },
                ]}
                centerValue="84.5%"
                centerLabel="Attendance"
                size={150}
                strokeWidth={10}
              />

              <div className="border-border/30 mt-4 grid w-full grid-cols-2 gap-2 border-t pt-3 text-center text-xs">
                <div className="bg-card/40 border-glass-border rounded-lg border p-2">
                  <div className="text-muted-foreground text-[10px] uppercase">Eligible Status</div>
                  <div className="font-mono text-xs font-semibold text-emerald-500">Cleared</div>
                </div>
                <div className="bg-card/40 border-glass-border rounded-lg border p-2">
                  <div className="text-muted-foreground text-[10px] uppercase">Min Criteria</div>
                  <div className="text-foreground font-mono text-xs font-semibold">75.0%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Faculty Mentors & Advisors (Reference 2: Team Member Rail) */}
          <StudentFacultyMentors />

          {/* Academic Calendar Widget */}
          <StudentAcademicCalendar />

          {/* Recent Activity Timeline */}
          <StudentRecentActivity user={userDTO} />

          {/* Institutional IAM Card */}
          <Card variant="glass" className="border-glass-border space-y-3 border p-5 shadow-sm">
            <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-2">
              <div className="flex items-center gap-2">
                <School className="text-primary size-4" />
                <CardTitle className="text-xs font-semibold">Institutional Boundary</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                AITM Kanpur
              </Badge>
            </CardHeader>

            <CardContent className="text-muted-foreground space-y-2 p-0 text-xs leading-relaxed">
              <div className="flex items-center justify-between">
                <span>Campus:</span>
                <span className="text-foreground font-medium">
                  Axis Institute of Technology &amp; Management
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Security Gate:</span>
                <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-500">
                  <ShieldCheck className="size-3" />
                  RBAC Tier-2 Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Account Status:</span>
                <span className="text-foreground font-medium capitalize">{userDTO.status}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ContentContainer>
  );
}
