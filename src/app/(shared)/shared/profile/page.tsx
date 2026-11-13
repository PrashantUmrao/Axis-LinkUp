import React from 'react';
import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth';
import { UserRepository } from '@/lib/db/repositories/user.repository';
import { toUserDTO } from '@/lib/db/models/user.model';
import { ContentContainer } from '@/components/layouts';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
} from '@/components/ui';
import { ROLE_PORTAL_METADATA } from '@/config/navigation';
import type { UserDTO } from '@/types/user';
import {
  User,
  Shield,
  Mail,
  Key,
  ShieldCheck,
  Building,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'My Profile | Axis LinkUp',
  description: 'Manage collegiate identity, contact details, and session security.',
};

export default async function UserProfilePage() {
  const session = await requireAuth();

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
      userDTO = {
        id: session.userId,
        email: session.email,
        fullName:
          session.fullName ||
          (session.email ? session.email.split('@')[0] : '') ||
          'Authenticated User',
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
      fullName:
        session.fullName ||
        (session.email ? session.email.split('@')[0] : '') ||
        'Authenticated User',
      role: session.role,
      status: session.status || 'active',
      isProfileComplete: false,
      departmentId: session.departmentId ?? null,
      avatarUrl: session.avatarUrl ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const roleMeta = ROLE_PORTAL_METADATA[userDTO.role] ?? ROLE_PORTAL_METADATA.student;
  const displayName =
    userDTO.fullName || (userDTO.email ? userDTO.email.split('@')[0] : '') || 'Authenticated User';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(userDTO.createdAt || Date.now()));

  return (
    <ContentContainer maxWidth="narrow" className="space-y-6">
      {/* Identity Profile Hero */}
      <div className="glass-panel relative overflow-hidden rounded-2xl p-4 shadow-md sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Avatar className="ring-primary/30 size-16 shadow-md ring-2 sm:size-20">
            {userDTO.avatarUrl && <AvatarImage src={userDTO.avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-foreground truncate text-xl font-bold tracking-tight sm:text-2xl">
                {displayName}
              </h1>
              <Badge variant={roleMeta.badgeVariant} className="text-[10px] font-semibold">
                {roleMeta.badgeLabel}
              </Badge>
              <Badge variant="success" className="gap-1 text-[10px]">
                <CheckCircle2 className="size-3" />
                {userDTO.status}
              </Badge>
            </div>

            <p className="text-muted-foreground truncate text-xs">{userDTO.email}</p>

            <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-xs">
              <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                <User className="text-primary size-3" />
                ID: {userDTO.id}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="text-primary size-3" />
                Member since {formattedDate}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Collegiate Identity Card */}
        <Card variant="glass" className="space-y-4 p-5 shadow-sm">
          <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-3">
            <div className="flex items-center gap-2">
              <User className="text-primary size-4" />
              <CardTitle className="text-sm font-semibold">Collegiate Identity</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Institutional Roster
            </Badge>
          </CardHeader>

          <CardContent className="space-y-3 p-0 text-xs">
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Account Identifier:</span>
              <span className="text-foreground max-w-[160px] truncate font-mono text-[11px]">
                {userDTO.id}
              </span>
            </div>
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Institutional Email:</span>
              <span className="text-foreground max-w-[180px] truncate font-medium">
                {userDTO.email}
              </span>
            </div>
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Assigned Role:</span>
              <Badge variant={roleMeta.badgeVariant} className="text-[10px]">
                {userDTO.role}
              </Badge>
            </div>
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Department:</span>
              <span className="text-foreground flex items-center gap-1 font-medium">
                <Building className="text-muted-foreground size-3" />
                {userDTO.departmentId ?? 'Campus Administration'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Lifecycle Status:</span>
              <span className="font-medium text-emerald-500 capitalize">{userDTO.status}</span>
            </div>
          </CardContent>
        </Card>

        {/* Security & Ingress Ingestion Card */}
        <Card variant="glass" className="space-y-4 p-5 shadow-sm">
          <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-emerald-500" />
              <CardTitle className="text-sm font-semibold">Security &amp; Ingress</CardTitle>
            </div>
            <Badge variant="glass" className="text-[10px] text-emerald-500">
              NIST SP 800-63B
            </Badge>
          </CardHeader>

          <CardContent className="space-y-3 p-0 text-xs">
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Identity Provider:</span>
              <span className="text-foreground flex items-center gap-1 font-medium">
                <Key className="size-3 text-emerald-500" />
                Clerk IAM (SOC-2)
              </span>
            </div>
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Token Session Lifespan:</span>
              <span className="text-foreground font-mono text-[11px]">15-Min Sliding TTL</span>
            </div>
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Database Sync:</span>
              <span className="text-foreground flex items-center gap-1 font-medium">
                <ShieldCheck className="size-3 text-cyan-500" />
                MongoDB Atlas Multi-Region
              </span>
            </div>
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Audit Logging:</span>
              <span className="text-foreground font-mono text-[11px]">Immutable Event Trail</span>
            </div>
            <div className="border-border/40 bg-muted/20 text-muted-foreground rounded-lg border p-3 text-[11px] leading-relaxed">
              <p className="text-foreground flex items-center gap-1 pb-1 font-semibold">
                <Mail className="text-primary size-3" />
                Identity Governance Policy
              </p>
              Account credentials and authentication methods are managed via Clerk IAM. Role
              elevation and departmental assignments must be requested through Campus IT
              Administration.
            </div>
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  );
}
