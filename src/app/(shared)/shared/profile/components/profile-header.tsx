'use client';

import React from 'react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
} from '@/components/ui';
import { ROLE_PORTAL_METADATA } from '@/config/navigation';
import type { OwnerProfileDTO } from '@/types/profile';
import {
  User,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Building,
  AtSign,
} from 'lucide-react';

interface ProfileHeaderProps {
  profile: OwnerProfileDTO;
  onEditClick: () => void;
}

export function ProfileHeader({ profile, onEditClick }: ProfileHeaderProps) {
  const roleMeta = ROLE_PORTAL_METADATA[profile.role] ?? ROLE_PORTAL_METADATA.student;

  const displayName = profile.fullName || profile.username || 'Collegiate User';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const memberSince = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(profile.createdAt || Date.now()));

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl border border-glass-border p-4 shadow-sm sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <Avatar className="size-16 ring-2 ring-primary/30 shadow-md sm:size-20">
            {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-foreground truncate text-xl font-bold tracking-tight sm:text-2xl">
                {displayName}
              </h1>

              <Badge variant={roleMeta.badgeVariant} className="text-[10px] font-semibold">
                {roleMeta.badgeLabel}
              </Badge>

              {profile.adminSubRole && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {profile.adminSubRole.replace('_', ' ')}
                </Badge>
              )}

              <Badge
                variant={profile.status === 'active' ? 'success' : 'warning'}
                className="gap-1 text-[10px] capitalize"
              >
                <CheckCircle2 className="size-3" />
                {profile.status}
              </Badge>
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              {profile.username && (
                <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                  <AtSign className="size-3 text-primary" />
                  {profile.username}
                </span>
              )}
              <span>•</span>
              <span className="truncate">{profile.email}</span>
              {profile.departmentCode && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Building className="size-3 text-primary" />
                    {profile.departmentCode}
                  </span>
                </>
              )}
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-[11px]">
              <span className="inline-flex items-center gap-1 font-mono">
                <User className="size-3 text-primary" />
                ID: {profile.id}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3 text-primary" />
                Member since {memberSince}
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                {profile.isEmailVerified ? (
                  <span className="text-emerald-500 font-medium inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Email Verified
                  </span>
                ) : (
                  <span className="text-amber-500 font-medium inline-flex items-center gap-1">
                    <Clock className="size-3" /> Verification Pending
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="glass-primary"
            size="sm"
            onClick={onEditClick}
            className="gap-1.5 shadow-xs"
          >
            <Edit3 className="size-3.5" />
            Edit Profile
          </Button>
        </div>
      </div>
    </div>
  );
}

