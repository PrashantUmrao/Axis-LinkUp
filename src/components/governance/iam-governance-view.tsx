'use client';

/**
 * IAM Governance Console View Component (Phase 5.10).
 * Super Administrator workspace featuring:
 * - Role & status distribution KPI cards
 * - User Role Directory (search, role/status filters, Modify Role & Change Status actions)
 * - Live RBAC Permission Matrix view derived directly from src/lib/auth/permissions.ts
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Badge, Button, Input, EmptyState } from '@/components/ui';
import {
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Search,
  KeyRound,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import { IamRoleEditModal } from './iam-role-edit-modal';
import { IamStatusModal } from './iam-status-modal';
import type {
  GovernedUserDTO,
  IamMutationResultDTO,
  IamRoleDistributionStatsDTO,
  PermissionMatrixDTO,
} from '@/types/governance';
import type { UserRole, UserStatus } from '@/types/user';
import type { PermissionScope } from '@/lib/auth/permissions';

interface IamGovernanceViewProps {
  currentUserId: string;
  initialUsers?: GovernedUserDTO[];
  initialStats?: IamRoleDistributionStatsDTO | null;
  initialMatrix?: PermissionMatrixDTO | null;
}

export function IamGovernanceView({
  currentUserId,
  initialUsers = [],
  initialStats = null,
  initialMatrix = null,
}: IamGovernanceViewProps) {
  const [activeTab, setActiveTab] = useState<'directory' | 'matrix'>('directory');
  const [users, setUsers] = useState<GovernedUserDTO[]>(initialUsers);
  const [stats, setStats] = useState<IamRoleDistributionStatsDTO | null>(initialStats);
  const [matrix] = useState<PermissionMatrixDTO | null>(initialMatrix);

  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');

  // Permission matrix search
  const [matrixSearch, setMatrixSearch] = useState('');

  // Active modals
  const [roleEditingUser, setRoleEditingUser] = useState<GovernedUserDTO | null>(null);
  const [statusEditingUser, setStatusEditingUser] = useState<GovernedUserDTO | null>(null);
  const [lastAuditNotice, setLastAuditNotice] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch('/api/v1/iam/users?limit=100'),
        fetch('/api/v1/iam/stats'),
      ]);

      const usersJson = await usersRes.json();
      if (usersRes.ok && usersJson.success && usersJson.data?.users) {
        setUsers(usersJson.data.users);
      }

      const statsJson = await statsRes.json();
      if (statsRes.ok && statsJson.success && statsJson.data) {
        setStats(statsJson.data);
      }
    } catch (err) {
      console.error('Failed to refresh IAM governance directory', err);
    }
  }, []);

  const handleMutationSuccess = (result: IamMutationResultDTO) => {
    setUsers((prev) => prev.map((u) => (u.id === result.user.id ? result.user : u)));
    setLastAuditNotice(
      `Updated ${result.user.email} • Recorded immutable audit event ${result.auditEvent.eventId}`
    );
    void refreshAll();
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const hitName = u.fullName.toLowerCase().includes(q);
        const hitEmail = u.email.toLowerCase().includes(q);
        const hitUsername = (u.username || '').toLowerCase().includes(q);
        const hitDept = (u.departmentName || '').toLowerCase().includes(q);
        if (!hitName && !hitEmail && !hitUsername && !hitDept) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  const filteredMatrixRows = useMemo(() => {
    if (!matrix) return [];
    if (!matrixSearch.trim()) return matrix.rows;
    const q = matrixSearch.toLowerCase().trim();
    return matrix.rows.filter(
      (row) =>
        row.permission.toLowerCase().includes(q) || row.module.toLowerCase().includes(q)
    );
  }, [matrix, matrixSearch]);

  const kpi = useMemo(() => {
    if (stats) return stats;
    return {
      totalUsers: users.length,
      byRole: {
        super_admin: users.filter((u) => u.role === 'super_admin').length,
        admin: users.filter((u) => u.role === 'admin').length,
        faculty: users.filter((u) => u.role === 'faculty').length,
        student: users.filter((u) => u.role === 'student').length,
      },
      byStatus: {
        active: users.filter((u) => u.status === 'active').length,
        suspended: users.filter((u) => u.status === 'suspended').length,
        pending_verification: users.filter((u) => u.status === 'pending_verification').length,
        deactivated: users.filter((u) => u.status === 'deactivated').length,
        other: 0,
      },
    };
  }, [stats, users]);

  const getScopeBadge = (scope: PermissionScope) => {
    switch (scope) {
      case 'ALLOW':
        return <Badge variant="success" className="text-[10px]">ALLOW</Badge>;
      case 'DEPT':
        return <Badge variant="warning" className="text-[10px]">DEPT</Badge>;
      case 'OWN':
        return <Badge variant="info" className="text-[10px]">OWN</Badge>;
      case 'DENY':
        return <Badge variant="outline" className="text-muted-foreground text-[10px]">DENY</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            IAM Governance &amp; RBAC Console
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Inspect institutional accounts, manage role assignments and suspensions, and audit the canonical DOC-AUTH-005 RBAC matrix.
          </p>
        </div>
        <Badge variant="glass" className="w-fit gap-1.5 text-xs">
          <ShieldCheck className="text-primary h-3.5 w-3.5" />
          Super Admin Exclusive
        </Badge>
      </div>

      {lastAuditNotice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300"
        >
          <span>{lastAuditNotice}</span>
          <button
            type="button"
            onClick={() => setLastAuditNotice(null)}
            className="font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Role Distribution KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Super Admins</span>
            <Shield className="text-destructive h-4 w-4" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{kpi.byRole.super_admin}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Admins / HODs</span>
            <KeyRound className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{kpi.byRole.admin}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Faculty</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{kpi.byRole.faculty}</p>
        </Card>

        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Students</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold">{kpi.byRole.student}</p>
        </Card>

        <Card variant="glass" className="col-span-2 p-4 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px] font-medium">Suspended</span>
            <UserX className="text-destructive h-4 w-4" />
          </div>
          <p className="text-destructive mt-1.5 text-2xl font-bold">{kpi.byStatus.suspended}</p>
        </Card>
      </div>

      {/* Tab Bar */}
      <div className="border-border/50 flex items-center gap-2 border-b pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'directory'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          User Role Directory ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'matrix'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          RBAC Permission Matrix ({matrix?.totalPermissions ?? 0})
        </button>
      </div>

      {/* Tab 1: User Role Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <Card variant="glass" className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search full name, email, username, department..."
                aria-label="Search governed users"
                className="pl-9 text-xs"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              aria-label="Filter by role"
              className="border-input bg-background/60 h-9 rounded-md border px-2.5 text-xs"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="faculty">Faculty</option>
              <option value="student">Student</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | UserStatus)}
              aria-label="Filter by account status"
              className="border-input bg-background/60 h-9 rounded-md border px-2.5 text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </Card>

          {filteredUsers.length === 0 ? (
            <EmptyState
              glass
              title="No Users Matching Criteria"
              description="Adjust your search query, role filter, or account status filter."
              className="py-10"
            />
          ) : (
            <div className="space-y-2.5">
              {filteredUsers.map((u) => (
                <Card
                  key={u.id}
                  variant="glass"
                  className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{u.fullName}</span>
                      <Badge
                        variant={
                          u.role === 'super_admin'
                            ? 'destructive'
                            : u.role === 'admin'
                              ? 'warning'
                              : u.role === 'faculty'
                                ? 'success'
                                : 'info'
                        }
                        className="text-[10px] capitalize"
                      >
                        {u.role.replace('_', ' ')}
                      </Badge>
                      {u.adminSubRole && (
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {u.adminSubRole}
                        </Badge>
                      )}
                      <Badge
                        variant={u.status === 'active' ? 'glass' : 'destructive'}
                        className="text-[10px] capitalize"
                      >
                        {u.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {u.email}
                      {u.departmentName && ` • ${u.departmentName}`}
                      {u.id === currentUserId && ' • (Current Session)'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRoleEditingUser(u)}
                      className="gap-1 text-xs"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Modify Role
                    </Button>
                    <Button
                      size="sm"
                      variant={u.status === 'active' ? 'ghost' : 'default'}
                      onClick={() => setStatusEditingUser(u)}
                      className="text-xs"
                    >
                      Change Status
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Canonical RBAC Permission Matrix */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <Card variant="glass" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                placeholder="Filter permissions by module or key (e.g. spaces:book, audit:view_logs)..."
                aria-label="Filter RBAC permissions"
                className="pl-9 text-xs"
              />
            </div>
            <span className="text-muted-foreground font-mono text-[11px]">
              Source: src/lib/auth/permissions.ts (DOC-AUTH-005)
            </span>
          </Card>

          <Card variant="glass" className="overflow-x-auto p-0">
            <table className="w-full text-left text-xs">
              <thead className="border-border/50 bg-muted/30 border-b text-[11px] uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Module</th>
                  <th className="px-4 py-3 font-semibold">Permission Key</th>
                  <th className="px-4 py-3 text-center font-semibold">Student</th>
                  <th className="px-4 py-3 text-center font-semibold">Faculty</th>
                  <th className="px-4 py-3 text-center font-semibold">Admin</th>
                  <th className="px-4 py-3 text-center font-semibold">Super Admin</th>
                </tr>
              </thead>
              <tbody className="divide-border/40 divide-y">
                {filteredMatrixRows.map((row) => (
                  <tr key={row.permission} className="hover:bg-muted/20">
                    <td className="text-muted-foreground px-4 py-2.5">{row.module}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] font-medium">
                      {row.permission}
                    </td>
                    <td className="px-4 py-2.5 text-center">{getScopeBadge(row.scopes.student)}</td>
                    <td className="px-4 py-2.5 text-center">{getScopeBadge(row.scopes.faculty)}</td>
                    <td className="px-4 py-2.5 text-center">{getScopeBadge(row.scopes.admin)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {getScopeBadge(row.scopes.super_admin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Governance Modals */}
      <IamRoleEditModal
        user={roleEditingUser}
        currentUserId={currentUserId}
        isOpen={Boolean(roleEditingUser)}
        onClose={() => setRoleEditingUser(null)}
        onSuccess={handleMutationSuccess}
      />

      <IamStatusModal
        user={statusEditingUser}
        currentUserId={currentUserId}
        isOpen={Boolean(statusEditingUser)}
        onClose={() => setStatusEditingUser(null)}
        onSuccess={handleMutationSuccess}
      />
    </div>
  );
}
