'use client';

/**
 * Faculty Teaching Allocations Component (Reference 2: Project Cards).
 * Displays active lecture courses, student headcounts, lab allocations, and syllabus milestones.
 */

import React from 'react';
import Link from 'next/link';
import { Card, Badge, Button } from '@/components/ui';
import { Users, Clock, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface TeachingAllocation {
  id: string;
  courseCode: string;
  courseTitle: string;
  batch: string;
  room: string;
  studentCount: number;
  syllabusCovered: number;
  weeklyHours: number;
  nextLecture: string;
}

const ALLOCATED_COURSES: TeachingAllocation[] = [
  {
    id: 'alloc-1',
    courseCode: 'CSE-301',
    courseTitle: 'Data Structures & Algorithms',
    batch: 'Batch A (Sem 3)',
    room: 'Hall LH-102',
    studentCount: 64,
    syllabusCovered: 82,
    weeklyHours: 4,
    nextLecture: 'Tomorrow, 10:00 AM',
  },
  {
    id: 'alloc-2',
    courseCode: 'CSE-301-L',
    courseTitle: 'Data Structures Laboratory',
    batch: 'Batch A-1 (Lab)',
    room: 'Comp Lab 2',
    studentCount: 32,
    syllabusCovered: 90,
    weeklyHours: 3,
    nextLecture: 'Thursday, 02:00 PM',
  },
  {
    id: 'alloc-3',
    courseCode: 'CSE-502',
    courseTitle: 'Advanced Algorithm Design',
    batch: 'Batch C (Sem 5)',
    room: 'Hall LH-204',
    studentCount: 58,
    syllabusCovered: 74,
    weeklyHours: 4,
    nextLecture: 'Friday, 11:30 AM',
  },
  {
    id: 'alloc-4',
    courseCode: 'CSE-701',
    courseTitle: 'Cloud Distributed Systems',
    batch: 'Final Year Ele-2',
    room: 'Seminar Hall 1',
    studentCount: 45,
    syllabusCovered: 70,
    weeklyHours: 3,
    nextLecture: 'Monday, 09:00 AM',
  },
];

export function FacultyTeachingModules() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="font-heading text-foreground text-base font-bold">Teaching Allocations</h2>
          <p className="text-muted-foreground text-xs">
            Assigned instructional batches, lecture halls, and academic coverage
          </p>
        </div>
        <Badge variant="glass" className="px-2 text-[10px]">
          4 Assigned Sections
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ALLOCATED_COURSES.map((course) => (
          <Card
            key={course.id}
            variant="glass"
            className="border-glass-border hover:border-glass-border-hover space-y-3 border p-4 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="px-1.5 py-0 font-mono text-[9px]">
                    {course.courseCode}
                  </Badge>
                  <span className="text-muted-foreground text-[10px] font-medium">
                    {course.batch}
                  </span>
                </div>
                <h3 className="font-heading text-foreground line-clamp-1 text-xs font-bold sm:text-sm">
                  {course.courseTitle}
                </h3>
              </div>

              <Badge variant="glass" className="shrink-0 px-1.5 py-0 font-mono text-[9px]">
                {course.room}
              </Badge>
            </div>

            <div className="border-border/30 space-y-2 border-t pt-1 text-xs">
              <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1">
                  <Users className="text-primary size-3" />
                  <span>{course.studentCount} Students</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3 text-sky-500" />
                  <span>{course.weeklyHours}h / week</span>
                </span>
                <span>{course.syllabusCovered}% Syllabus</span>
              </div>

              {/* Syllabus Progress Bar */}
              <div className="bg-muted/50 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${course.syllabusCovered}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  {course.nextLecture}
                </span>

                <Link href="/faculty/assignments">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary h-6 gap-0.5 px-1.5 text-[10px]"
                  >
                    Manage Assignments
                    <ArrowUpRight className="size-2.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
