'use client';

/**
 * Administrator Dashboard Welcome Banner.
 * Displays personalized greeting, administrator name, staff ID,
 * administrative domain, assigned queue scopes, and Indian date.
 * Styled with the approved amber accent palette and controlled glassmorphism.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button } from '@/components/ui';
import type { UserDTO } from '@/types/user';
import {
  Building2,
  Calendar as CalendarIcon,
  UserCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Briefcase,
} from 'lucide-react';

interface WelcomeBannerProps {
  user: UserDTO;
}

export function AdminWelcomeBanner({ user }: WelcomeBannerProps) {
  // Hydration-safe greeting & formatted date (computed post-mount to match client timezone)
  const [greeting, setGreeting] = useState<string>('Welcome');
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
    setFormattedDate(
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now),
    );
  }, []);

  const displayName =
    user.fullName || (user.email ? user.email.split('@')[0] : '') || 'Administrator';

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'AD';

  const staffId = user.adminProfile?.adminStaffId || 'Verified Staff';
  const administrativeDomain =
    user.adminProfile?.administrativeDomain || 'Academic Affairs & Registry';
  const queueScopes =
    user.adminProfile?.assignedQueueScopes && user.adminProfile.assignedQueueScopes.length > 0
      ? user.adminProfile.assignedQueueScopes.join(', ')
      : 'Student Services & Clearances';

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-4 shadow-md sm:p-6 lg:p-8">
      {/* Ambient amber background glow */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 size-80 rounded-full bg-amber-500/10 blur-3xl dark:bg-amber-500/15"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Avatar & Identity Details */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16 shadow-md ring-2 ring-amber-500/30 sm:size-20">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-amber-500/15 text-xl font-bold text-amber-600 dark:text-amber-400">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                {greeting}, Administrator
              </span>
              <Badge variant="warning" className="gap-1 text-[10px] font-semibold">
                <Sparkles className="size-3" />
                Department Administrator
              </Badge>
            </div>

            <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              {displayName}
            </h1>

            {/* Administrative Credentials Strip */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <Briefcase className="size-3.5 text-amber-500" />
                <strong className="text-foreground font-semibold">{staffId}</strong>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5 text-amber-500" />
                <span>{administrativeDomain}</span>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                <span>Scope: {queueScopes}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Date Stamp & Profile Action */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          {formattedDate && (
            <div className="text-muted-foreground border-border/40 bg-muted/20 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
              <CalendarIcon className="size-3.5 text-amber-500" />
              <span>{formattedDate}</span>
            </div>
          )}

          <Button asChild variant="glass-primary" size="sm" className="gap-2">
            <Link href="/shared/profile">
              <UserCircle className="size-4" />
              <span>Admin Dossier</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
