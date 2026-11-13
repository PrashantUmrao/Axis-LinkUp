'use client';

/**
 * Administrative Role Scope Switcher & Workspace Coordinator.
 * Empowers governance officers to toggle between:
 * 1. System Administrator Desk (Closed IAM Provisioning, Roster, Architecture)
 * 2. HOD Department Desk (AICTE Statutory Grievance Adjudication, 48h SLA)
 * 3. Executive Director Desk (Institutional Appeals, Directorate Ombudsman)
 */

import React, { useState } from 'react';
import {
  AdminProvisioningCard,
  HodGrievanceDesk,
  DirectorAppealDesk,
  AdminUserManagement,
  AdminRequestTracking,
  AdminNoticeManagement,
  AdminPollManagement,
  AdminQuickActions,
  type AdminMetricsCounts,
} from './';
import { ShieldCheck, Scale, Landmark } from 'lucide-react';

interface AdminWorkspaceViewProps {
  counts: AdminMetricsCounts;
}

type AdminScope = 'sys_admin' | 'hod' | 'director';

export function AdminWorkspaceView({ counts }: AdminWorkspaceViewProps) {
  const [activeScope, setActiveScope] = useState<AdminScope>('sys_admin');

  return (
    <div className="space-y-6">
      {/* Scope Navigation Bar */}
      <div className="bg-card/40 border-glass-border flex flex-col justify-between gap-3 rounded-2xl border p-2 sm:flex-row sm:items-center">
        <div className="bg-muted/40 flex items-center gap-1.5 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setActiveScope('sys_admin')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeScope === 'sys_admin'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="size-3.5" />
            System Administrator
          </button>

          <button
            type="button"
            onClick={() => setActiveScope('hod')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeScope === 'hod'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="size-3.5" />
            HOD Department Desk
          </button>

          <button
            type="button"
            onClick={() => setActiveScope('director')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeScope === 'director'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Landmark className="size-3.5" />
            Executive Director Desk
          </button>
        </div>

        <div className="text-muted-foreground px-3 text-[11px]">
          Current Governance Scope:{' '}
          <span className="text-foreground font-semibold tracking-wider uppercase">
            {activeScope.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Scope Content Rendering */}
      {activeScope === 'sys_admin' && (
        <div className="space-y-6">
          {/* Closed Account Provisioning Desk (Mandatory Phase 4.8.2) */}
          <AdminProvisioningCard />

          {/* User Management & Provisioning Directory */}
          <AdminUserManagement counts={counts} />

          {/* Student Service Requisition Queues */}
          <AdminRequestTracking />

          {/* Department Notices & Circulars Desk */}
          <AdminNoticeManagement />

          {/* Campus Polls & Student Feedback */}
          <AdminPollManagement />

          {/* Quick Actions Shortcuts */}
          <AdminQuickActions />
        </div>
      )}

      {activeScope === 'hod' && (
        <div className="space-y-6">
          {/* HOD Department Grievance Adjudication Desk */}
          <HodGrievanceDesk />

          {/* Student Service Requisition Queues */}
          <AdminRequestTracking />

          {/* Department Notices & Circulars Desk */}
          <AdminNoticeManagement />

          {/* Campus Polls & Student Feedback */}
          <AdminPollManagement />

          {/* User Directory for Department */}
          <AdminUserManagement counts={counts} />
        </div>
      )}

      {activeScope === 'director' && (
        <div className="space-y-6">
          {/* Directorate Statutory Appeals Desk */}
          <DirectorAppealDesk />

          {/* Campus-wide Grievances Overview */}
          <HodGrievanceDesk />

          {/* Department Notices & Circulars Desk */}
          <AdminNoticeManagement />

          {/* User Management Directory */}
          <AdminUserManagement counts={counts} />
        </div>
      )}
    </div>
  );
}
