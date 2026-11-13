'use client';

/**
 * Faculty Dashboard Welcome Banner.
 * Displays personalized greeting, faculty member name, employee ID,
 * academic designation, department, cabin/office hours, and Indian date.
 */

import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button } from '@/components/ui';
import type { UserDTO } from '@/types/user';
import {
  BookOpen,
  Calendar as CalendarIcon,
  UserCircle,
  Sparkles,
  ArrowRight,
  Briefcase,
  Building,
} from 'lucide-react';

interface WelcomeBannerProps {
  user: UserDTO;
}

export function FacultyWelcomeBanner({ user }: WelcomeBannerProps) {
  // Personalized greeting based on current local hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Formatted date string in Indian English locale
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const displayName =
    user.fullName || (user.email ? user.email.split('@')[0] : '') || 'Faculty Member';

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'FC';

  const employeeId = user.facultyProfile?.employeeId || 'FAC-PENDING';
  const designation = user.facultyProfile?.designation || 'Academic Faculty';
  const cabinRoom = user.facultyProfile?.cabinRoom
    ? `Cabin ${user.facultyProfile.cabinRoom}`
    : 'Faculty Wing';

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-4 shadow-md sm:p-6 lg:p-8">
      {/* Ambient emerald background glow */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 size-80 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/15"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Avatar & Identity Details */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16 shadow-md ring-2 ring-emerald-500/30 sm:size-20">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-emerald-500/15 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                {getGreeting()}, Professor
              </span>
              <Badge variant="success" className="gap-1 text-[10px] font-semibold">
                <Sparkles className="size-3" />
                Faculty Member
              </Badge>
            </div>

            <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              {displayName}
            </h1>

            {/* Academic Credentials Strip */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <Briefcase className="size-3.5 text-emerald-500" />
                <strong className="text-foreground font-semibold">{employeeId}</strong>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="text-primary size-3.5" />
                <span>{designation}</span>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Building className="text-muted-foreground size-3.5" />
                <span>{cabinRoom}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Date Stamp & Profile Action */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <div className="text-muted-foreground border-border/40 bg-muted/20 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
            <CalendarIcon className="size-3.5 text-emerald-500" />
            <span>{formattedDate}</span>
          </div>

          <Button asChild variant="glass-primary" size="sm" className="gap-2">
            <Link href="/shared/profile">
              <UserCircle className="size-4" />
              <span>Faculty Dossier</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
