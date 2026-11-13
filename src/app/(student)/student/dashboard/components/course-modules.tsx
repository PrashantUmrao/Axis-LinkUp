'use client';

/**
 * Enrolled Course Modules Component (Reference 2: Project Cards).
 * Displays active semester subjects with credits, instructor chips, and attendance health.
 */

import React from 'react';
import { Card, Badge } from '@/components/ui';
import { User } from 'lucide-react';

interface CourseModule {
  id: string;
  code: string;
  title: string;
  credits: number;
  instructor: string;
  attendance: number;
  syllabusCovered: number;
  status: 'active' | 'lab_complete';
}

const ENROLLED_COURSES: CourseModule[] = [
  {
    id: 'cs-301',
    code: 'CSE-301',
    title: 'Data Structures & Algorithms',
    credits: 4,
    instructor: 'Dr. R. K. Verma',
    attendance: 88.5,
    syllabusCovered: 82,
    status: 'active',
  },
  {
    id: 'cs-302',
    code: 'CSE-302',
    title: 'Operating Systems & Architecture',
    credits: 4,
    instructor: 'Prof. Anjali Sharma',
    attendance: 82.0,
    syllabusCovered: 76,
    status: 'active',
  },
  {
    id: 'cs-303',
    code: 'CSE-303',
    title: 'Database Management Systems',
    credits: 3,
    instructor: 'Dr. P. Gupta',
    attendance: 85.0,
    syllabusCovered: 80,
    status: 'lab_complete',
  },
  {
    id: 'cs-304',
    code: 'CSE-304',
    title: 'Computer Networks & Protocols',
    credits: 3,
    instructor: 'Prof. M. Singh',
    attendance: 81.5,
    syllabusCovered: 74,
    status: 'active',
  },
];

export function StudentCourseModules() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="font-heading text-foreground text-base font-bold">
            Enrolled Course Modules
          </h2>
          <p className="text-muted-foreground text-xs">
            Current semester curriculum and verified instructional allocations
          </p>
        </div>
        <Badge variant="glass" className="px-2 text-[10px]">
          4 Subjects Enrolled
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ENROLLED_COURSES.map((course) => (
          <Card
            key={course.id}
            variant="glass"
            className="border-glass-border hover:border-glass-border-hover space-y-3 border p-4 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px]">
                    {course.code}
                  </Badge>
                  <span className="text-muted-foreground text-[10px] font-medium">
                    {course.credits} Credits
                  </span>
                </div>
                <h3 className="font-heading text-foreground line-clamp-1 text-xs font-bold sm:text-sm">
                  {course.title}
                </h3>
              </div>

              <Badge
                variant={course.attendance >= 75 ? 'success' : 'warning'}
                className="shrink-0 px-1.5 py-0 text-[9px]"
              >
                {course.attendance}% Att.
              </Badge>
            </div>

            <div className="border-border/30 space-y-1.5 border-t pt-1 text-xs">
              <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1">
                  <User className="text-primary size-3" />
                  <span>{course.instructor}</span>
                </span>
                <span>{course.syllabusCovered}% Syllabus</span>
              </div>

              {/* Progress Bar */}
              <div className="bg-muted/50 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${course.syllabusCovered}%` }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
