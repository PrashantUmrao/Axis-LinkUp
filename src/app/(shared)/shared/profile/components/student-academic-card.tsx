'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import type { OwnerProfileDTO } from '@/types/profile';
import {
  GraduationCap,
  Building2,
  BookOpen,
  Calendar,
  Layers,
  Hash,
  Award,
  Info,
} from 'lucide-react';

interface StudentAcademicCardProps {
  profile: OwnerProfileDTO;
}

export function StudentAcademicCard({ profile }: StudentAcademicCardProps) {
  const student = profile.studentProfile;
  if (!student) {
    return null;
  }

  return (
    <Card variant="glass" className="space-y-4 p-5 shadow-xs">
      <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Academic Details &amp; Cohort</CardTitle>
        </div>
        <Badge variant="outline" className="text-[10px] font-medium text-primary">
          Registrar Record (Read-Only)
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 p-0 text-xs">
        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Building2 className="size-3.5 text-muted-foreground" />
            Department:
          </span>
          <span className="text-foreground font-medium text-right">
            {profile.departmentName || profile.departmentCode || 'Unassigned'}
          </span>
        </div>

        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="size-3.5 text-muted-foreground" />
            Academic Program:
          </span>
          <span className="text-foreground font-medium text-right">
            {student.program ? (
              <Badge variant="glass" className="font-mono text-[11px]">
                {student.program}
              </Badge>
            ) : (
              <span className="text-muted-foreground italic">Pending Allocation</span>
            )}
          </span>
        </div>

        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Hash className="size-3.5 text-muted-foreground" />
            Student Roll Number:
          </span>
          <span className="text-foreground font-mono font-semibold tracking-wider">
            {student.rollNumber || 'Not Allocated'}
          </span>
        </div>

        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Award className="size-3.5 text-muted-foreground" />
            Enrollment Number:
          </span>
          <span className="text-foreground font-mono font-medium">
            {student.enrollmentNumber || (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Registry Verification Pending
              </Badge>
            )}
          </span>
        </div>

        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            Batch &amp; Admission Year:
          </span>
          <span className="text-foreground font-medium">
            Batch {student.batchYear} (Admitted {student.admissionYear || student.batchYear})
          </span>
        </div>

        <div className="border-border/40 flex items-center justify-between border-b pb-2">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Layers className="size-3.5 text-muted-foreground" />
            Semester &amp; Section:
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant="info" className="text-[10px]">
              Semester {student.currentSemester}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-semibold">
              Section {student.section}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-muted-foreground">Admission Type:</span>
          <span className="text-foreground font-medium capitalize">
            {student.admissionType || 'Regular'}
          </span>
        </div>

        {/* Read-Only Academic Notice */}
        <div className="bg-primary/5 text-muted-foreground border-primary/20 mt-3 rounded-lg border p-2.5 text-[11px] leading-relaxed">
          <p className="text-primary flex items-center gap-1 font-semibold pb-0.5">
            <Info className="size-3.5 shrink-0" />
            Academic Cohort Integrity
          </p>
          Section allocation, semester progression, and program enrollments are managed strictly by
          your Department HOD and Registrar. Students cannot mutate academic records.
        </div>
      </CardContent>
    </Card>
  );
}

