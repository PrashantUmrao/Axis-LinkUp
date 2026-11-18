'use client';

/**
 * Administrator Dashboard Quick Actions Section.
 * Surfaces one-click navigation links to implemented administrative workflows.
 * Styled with the approved amber accent palette and controlled glassmorphism.
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
  Landmark,
  Megaphone,
  Inbox,
  Building2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export function AdminQuickActions() {
  const actions = [
    {
      id: 'admin-messages',
      title: 'Communications',
      description: 'Executive dispatch & departmental HOD channels',
      href: '/admin/messages',
      icon: MessageSquare,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      id: 'admin-complaints',
      title: 'Grievance Tribunal',
      description: 'Directorate statutory appeals & ombudsman docket',
      href: '/admin/complaints',
      icon: Landmark,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      id: 'admin-profile',
      title: 'Admin Dossier',
      description: 'Review credentials, domain, & security policies',
      href: '/shared/profile',
      icon: UserCircle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      id: 'college-circulars',
      title: 'Publish Circulars',
      description: 'Draft, schedule, & dispatch official college announcements',
      href: '/admin/notices',
      icon: Megaphone,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      id: 'service-queues',
      title: 'Process Requisitions',
      description: 'Clear student leave applications & bona fide certificates',
      href: '/admin/requests',
      icon: Inbox,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
    {
      id: 'facility-bookings',
      title: 'Facility Reservations',
      description: 'Auditorium, seminar halls, & lab allocation management',
      href: '/admin/spaces',
      icon: Building2,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
    },
  ];

  return (
    <Card variant="glass" className="space-y-4 p-6 shadow-sm">
      <CardHeader className="border-border/40 flex flex-col gap-2 border-b p-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <Sparkles className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Administrator Quick Actions</CardTitle>
            <CardDescription className="text-xs">
              Direct ingress to verified administrative services and departmental tools
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
              className="group border-border/40 bg-muted/20 hover:bg-muted/40 relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-xs"
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
                  <span className="font-heading text-foreground text-xs font-semibold transition-colors group-hover:text-amber-500">
                    {action.title}
                  </span>
                  <ArrowRight className="text-muted-foreground size-3 transition-all group-hover:translate-x-0.5 group-hover:text-amber-500" />
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
