import React from 'react';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ServiceRequestService } from '@/lib/services/service-request.service';
import { ContentContainer } from '@/components/layouts';
import {
  AdminWelcomeBanner,
  AdminMetricsOverview,
  AdminWorkspaceView,
  AdminRecentActivity,
  type AdminMetricsCounts,
} from './components';
import { ConcentricProgress } from '@/components/dashboard/concentric-progress';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import type { UserDTO } from '@/types/user';
import { ShieldCheck, Building2, ShieldAlert, Cpu, Activity } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Administrator Workspace | Axis LinkUp',
  description:
    'Departmental administration cockpit, student service requisitions, circulars, and campus directory.',
};

export default async function AdminDashboardPage() {
  // 1. Tier-2 Server Component Role Ingress Gate
  const session = await requireRole(['admin', 'super_admin']);

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
          session.fullName || (session.email ? session.email.split('@')[0] : '') || 'Administrator',
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
        session.fullName || (session.email ? session.email.split('@')[0] : '') || 'Administrator',
      role: session.role,
      status: session.status || 'active',
      isProfileComplete: false,
      departmentId: session.departmentId ?? null,
      avatarUrl: session.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // 3. Query authentic population metrics from MongoDB Atlas
  let counts: AdminMetricsCounts = {
    students: 0,
    faculty: 0,
    admins: 0,
    pendingRequests: 0,
  };

  try {
    const [students, faculty, admins, requestStats] = await Promise.all([
      UserRepository.countByRole('student'),
      UserRepository.countByRole('faculty'),
      UserRepository.countByRole('admin'),
      ServiceRequestService.getRequestStats(session).catch(() => null),
    ]);

    const pendingRequests = requestStats
      ? requestStats.submitted + requestStats.underReview + requestStats.actionRequired
      : 0;

    counts = {
      students,
      faculty,
      admins,
      pendingRequests,
    };
  } catch {
    // Database offline or prerender fallback
    counts = {
      students: 0,
      faculty: 0,
      admins: 0,
      pendingRequests: 0,
    };
  }

  const assignedScopes =
    userDTO.adminProfile?.assignedQueueScopes && userDTO.adminProfile.assignedQueueScopes.length > 0
      ? userDTO.adminProfile.assignedQueueScopes.join(', ')
      : 'Department Clearances & Requisitions';

  return (
    <ContentContainer maxWidth="default" className="space-y-6">
      {/* 1. Welcome Hero Section */}
      <AdminWelcomeBanner user={userDTO} />

      {/* 2. Overview Metrics Grid (Reference 2 KPI Row) */}
      <AdminMetricsOverview counts={counts} />

      {/* 3. Main Dashboard Grid (2/3 Main Canvas + 1/3 Right Rail) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Role-Aware Scope Switcher & Workspace Modules */}
        <div className="space-y-6 lg:col-span-2">
          <AdminWorkspaceView counts={counts} user={userDTO} />
        </div>

        {/* Right Column (1 Col): Infrastructure Health Ring, Telemetry, Governance Card */}
        <div className="space-y-6">
          {/* Concentric Progress Gauge Card (Reference 2 Signature Ring) */}
          <Card variant="glass" className="border-glass-border space-y-4 border p-5">
            <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="text-primary size-4" />
                <CardTitle className="font-heading text-foreground text-sm font-semibold">
                  Governance Metrics
                </CardTitle>
              </div>
              <Badge variant="glass" className="text-[10px]">
                Production Live
              </Badge>
            </CardHeader>

            <CardContent className="flex flex-col items-center p-0 pt-2">
              <ConcentricProgress
                rings={[
                  {
                    label: 'IAM Verification',
                    value: 100.0,
                    color: '#2563eb', // Royal blue
                  },
                  {
                    label: 'Platform Uptime',
                    value: 99.9,
                    color: '#10b981', // Emerald green
                  },
                ]}
                centerValue="99.9%"
                centerLabel="Uptime SLA"
                size={150}
                strokeWidth={10}
              />

              <div className="border-border/30 mt-4 grid w-full grid-cols-2 gap-2 border-t pt-3 text-center text-xs">
                <div className="bg-card/40 border-glass-border rounded-lg border p-2">
                  <div className="text-muted-foreground text-[10px] uppercase">Access Model</div>
                  <div className="font-mono text-xs font-semibold text-emerald-500">Closed IAM</div>
                </div>
                <div className="bg-card/40 border-glass-border rounded-lg border p-2">
                  <div className="text-muted-foreground text-[10px] uppercase">SLA Target</div>
                  <div className="text-foreground font-mono text-xs font-semibold">
                    48h Resolution
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Security & Administrative Activity */}
          <AdminRecentActivity user={userDTO} />

          {/* Departmental Administrative Governance Card */}
          <Card variant="glass" className="border-glass-border space-y-3 border p-5 shadow-sm">
            <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="text-primary size-4" />
                <CardTitle className="text-xs font-semibold">Administrative Governance</CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                AITM Kanpur
              </Badge>
            </CardHeader>

            <CardContent className="text-muted-foreground space-y-2 p-0 text-xs leading-relaxed">
              <div className="flex items-center justify-between">
                <span>Console Role:</span>
                <span className="text-foreground font-medium capitalize">{userDTO.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Assigned Domain:</span>
                <span className="text-foreground font-medium">
                  {userDTO.adminProfile?.administrativeDomain || 'Academic Affairs'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Requisition Scope:</span>
                <span className="text-foreground max-w-[140px] truncate font-medium">
                  {assignedScopes}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Emergency Siren:</span>
                <span className="flex items-center gap-1 font-mono text-[11px] text-amber-500">
                  <ShieldAlert className="size-3" />
                  Super Admin Exclusive
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Authorization Gate:</span>
                <span className="text-foreground font-mono text-[11px]">DOC-AUTH-005 Matrix</span>
              </div>
            </CardContent>
          </Card>

          {/* System Health & Architecture Assurance Card */}
          <Card variant="glass" className="border-glass-border space-y-3 border p-5 shadow-sm">
            <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-sky-500" />
                <CardTitle className="text-xs font-semibold">System Architecture</CardTitle>
              </div>
              <Badge variant="success" className="text-[10px]">
                Operational
              </Badge>
            </CardHeader>

            <CardContent className="text-muted-foreground space-y-2 p-0 text-xs leading-relaxed">
              <div className="flex items-center justify-between">
                <span>Auth Provider:</span>
                <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-500">
                  <ShieldCheck className="size-3" />
                  Clerk JWT Live
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Database Engine:</span>
                <span className="text-foreground font-mono text-[11px]">MongoDB Atlas SRV</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Webhook Bridge:</span>
                <span className="text-foreground font-mono text-[11px]">Svix Cryptographic</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Session TTL:</span>
                <span className="text-foreground font-mono text-[11px]">15-Min Sliding Token</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ContentContainer>
  );
}
