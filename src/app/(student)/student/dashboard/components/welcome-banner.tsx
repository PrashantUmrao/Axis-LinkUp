'use client';

/**
 * Student Dashboard Welcome Banner.
 * Renders personalized greeting, student name, avatar, formatted date,
 * academic status badges, and quick profile link.
 */

import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button } from '@/components/ui';
import type { UserDTO } from '@/types/user';
import {
  GraduationCap,
  Calendar as CalendarIcon,
  UserCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface WelcomeBannerProps {
  user: UserDTO;
}

export function StudentWelcomeBanner({ user }: WelcomeBannerProps) {
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

  const displayName = user.fullName || (user.email ? user.email.split('@')[0] : '') || 'Student';

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'ST';

  const rollNumber = user.studentProfile?.rollNumber || 'STU-PENDING';
  const currentSemester = user.studentProfile?.currentSemester
    ? `Semester ${user.studentProfile.currentSemester}`
    : 'Semester Enrolled';
  const batchYear = user.studentProfile?.batchYear
    ? `Batch ${user.studentProfile.batchYear}`
    : 'AITM Campus';

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-4 shadow-md sm:p-6 lg:p-8">
      {/* Ambient background glow */}
      <div
        className="bg-primary/10 dark:bg-primary/15 pointer-events-none absolute -top-20 -right-20 size-80 rounded-full blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Avatar & Identity Details */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="ring-primary/30 size-16 shadow-md ring-2 sm:size-20">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/15 text-primary text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs font-medium">{getGreeting()},</span>
              <Badge variant="glass" className="text-primary gap-1 text-[10px] font-semibold">
                <Sparkles className="size-3" />
                Active Student
              </Badge>
            </div>

            <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              {displayName}
            </h1>

            {/* Academic Credentials Strip */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="text-primary size-3.5" />
                <strong className="text-foreground font-semibold">{rollNumber}</strong>
              </span>
              <span>•</span>
              <span>{currentSemester}</span>
              <span>•</span>
              <span>{batchYear}</span>
            </div>
          </div>
        </div>

        {/* Right: Date Stamp & Profile Action */}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <div className="text-muted-foreground border-border/40 bg-muted/20 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
            <CalendarIcon className="text-primary size-3.5" />
            <span>{formattedDate}</span>
          </div>

          <Button asChild variant="glass-primary" size="sm" className="gap-2">
            <Link href="/shared/profile">
              <UserCircle className="size-4" />
              <span>Academic Profile</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
