'use client';

/**
 * Faculty Mentors & Academic Advisors Component (Reference 2: Team Member List).
 * Lists assigned departmental proctors, HOD, and course coordinators for direct consultation.
 */

import React from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Avatar,
  AvatarFallback,
} from '@/components/ui';
import { UserCheck, MessageSquare, ChevronRight } from 'lucide-react';

interface FacultyMentor {
  id: string;
  name: string;
  role: string;
  department: string;
  cabin: string;
  officeHours: string;
  isAvailable: boolean;
  initials: string;
}

const ASSIGNED_MENTORS: FacultyMentor[] = [
  {
    id: 'fac-1',
    name: 'Dr. R. K. Verma',
    role: 'Head of Department',
    department: 'Computer Science & Eng.',
    cabin: 'Room B-204',
    officeHours: '11:00 AM - 1:00 PM',
    isAvailable: true,
    initials: 'RV',
  },
  {
    id: 'fac-2',
    name: 'Prof. Anjali Sharma',
    role: 'Academic Proctor & Mentor',
    department: 'Computer Science & Eng.',
    cabin: 'Room A-112',
    officeHours: '02:00 PM - 04:00 PM',
    isAvailable: true,
    initials: 'AS',
  },
  {
    id: 'fac-3',
    name: 'Dr. P. Gupta',
    role: 'DBMS Lab Superintendent',
    department: 'Computer Science & Eng.',
    cabin: 'Lab Complex 3',
    officeHours: '10:00 AM - 12:00 PM',
    isAvailable: false,
    initials: 'PG',
  },
];

export function StudentFacultyMentors() {
  return (
    <Card variant="glass" className="border-glass-border space-y-4 border p-5">
      <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-2">
        <div className="flex items-center gap-2">
          <UserCheck className="text-primary size-4" />
          <CardTitle className="font-heading text-foreground text-sm font-semibold">
            Academic Mentors
          </CardTitle>
        </div>
        <Badge variant="glass" className="text-[10px]">
          CSE Department
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        {ASSIGNED_MENTORS.map((mentor) => (
          <div
            key={mentor.id}
            className="hover:bg-muted/30 flex items-center justify-between rounded-xl p-2 transition-colors"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative">
                <Avatar className="border-glass-border size-9 border shadow-xs">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {mentor.initials}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`border-card absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 ${
                    mentor.isAvailable ? 'bg-emerald-500' : 'bg-muted-foreground'
                  }`}
                  aria-label={mentor.isAvailable ? 'Available now' : 'Currently in class'}
                />
              </div>

              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-foreground truncate text-xs font-semibold">{mentor.name}</h4>
                  <span className="text-muted-foreground bg-muted/40 rounded px-1 font-mono text-[9px]">
                    {mentor.cabin}
                  </span>
                </div>
                <p className="text-muted-foreground truncate text-[10px]">{mentor.role}</p>
                <p className="text-primary/80 text-[9px] font-medium">
                  Hours: {mentor.officeHours}
                </p>
              </div>
            </div>

            <Link
              href="/student/messages"
              className="hover:bg-primary/10 text-muted-foreground hover:text-primary shrink-0 rounded-lg p-1.5 transition-colors"
              title="Message Mentor"
              aria-label={`Message ${mentor.name}`}
            >
              <MessageSquare className="size-4" />
            </Link>
          </div>
        ))}

        <div className="border-border/30 flex items-center justify-between border-t pt-2 text-xs">
          <span className="text-muted-foreground text-[11px]">Direct proctorial access</span>
          <Link
            href="/student/messages"
            className="text-primary flex items-center gap-0.5 text-[11px] font-medium hover:underline"
          >
            All Faculty
            <ChevronRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
