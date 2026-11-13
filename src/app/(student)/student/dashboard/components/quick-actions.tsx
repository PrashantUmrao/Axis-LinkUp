'use client';

/**
 * Student Dashboard Quick Actions Section.
 * Surfaces one-click navigation links to implemented routes and
 * clearly badges upcoming modules with Phase 5 tooltips.
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui';
import {
  UserCircle,
  Eye,
  Bell,
  FileCheck2,
  Calendar,
  Inbox,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export function StudentQuickActions() {
  const actions = [
    {
      id: 'profile',
      title: 'Student Profile',
      description: 'Review institutional credentials & IAM status',
      href: '/shared/profile',
      icon: UserCircle,
      isLive: true,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      id: 'ui-preview',
      title: 'UI Design System',
      description: 'Inspect design tokens & component showcase',
      href: '/ui-preview',
      icon: Eye,
      isLive: true,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      id: 'notices',
      title: 'Campus Bulletins',
      description: 'Official department announcements',
      href: '/student/notices',
      icon: Bell,
      isLive: false,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      tooltip: 'Campus notice board will activate in Phase 5.',
    },
    {
      id: 'assignments',
      title: 'Assignments Portal',
      description: 'Upload coursework & track evaluations',
      href: '/student/assignments',
      icon: FileCheck2,
      isLive: false,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      tooltip: 'Coursework submission dropboxes will activate in Phase 5.',
    },
    {
      id: 'calendar',
      title: 'Academic Timetable',
      description: 'Lecture schedule & semester exam dates',
      href: '/student/calendar',
      icon: Calendar,
      isLive: false,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      tooltip: 'Lecture schedule will synchronize in Phase 5.',
    },
    {
      id: 'requests',
      title: 'Service Requests',
      description: 'Bonafide, leave, & hostel pass requisitions',
      href: '/student/requests',
      icon: Inbox,
      isLive: false,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      tooltip: 'Student service ticketing will activate in Phase 5.',
    },
  ];

  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <Sparkles className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Collegiate Quick Actions</CardTitle>
            <CardDescription className="text-xs">
              Direct ingress to verified institutional services and upcoming modules
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

          if (action.isLive) {
            return (
              <Link
                key={action.id}
                href={action.href}
                className="group border-border/40 bg-muted/20 hover:border-primary/40 hover:bg-muted/40 relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs"
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
                    <span className="font-heading text-foreground group-hover:text-primary text-xs font-semibold transition-colors">
                      {action.title}
                    </span>
                    <ArrowRight className="text-muted-foreground group-hover:text-primary size-3 transition-all group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </Link>
            );
          }

          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <div
                  className="border-border/30 bg-muted/10 flex cursor-not-allowed flex-col justify-between rounded-xl border p-4 opacity-60 select-none"
                  aria-disabled="true"
                >
                  <div className="flex items-center justify-between pb-2">
                    <div
                      className={`flex size-9 items-center justify-center rounded-lg ${action.bgColor} ${action.color}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <Badge variant="outline" className="px-1.5 py-0 text-[9px] font-normal">
                      Phase 5
                    </Badge>
                  </div>

                  <div className="space-y-0.5">
                    <span className="font-heading text-foreground text-xs font-semibold">
                      {action.title}
                    </span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-semibold">{action.title}</p>
                <p className="text-muted-foreground text-[10px]">{action.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </CardContent>
    </Card>
  );
}
