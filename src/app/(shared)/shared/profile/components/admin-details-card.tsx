'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import type { OwnerProfileDTO } from '@/types/profile';
import {
  ShieldAlert,
  Building2,
  Briefcase,
  Layers,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';

interface AdminDetailsCardProps {
  profile: OwnerProfileDTO;
}

export function AdminDetailsCard({ profile }: AdminDetailsCardProps) {
  const admin = profile.adminProfile;
  const isSuperAdmin = profile.role === 'super_admin';

  return (
    <Card variant="glass" className="space-y-4 p-5 shadow-xs">
      <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-warning" />
          <CardTitle className="text-sm font-semibold">Administrative Governance Scope</CardTitle>
        </div>
        <Badge variant={isSuperAdmin ? 'destructive' : 'warning'} className="text-[10px]">
          {isSuperAdmin ? 'Executive Authority' : 'Departmental Governance'}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 p-0 text-xs">
        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <UserCheck className="size-3.5 text-muted-foreground" />
            Administrative Authority:
          </span>
          <span className="text-foreground font-semibold">
            {profile.adminSubRole === 'sys_admin' || isSuperAdmin
              ? 'System Administrator'
              : profile.adminSubRole === 'director'
                ? 'Director (Institutional Oversight)'
                : profile.adminSubRole === 'hod'
                  ? 'Head of Department (HOD)'
                  : 'Administrative Officer'}
          </span>
        </div>

        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Building2 className="size-3.5 text-muted-foreground" />
            Department Scope:
          </span>
          <span className="text-foreground font-medium text-right">
            {profile.departmentName || profile.departmentCode || (
              <span className="text-primary font-semibold">Institution-Wide (Campus Console)</span>
            )}
          </span>
        </div>

        {admin?.designation && (
          <div className="border-border/40 flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-muted-foreground" />
              Designation:
            </span>
            <span className="text-foreground font-medium">{admin.designation}</span>
          </div>
        )}

        {admin?.administrativeDomain && (
          <div className="border-border/40 flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">Administrative Domain:</span>
            <span className="text-foreground font-medium">{admin.administrativeDomain}</span>
          </div>
        )}

        {admin?.adminStaffId && (
          <div className="border-border/40 flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground">Staff ID:</span>
            <span className="text-foreground font-mono">{admin.adminStaffId}</span>
          </div>
        )}

        {admin?.assignedQueueScopes && admin.assignedQueueScopes.length > 0 && (
          <div className="border-border/40 space-y-1 border-b pb-2">
            <span className="text-muted-foreground flex items-center gap-1">
              <Layers className="size-3.5 text-primary" />
              Assigned Queue Scopes:
            </span>
            <div className="flex flex-wrap gap-1 pt-1">
              {admin.assignedQueueScopes.map((scope, idx) => (
                <Badge key={idx} variant="glass" className="text-[10px]">
                  {scope}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="size-3.5 text-amber-500" />
            Emergency Override Authority:
          </span>
          <Badge
            variant={admin?.emergencyOverridePermitted ? 'warning' : 'outline'}
            className="text-[10px]"
          >
            {admin?.emergencyOverridePermitted ? 'Authorized' : 'Restricted'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

