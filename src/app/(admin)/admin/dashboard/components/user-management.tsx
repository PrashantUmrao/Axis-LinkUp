'use client';

/**
 * Administrator Dashboard User Management Section.
 * Comprehensive Account Management & Collegiate User Directory:
 * - Real-time directory query (name, email, username, roll number, employee ID)
 * - Role filtering (All, Students, Faculty, Administrators)
 * - Status filtering (All, Active, Pending, Suspended, Deactivated)
 * - Status activation / deactivation toggle with Clerk IAM synchronization
 * - Account details editing modal (Full Name, Phone, Status)
 * - Re-issue activation invitation link with copy capability
 * Strictly restricted to authorized System Administrators.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import {
  Users,
  Search,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Power,
  RotateCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import type { UserDTO, UserStatus } from '@/types/user';
import type { AdminMetricsCounts } from './metrics-overview';

interface UserManagementProps {
  counts?: AdminMetricsCounts | null;
}

type RoleFilter = 'all' | 'students' | 'faculty' | 'admins';
type StatusFilter = 'all' | 'active' | 'pending_verification' | 'suspended' | 'deactivated';

export function AdminUserManagement({ counts: initialCounts }: UserManagementProps) {
  // Filters & Pagination State
  const [activeRoleFilter, setActiveRoleFilter] = useState<RoleFilter>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Data & Loading State
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [counts, setCounts] = useState<{
    total: number;
    students: number;
    faculty: number;
    admins: number;
  }>({
    total:
      (initialCounts?.students ?? 0) + (initialCounts?.faculty ?? 0) + (initialCounts?.admins ?? 0),
    students: initialCounts?.students ?? 0,
    faculty: initialCounts?.faculty ?? 0,
    admins: initialCounts?.admins ?? 0,
  });

  // Action States
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Edit User Dialog State
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Resend Link Modal State
  const [resendResult, setResendResult] = useState<{
    email: string;
    activationUrl?: string;
    token?: string;
    expiresAt?: string;
  } | null>(null);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch Directory Data
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (activeRoleFilter !== 'all') {
      if (activeRoleFilter === 'students') params.set('role', 'student');
      else if (activeRoleFilter === 'faculty') params.set('role', 'faculty');
      else if (activeRoleFilter === 'admins') params.set('role', 'admin');
    }
    if (activeStatusFilter !== 'all') params.set('status', activeStatusFilter);
    params.set('page', String(page));
    params.set('limit', '15');

    try {
      const res = await fetch(`/api/v1/admin/users?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data?.message || 'Failed to fetch collegiate user directory.');
        setUsers([]);
        return;
      }

      setUsers(data.data.users || []);
      setTotalPages(data.data.pagination.totalPages || 1);
      setTotalCount(data.data.pagination.total || 0);

      if (data.data.counts) {
        setCounts({
          total: data.data.counts.total,
          students: data.data.counts.students,
          faculty: data.data.counts.faculty,
          admins: data.data.counts.admins,
        });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Network error occurred.');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, activeRoleFilter, activeStatusFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Quick Status Toggle (Activate <-> Deactivate)
  const handleToggleStatus = async (user: UserDTO) => {
    const nextStatus: UserStatus = user.status === 'active' ? 'deactivated' : 'active';
    setActionLoadingId(user.id);
    setActionFeedback(null);

    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({
          type: 'error',
          message: data?.message || 'Failed to update account status.',
        });
        return;
      }

      setActionFeedback({
        type: 'success',
        message: `Account for ${user.fullName} successfully marked as ${nextStatus.toUpperCase()}.`,
      });

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network error occurred.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: UserDTO) => {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditPhone(user.phoneNumber || '');
    setEditStatus(user.status);
    setActionFeedback(null);
  };

  // Save Edit Modal Changes
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          phoneNumber: editPhone.trim() || null,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({
          type: 'error',
          message: data?.message || 'Failed to update account details.',
        });
        return;
      }

      setActionFeedback({
        type: 'success',
        message: `Account details for ${editFullName} updated successfully.`,
      });

      const updatedUser: UserDTO = data.data.user;
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      setEditingUser(null);
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network error occurred.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Resend Activation Link
  const handleResendActivation = async (user: UserDTO) => {
    setActionLoadingId(user.id);
    setActionFeedback(null);
    setHasCopiedLink(false);

    try {
      const res = await fetch('/api/v1/admin/users/activation/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionFeedback({
          type: 'error',
          message: data?.message || 'Failed to generate activation link.',
        });
        return;
      }

      setResendResult({
        email: user.email,
        activationUrl: data?.data?.activationUrl,
        token: data?.data?.token,
        expiresAt: data?.data?.expiresAt,
      });
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network error occurred.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setHasCopiedLink(true);
      setTimeout(() => setHasCopiedLink(false), 2000);
    }
  };

  const filters: Array<{ id: RoleFilter; label: string; count: number }> = [
    { id: 'all', label: 'All Users', count: counts.total },
    { id: 'students', label: 'Students', count: counts.students },
    { id: 'faculty', label: 'Faculty', count: counts.faculty },
    { id: 'admins', label: 'Administrators', count: counts.admins },
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
              Collegiate User Directory &amp; Account Management
            </CardTitle>
            <CardDescription className="text-xs">
              Live account administration, status management, activation workflows, and identity
              synchronization
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchUsers()}
            disabled={isLoading}
            className="border-glass-border h-7 gap-1 text-xs"
          >
            <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Directory
          </Button>
          <Badge variant="glass" className="text-[10px] text-amber-500">
            IAM Authority
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div
            className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${actionFeedback.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-destructive/20 bg-destructive/10 text-destructive'
              }`}
          >
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <p className="flex-1 font-medium">{actionFeedback.message}</p>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search directory by name, email, username, roll number, or employee ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted/20 border-border/40 pl-9 text-xs"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="w-full sm:w-48">
            <select
              value={activeStatusFilter}
              onChange={(e) => {
                setActiveStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="border-border/40 bg-muted/20 text-foreground h-9 w-full rounded-xl border px-3 text-xs focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active Only</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="suspended">Suspended</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>

        {/* Role Pills Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((filter) => {
            const isActive = activeRoleFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setActiveRoleFilter(filter.id);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${isActive
                    ? 'border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 border border-transparent'
                  }`}
              >
                <span>{filter.label}</span>
                <span
                  className={`py-0.2 rounded-full px-1.5 text-[10px] ${isActive
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

        {/* User Directory Table / List */}
        <div className="border-border/30 overflow-hidden rounded-xl border">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-2">
              <Loader2 className="size-6 animate-spin text-amber-500" />
              <p className="text-muted-foreground text-xs">Querying collegiate user accounts...</p>
            </div>
          ) : errorMessage ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive space-y-2">
              <AlertCircle className="size-6" />
              <p className="text-xs font-semibold">{errorMessage}</p>
              <Button size="sm" variant="outline" onClick={() => fetchUsers()} className="h-7 text-xs">
                Retry
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center space-y-2">
              <Users className="text-muted-foreground size-8 stroke-1" />
              <p className="font-heading text-foreground text-sm font-semibold">No Accounts Found</p>
              <p className="text-muted-foreground max-w-sm text-xs">
                {debouncedQuery || activeStatusFilter !== 'all' || activeRoleFilter !== 'all'
                  ? 'No user accounts matched your search criteria. Try modifying your filters.'
                  : 'No accounts provisioned yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 border-border/40 text-muted-foreground border-b text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">User &amp; Identity</th>
                    <th className="px-4 py-3">Role &amp; Persona</th>
                    <th className="px-4 py-3">Academic Scope</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border/30 divide-y">
                  {users.map((user) => {
                    const isRootAdmin =
                      user.username === 'admin01' ||
                      (user.role === 'super_admin' && user.adminSubRole === 'sys_admin');
                    const isPending = user.status === 'pending_verification';
                    const isActive = user.status === 'active';
                    const isSuspended = user.status === 'suspended';

                    return (
                      <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                        {/* User Identity */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold">
                              {user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="space-y-0.5">
                              <p className="font-semibold text-foreground leading-none">
                                {user.fullName}
                              </p>
                              <p className="text-muted-foreground font-mono text-[11px]">
                                @{user.username || 'unassigned'}
                              </p>
                              <p className="text-muted-foreground/80 text-[10px]">{user.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role & Persona */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <Badge
                              variant="outline"
                              className={`gap-1 text-[10px] font-semibold uppercase ${user.role === 'student'
                                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  : user.role === 'faculty'
                                    ? 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                    : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                }`}
                            >
                              {user.role === 'student' && <GraduationCap className="size-3" />}
                              {user.role === 'faculty' && <Briefcase className="size-3" />}
                              {(user.role === 'admin' || user.role === 'super_admin') && (
                                <ShieldCheck className="size-3" />
                              )}
                              <span>
                                {user.role === 'super_admin'
                                  ? 'System Admin'
                                  : user.role === 'admin'
                                    ? 'Admin'
                                    : user.role}
                              </span>
                            </Badge>

                            {user.adminSubRole && (
                              <span className="text-muted-foreground font-mono text-[9px] uppercase">
                                Sub: {user.adminSubRole}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Academic / Staff Scope */}
                        <td className="px-4 py-3 text-muted-foreground">
                          {user.role === 'student' && user.studentProfile && (
                            <div className="space-y-0.5 text-[11px]">
                              <p className="font-mono font-medium text-foreground">
                                Roll: {user.studentProfile.rollNumber}
                              </p>
                              <p className="text-[10px]">
                                Sem {user.studentProfile.currentSemester} • Sec {user.studentProfile.section}
                              </p>
                              {user.studentProfile.program && (
                                <p className="text-[10px] font-semibold">{user.studentProfile.program}</p>
                              )}
                            </div>
                          )}

                          {user.role === 'faculty' && user.facultyProfile && (
                            <div className="space-y-0.5 text-[11px]">
                              <p className="font-mono font-medium text-foreground">
                                Emp: {user.facultyProfile.employeeId}
                              </p>
                              <p className="text-[10px]">{user.facultyProfile.designation}</p>
                            </div>
                          )}

                          {(user.role === 'admin' || user.role === 'super_admin') && (
                            <div className="space-y-0.5 text-[11px]">
                              {user.adminProfile?.adminStaffId && (
                                <p className="font-mono font-medium text-foreground">
                                  ID: {user.adminProfile.adminStaffId}
                                </p>
                              )}
                              <p className="text-[10px]">
                                {user.adminProfile?.administrativeDomain || 'Central Administration'}
                              </p>
                            </div>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium capitalize ${isActive
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : isPending
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : isSuspended
                                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    : 'border-zinc-500/30 bg-zinc-500/10 text-zinc-500'
                              }`}
                          >
                            {user.status.replace('_', ' ')}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Resend Activation Link (for pending accounts) */}
                            {isPending && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleResendActivation(user)}
                                disabled={actionLoadingId === user.id}
                                title="Generate Activation Invitation Link"
                                className="border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 h-7 px-2 text-[11px]"
                              >
                                {actionLoadingId === user.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <>
                                    <RotateCw className="mr-1 size-3" />
                                    Resend Invite
                                  </>
                                )}
                              </Button>
                            )}

                            {/* Status Toggle Button (Activate / Deactivate) */}
                            <Button
                              type="button"
                              size="sm"
                              variant={isActive ? 'outline' : 'pill-primary'}
                              onClick={() => handleToggleStatus(user)}
                              disabled={actionLoadingId === user.id || isRootAdmin}
                              title={
                                isRootAdmin
                                  ? 'Root System Administrator cannot be deactivated'
                                  : isActive
                                    ? 'Deactivate Account'
                                    : 'Activate Account'
                              }
                              className={`h-7 px-2 text-[11px] ${isActive
                                  ? 'border-border/40 hover:bg-destructive/10 hover:text-destructive'
                                  : ''
                                }`}
                            >
                              {actionLoadingId === user.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <>
                                  <Power className="mr-1 size-3" />
                                  {isActive ? 'Deactivate' : 'Activate'}
                                </>
                              )}
                            </Button>

                            {/* Edit Modal Button */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEdit(user)}
                              title="Edit Account Details"
                              className="border-border/40 h-7 px-2 text-[11px]"
                            >
                              <Edit2 className="size-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Toolbar */}
          {!isLoading && users.length > 0 && (
            <div className="bg-muted/20 border-border/40 flex items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground">
              <div>
                Showing <span className="font-semibold text-foreground">{users.length}</span> of{' '}
                <span className="font-semibold text-foreground">{totalCount}</span> accounts
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 px-2 text-xs"
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>

                <span className="px-2 font-mono text-[11px]">
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 px-2 text-xs"
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Edit User Modal Dialog */}
      {editingUser && (
        <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <UserIcon className="size-4 text-primary" />
                <span>Edit Account: {editingUser.fullName}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update account information and lifecycle status. Email and username remain immutable
                for zero-trust security.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 py-2">
              <div className="space-y-1">
                <label className="text-muted-foreground text-[11px] font-medium">Full Name</label>
                <Input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground text-[11px] font-medium">Phone Number</label>
                <Input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground text-[11px] font-medium">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className="border-border/40 bg-card text-foreground h-9 w-full rounded-xl border px-3 text-xs"
                >
                  <option value="active">Active</option>
                  <option value="pending_verification">Pending Verification</option>
                  <option value="suspended">Suspended</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingUser(null)}
                  disabled={isSavingEdit}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="pill-primary"
                  size="sm"
                  disabled={isSavingEdit}
                  className="text-xs font-semibold"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Resend Activation Link Modal Dialog */}
      {resendResult && (
        <Dialog open={Boolean(resendResult)} onOpenChange={(open) => !open && setResendResult(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold text-amber-500">
                <ShieldCheck className="size-4" />
                <span>Activation Link Generated</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                An activation link has been generated for{' '}
                <strong className="text-foreground">{resendResult.email}</strong>. Share this secure
                link directly with the user.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="border-border/40 bg-muted/20 space-y-1.5 rounded-xl border p-3">
                <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                  Secure Activation URL
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={resendResult.activationUrl || ''}
                    className="bg-card font-mono text-[11px]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(resendResult.activationUrl || '')}
                    className="h-9 px-3 shrink-0"
                  >
                    {hasCopiedLink ? (
                      <Check className="size-4 text-emerald-500" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {resendResult.expiresAt && (
                <p className="text-muted-foreground text-[10px]">
                  Expires on: {new Date(resendResult.expiresAt).toLocaleString()}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResendResult(null)}
                className="text-xs"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
