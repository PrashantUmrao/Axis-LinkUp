'use client';

/**
 * Faculty Academic Communication Groups Desk.
 * Reflects Phase 4.8.2 communication specification:
 * Faculty-created verified academic cohorts with broadcast/discussion policies.
 */

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { MessageSquare, Users, Plus, ShieldCheck, ArrowUpRight, Volume2 } from 'lucide-react';

interface AcademicGroup {
  id: string;
  name: string;
  handle: string;
  memberCount: number;
  policy: 'broadcast_only' | 'open_discussion';
  lastActivity: string;
}

const MANAGED_GROUPS: AcademicGroup[] = [
  {
    id: 'grp-1',
    name: 'CSE-301 Data Structures Official',
    handle: '@cse301_official',
    memberCount: 64,
    policy: 'broadcast_only',
    lastActivity: 'Syllabus Assignment 3 posted 2h ago',
  },
  {
    id: 'grp-2',
    name: 'Algorithm Research Colloquium',
    handle: '@algo_research_grp',
    memberCount: 28,
    policy: 'open_discussion',
    lastActivity: 'Discussion active • 12 new posts',
  },
  {
    id: 'grp-3',
    name: 'Competitive Programming Club',
    handle: '@cp_aitm_mentored',
    memberCount: 92,
    policy: 'open_discussion',
    lastActivity: 'Contest reminder posted yesterday',
  },
];

export function FacultyAcademicGroupsCard() {
  return (
    <Card variant="glass" className="border-glass-border space-y-4 border p-5">
      <CardHeader className="flex flex-row items-center justify-between p-0 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <MessageSquare className="size-4" />
          </div>
          <div>
            <CardTitle className="font-heading text-foreground text-sm font-bold">
              Moderated Academic Groups
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Verified departmental communication channels with faculty governance
            </p>
          </div>
        </div>

        <Link href="/faculty/messages">
          <Button variant="pill-primary" size="sm" className="h-7 gap-1 text-xs">
            <Plus className="size-3" />
            Create Group
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        {MANAGED_GROUPS.map((group) => (
          <div
            key={group.id}
            className="bg-card/40 border-glass-border hover:border-glass-border-hover flex flex-col justify-between gap-2 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-foreground text-xs font-bold">{group.name}</span>
                <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px]">
                  {group.handle}
                </Badge>
                <Badge
                  variant={group.policy === 'broadcast_only' ? 'warning' : 'glass'}
                  className="flex items-center gap-1 px-1.5 py-0 text-[9px]"
                >
                  {group.policy === 'broadcast_only' ? (
                    <>
                      <Volume2 className="size-2.5" />
                      Faculty Broadcast Only
                    </>
                  ) : (
                    <>
                      <Users className="size-2.5" />
                      Open Discussion
                    </>
                  )}
                </Badge>
              </div>

              <div className="text-muted-foreground flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <Users className="text-primary size-3" />
                  <span>{group.memberCount} Members</span>
                </span>
                <span>•</span>
                <span className="truncate">{group.lastActivity}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
              <Link href="/faculty/messages">
                <Button variant="ghost" size="sm" className="text-primary h-7 gap-1 px-2 text-xs">
                  Open Group
                  <ArrowUpRight className="size-3" />
                </Button>
              </Link>
            </div>
          </div>
        ))}

        <div className="border-border/30 text-muted-foreground flex items-center justify-between border-t pt-2 text-xs">
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            Faculty moderation role actively enforced
          </span>
          <Link href="/faculty/messages" className="text-primary text-[11px] hover:underline">
            Manage Policies &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
