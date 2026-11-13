'use client';

/**
 * Administrator Dashboard User Management Section.
 * Provides departmental user directory overview, role-based filtering preview,
 * identity synchronization status, and IAM governance boundaries.
 * Strictly adheres to truth-in-UI requirements and RBAC scoping (users:manage_roles DENIED for admin).
 */

import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
} from '@/components/ui';
import {
  Users,
  Search,
  ShieldCheck,
  Lock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { AdminMetricsCounts } from './metrics-overview';

interface UserManagementProps {
  counts?: AdminMetricsCounts | null;
}

type RoleFilter = 'all' | 'students' | 'faculty' | 'admins';

export function AdminUserManagement({ counts }: UserManagementProps) {
  const safeCounts = counts ?? { students: 0, faculty: 0, admins: 0, pendingRequests: 0 };
  const [activeFilter, setActiveFilter] = useState<RoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const totalUsers = safeCounts.students + safeCounts.faculty + safeCounts.admins;

  const filters: Array<{ id: RoleFilter; label: string; count: number }> = [
    { id: 'all', label: 'All Users', count: totalUsers },
    { id: 'students', label: 'Students', count: safeCounts.students },
    { id: 'faculty', label: 'Faculty', count: safeCounts.faculty },
    { id: 'admins', label: 'Administrators', count: safeCounts.admins },
  ];

  return (
    <Card variant="glass" className="space-y-5 p-4 shadow-sm sm:p-6">
      {/* Header */}
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <Users className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Collegiate User Directory &amp; Provisioning
            </CardTitle>
            <CardDescription className="text-xs">
              Departmental user roster oversight, identity synchronization, and directory status
            </CardDescription>
          </div>
        </div>

        <Badge variant="glass" className="self-start text-[10px] text-amber-500 sm:self-auto">
          Directory Sync
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search directory by name, email, roll number, or employee ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted/20 border-border/40 pl-9 text-xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 border border-transparent'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span
                    className={`py-0.2 rounded-full px-1.5 text-[10px] ${
                      isActive
                        ? 'bg-amber-500/20 font-bold text-amber-700 dark:text-amber-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Directory Telemetry & Provisioning State */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Identity Provider Status */}
          <div className="border-border/40 bg-muted/20 space-y-1.5 rounded-xl border p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-500">
                <CheckCircle2 className="size-4" />
                <span className="text-xs font-semibold">Identity Sync</span>
              </div>
              <Badge variant="success" className="px-1.5 py-0 text-[9px]">
                Operational
              </Badge>
            </div>
            <p className="font-heading text-foreground text-sm font-semibold">
              Clerk Provider (Live)
            </p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Svix cryptographically signed webhooks synchronize active user accounts to MongoDB.
            </p>
          </div>

          {/* Departmental RBAC Boundary */}
          <div className="border-border/40 bg-muted/20 space-y-1.5 rounded-xl border p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-cyan-500">
                <ShieldCheck className="size-4" />
                <span className="text-xs font-semibold">RBAC Boundary</span>
              </div>
              <Badge variant="info" className="px-1.5 py-0 text-[9px]">
                DEPT Scope
              </Badge>
            </div>
            <p className="font-heading text-foreground text-sm font-semibold">
              DOC-AUTH-005 Matrix
            </p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Administrators hold department-bounded user oversight (
              <code className="text-[10px]">users:manage: DEPT</code>).
            </p>
          </div>

          {/* Role Mutation Control */}
          <div className="border-border/40 bg-muted/20 space-y-1.5 rounded-xl border p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-500">
                <Lock className="size-4" />
                <span className="text-xs font-semibold">Role Escalation</span>
              </div>
              <Badge variant="outline" className="px-1.5 py-0 text-[9px]">
                Restricted
              </Badge>
            </div>
            <p className="font-heading text-foreground text-sm font-semibold">IAM Privilege Gate</p>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Role promotion (<code className="text-[10px]">users:manage_roles</code>) is strictly
              reserved for Super Admin.
            </p>
          </div>
        </div>

        {/* Phase 5 Notice Box */}
        <div className="border-border/30 bg-muted/10 flex items-start gap-3 rounded-xl border p-4">
          <UserCheck className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-foreground font-semibold">
                Bulk Enrollment &amp; Directory Search (Phase 5 Activation)
              </span>
              <Badge variant="outline" className="text-[9px]">
                MOD-01 In Progress
              </Badge>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Interactive cohort roster table, bulk CSV student enrollment, lateral entry
              onboarding, and departmental faculty assignment tooling will activate upon Phase 5 IAM
              Directory integration.
            </p>
          </div>
        </div>

        {/* Footer Isolation Note */}
        <div className="border-border/40 text-muted-foreground flex items-center gap-2 border-t pt-3 text-[11px]">
          <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
          <span>
            Security Standard: All user record modifications require verified institutional email
            domains and follow zero-trust least privilege.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
