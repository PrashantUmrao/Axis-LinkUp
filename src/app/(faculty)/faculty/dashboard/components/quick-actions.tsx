'use client';

/**
 * Faculty Dashboard Quick Actions Section.
 * Surfaces one-click navigation links to implemented faculty workflows.
 */

import React from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from '@/components/ui';
import {
  UserCircle,
  MessageSquare,
  Scale,
  Megaphone,
  ClipboardCheck,
  Building2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export function FacultyQuickActions() {
  const actions = [
    {
      id: 'faculty-messages',
      title: 'Messages & Groups',
      description: 'Moderate academic cohorts & advise students',
      href: '/faculty/messages',
      icon: MessageSquare,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      id: 'faculty-complaints',
      title: 'Student Grievances',
      description: 'HOD department grievance adjudication & SLA',
      href: '/faculty/complaints',
      icon: Scale,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      id: 'faculty-profile',
      title: 'Faculty Dossier',
      description: 'Review designations, office hours, & IAM status',
      href: '/shared/profile',
      icon: UserCircle,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      id: 'course-notices',
      title: 'Broadcast Notices',
      description: 'Publish course circulars to enrolled batches',
      href: '/faculty/notices',
      icon: Megaphone,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      id: 'gradebook',
      title: 'Gradebook & Evaluations',
      description: 'Assess coursework submissions & record rubrics',
      href: '/faculty/assignments',
      icon: ClipboardCheck,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
    {
      id: 'facility-spaces',
      title: 'Facility & Hall Bookings',
      description: 'Reserve seminar halls, labs, and campus spaces',
      href: '/faculty/spaces',
      icon: Building2,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
    },
  ];

  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
            <Sparkles className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Faculty Quick Actions</CardTitle>
            <CardDescription className="text-xs">
              Direct ingress to verified faculty services and academic workflows
            </CardDescription>
          </div>
        </div>

        <Badge variant="glass" className="self-start text-[10px] sm:self-auto">
          Shortcuts
        </Badge>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              key={action.id}
              href={action.href}
              className="group border-border/40 bg-muted/20 hover:bg-muted/40 relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xs"
            >
              <div className="flex items-center justify-between pb-2">
                <div
                  className={`flex size-9 items-center justify-center rounded-lg ${action.bgColor} ${action.color}`}
                >
                  <Icon className="size-4" />
                </div>
                <Badge variant="success" className="px-1.5 py-0 text-[9px] font-normal">
                  Live
                </Badge>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-heading text-foreground text-xs font-semibold transition-colors group-hover:text-emerald-500">
                    {action.title}
                  </span>
                  <ArrowRight className="text-muted-foreground size-3 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
