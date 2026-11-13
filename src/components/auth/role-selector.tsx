'use client';

/**
 * Three-Door Collegiate Role Selection Component.
 * Presents dedicated entry doors for Students, Faculty, and Administrators.
 * Reference 1 (Visual Identity: sky-blue frosted glass) + Reference 2 (Proportions & density).
 */

import React from 'react';
import Link from 'next/link';
import { GraduationCap, BookOpenCheck, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type PortalType = 'student' | 'faculty' | 'admin';

interface PortalOption {
  id: PortalType;
  title: string;
  badge: string;
  badgeVariant: 'default' | 'glass' | 'info';
  icon: React.ElementType;
  description: string;
  targetAudience: string;
  accentColor: string;
}

const PORTAL_OPTIONS: PortalOption[] = [
  {
    id: 'student',
    title: 'Student Portal',
    badge: 'Enrolled Scholars',
    badgeVariant: 'info',
    icon: GraduationCap,
    description:
      'Access semester coursework, track real-time attendance, review lecture schedules, and submit formal grievances.',
    targetAudience: 'Undergraduate & Postgraduate Students',
    accentColor: 'text-blue-500',
  },
  {
    id: 'faculty',
    title: 'Faculty Workspace',
    badge: 'Instruction & Mentorship',
    badgeVariant: 'default',
    icon: BookOpenCheck,
    description:
      'Manage assigned lecture batches, evaluate coursework submissions, dispatch notices, and moderate academic groups.',
    targetAudience: 'Professors, Lecturers & Lab Instructors',
    accentColor: 'text-indigo-500',
  },
  {
    id: 'admin',
    title: 'Administration Console',
    badge: 'Governance & Directorate',
    badgeVariant: 'glass',
    icon: ShieldCheck,
    description:
      'Executive gateway for Department HODs, Directorate leadership, and System Administrators managing IAM provisioning.',
    targetAudience: 'Department HODs, Director & IT Admins',
    accentColor: 'text-sky-500',
  },
];

interface RoleSelectorProps {
  onSelectPortal?: (portal: PortalType) => void;
  className?: string;
  isStandalonePage?: boolean;
}

export function RoleSelector({
  onSelectPortal,
  className,
  isStandalonePage = false,
}: RoleSelectorProps) {
  return (
    <div className={cn('w-full space-y-6', className)}>
      <div className="space-y-2 text-center">
        <div className="bg-primary/10 border-primary/25 text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
          <Sparkles className="size-3.5" />
          <span>Institutional Entry Gateways</span>
        </div>
        <h2 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          Select Your Collegiate Portal
        </h2>
        <p className="text-muted-foreground mx-auto max-w-lg text-xs sm:text-sm">
          Choose your authorized institutional portal to proceed with verified collegiate login.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-2 sm:gap-6 md:grid-cols-3">
        {PORTAL_OPTIONS.map((portal) => {
          const Icon = portal.icon;

          const cardContent = (
            <div className="glass-card border-glass-border hover:border-glass-border-hover group flex h-full flex-col justify-between border p-6 text-left transition-all duration-300 hover:shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="bg-primary/10 border-primary/20 text-primary flex size-12 items-center justify-center rounded-2xl border shadow-xs transition-transform duration-200 group-hover:scale-105">
                    <Icon className="size-6" />
                  </div>
                  <Badge variant={portal.badgeVariant} className="px-2 py-0.5 text-[10px]">
                    {portal.badge}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-heading text-foreground group-hover:text-primary text-lg font-bold transition-colors">
                    {portal.title}
                  </h3>
                  <p className="text-muted-foreground/80 text-[11px] font-medium tracking-wider uppercase">
                    {portal.targetAudience}
                  </p>
                  <p className="text-muted-foreground pt-1 text-xs leading-relaxed">
                    {portal.description}
                  </p>
                </div>
              </div>

              <div className="border-border/40 text-primary mt-4 flex items-center justify-between border-t pt-6 text-xs font-semibold transition-transform group-hover:translate-x-0.5">
                <span>Sign In to {portal.title.split(' ')[0]}</span>
                <ArrowRight className="size-4" />
              </div>
            </div>
          );

          if (onSelectPortal) {
            return (
              <button
                key={portal.id}
                type="button"
                onClick={() => onSelectPortal(portal.id)}
                className="focus-visible:ring-primary w-full rounded-2xl text-left focus-visible:ring-2 focus-visible:outline-hidden"
              >
                {cardContent}
              </button>
            );
          }

          return (
            <Link
              key={portal.id}
              href={`/sign-in?portal=${portal.id}`}
              className="focus-visible:ring-primary block w-full rounded-2xl text-left focus-visible:ring-2 focus-visible:outline-hidden"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>

      {isStandalonePage && (
        <div className="pt-4 text-center">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
          >
            ← Return to Campus Home
          </Link>
        </div>
      )}
    </div>
  );
}
