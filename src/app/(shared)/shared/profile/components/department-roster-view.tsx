'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Input,
  Skeleton,
} from '@/components/ui';
import type { OwnerProfileDTO, RosterStudentDTO, PaginatedRosterResponse } from '@/types/profile';
import { UserProfileDialog } from './user-profile-dialog';
import { AcademicEditDialog } from './academic-edit-dialog';
import {
  Users,
  Building,
  RotateCcw,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  AlertCircle,
} from 'lucide-react';

interface DepartmentRosterViewProps {
  currentUser: OwnerProfileDTO;
  availableDepartments?: Array<{ id: string; name: string; code: string }>;
}

export function DepartmentRosterView({
  currentUser,
  availableDepartments = [],
}: DepartmentRosterViewProps) {
  const isSysAdmin =
    currentUser.role === 'super_admin' || currentUser.adminSubRole === 'sys_admin';
  const isDirector = currentUser.adminSubRole === 'director';
  const isHOD = currentUser.adminSubRole === 'hod';
  const canSwitchDepartment = isSysAdmin || isDirector;

  // Initial department: caller's assigned department, or first available
  const initialDeptId =
    currentUser.departmentId || (availableDepartments[0]?.id ?? '');

  const [selectedDeptId, setSelectedDeptId] = useState<string>(initialDeptId);

  // Filter States
  const [programFilter, setProgramFilter] = useState('');
  const [batchYearFilter, setBatchYearFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Data State
  const [rosterData, setRosterData] = useState<PaginatedRosterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals State
  const [viewProfileId, setViewProfileId] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<RosterStudentDTO | null>(null);

  const fetchRoster = useCallback(async () => {
    if (!selectedDeptId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      if (programFilter.trim()) params.set('program', programFilter.trim().toUpperCase());
      if (batchYearFilter.trim()) params.set('batchYear', batchYearFilter.trim());
      if (semesterFilter.trim()) params.set('currentSemester', semesterFilter.trim());
      if (sectionFilter.trim()) params.set('section', sectionFilter.trim().toUpperCase());

      const res = await fetch(`/api/v1/departments/${selectedDeptId}/roster?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Failed to load department roster');
      }

      setRosterData(json.data as PaginatedRosterResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching department roster');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeptId, page, limit, programFilter, batchYearFilter, semesterFilter, sectionFilter]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const handleResetFilters = () => {
    setProgramFilter('');
    setBatchYearFilter('');
    setSemesterFilter('');
    setSectionFilter('');
    setSearchQuery('');
    setPage(1);
  };

  // Filter students locally by search query (name or roll number)
  const displayedStudents = (rosterData?.students || []).filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.rollNumber.toLowerCase().includes(q) ||
      (s.username && s.username.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil((rosterData?.totalStudents || 0) / limit) || 1;

  // Determine if caller can edit this student's academic cohort
  const canEditStudent = (_student: RosterStudentDTO) => {
    if (isSysAdmin) return true;
    if (isHOD && currentUser.departmentId === selectedDeptId) return true;
    return false;
  };

  return (
    <div className="space-y-4">
      {/* Roster Controls Card */}
      <Card variant="glass" className="space-y-4 p-4 shadow-xs sm:p-5">
        <CardHeader className="border-border/40 flex flex-col gap-3 border-b p-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Department Academic Roster</CardTitle>
            {rosterData?.department && (
              <Badge variant="glass" className="text-[10px] font-semibold">
                {rosterData.department.name} ({rosterData.department.code})
              </Badge>
            )}
          </div>

          {/* Department Selection for Director & System Admin */}
          {canSwitchDepartment && availableDepartments.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs whitespace-nowrap flex items-center gap-1">
                <Building className="size-3 text-muted-foreground" />
                Select Department:
              </span>
              <select
                aria-label="Select Department"
                value={selectedDeptId}
                onChange={(e) => {
                  setSelectedDeptId(e.target.value);
                  setPage(1);
                }}
                className="border-input bg-card text-foreground rounded-lg border px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
              >
                {availableDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-3 p-0">
          {/* Filter Bar */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {/* Search Input */}
            <div className="col-span-2">
              <Input
                placeholder="Search name, roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Program Filter */}
            <div>
              <Input
                placeholder="Program (e.g. BTECH_CSE)"
                value={programFilter}
                onChange={(e) => {
                  setProgramFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs"
              />
            </div>

            {/* Batch Year Filter */}
            <div>
              <Input
                type="number"
                placeholder="Batch (e.g. 2026)"
                value={batchYearFilter}
                onChange={(e) => {
                  setBatchYearFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs"
              />
            </div>

            {/* Semester Filter */}
            <div>
              <Input
                type="number"
                min={1}
                max={8}
                placeholder="Semester (1-8)"
                value={semesterFilter}
                onChange={(e) => {
                  setSemesterFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs"
              />
            </div>

            {/* Section Filter */}
            <div>
              <Input
                placeholder="Section (A, B)"
                value={sectionFilter}
                onChange={(e) => {
                  setSectionFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs"
              />
            </div>
          </div>

          {/* Active Filter Tags & Reset */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-muted-foreground text-[11px]">
              Showing{' '}
              <span className="font-semibold text-foreground">{displayedStudents.length}</span> of{' '}
              <span className="font-semibold text-foreground">
                {rosterData?.totalStudents || 0}
              </span>{' '}
              enrolled cohort students
            </span>

            <Button
              variant="ghost"
              size="xs"
              onClick={handleResetFilters}
              className="gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" /> Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Roster Data Table / Responsive Cards */}
      <Card variant="glass" className="overflow-hidden p-0 shadow-xs">
        {error ? (
          <div className="flex items-center gap-2 p-6 text-xs text-destructive bg-destructive/10">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 p-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
        ) : displayedStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-2">
            <GraduationCap className="size-8 text-muted-foreground/60" />
            <h4 className="text-sm font-semibold text-foreground">No Students Found</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              No students match the selected cohort criteria in this department roster.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/40 text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Roll Number</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Cohort</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {displayedStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-muted/20 transition-colors duration-150"
                  >
                    <td className="px-4 py-2.5 font-mono font-semibold text-foreground whitespace-nowrap">
                      {student.rollNumber}
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{student.fullName}</div>
                      {student.username && (
                        <div className="text-[10.5px] text-muted-foreground">
                          @{student.username}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Badge variant="glass" className="font-mono text-[10px]">
                        {student.program || 'GENERAL'}
                      </Badge>
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {student.batchYear}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="info" className="text-[10px]">
                          Sem {student.currentSemester}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Sec {student.section}
                        </Badge>
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setViewProfileId(student.id)}
                          className="gap-1 text-[11px]"
                        >
                          <Eye className="size-3 text-primary" /> View
                        </Button>

                        {canEditStudent(student) && (
                          <Button
                            variant="glass"
                            size="xs"
                            onClick={() => setEditStudent(student)}
                            className="gap-1 text-[11px]"
                          >
                            <Edit className="size-3 text-emerald-500" /> Edit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {rosterData && (
          <div className="bg-muted/20 border-border/40 flex items-center justify-between border-t px-4 py-2 text-xs">
            <span className="text-muted-foreground text-[11px]">
              Page <span className="font-semibold text-foreground">{page}</span> of{' '}
              <span className="font-semibold text-foreground">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="gap-1"
              >
                <ChevronLeft className="size-3" /> Prev
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="gap-1"
              >
                Next <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Directory View Dialog */}
      <UserProfileDialog
        userId={viewProfileId}
        open={Boolean(viewProfileId)}
        onOpenChange={(open) => {
          if (!open) setViewProfileId(null);
        }}
      />

      {/* Academic Edit Dialog */}
      <AcademicEditDialog
        student={editStudent}
        open={Boolean(editStudent)}
        onOpenChange={(open) => {
          if (!open) setEditStudent(null);
        }}
        onSuccess={() => {
          fetchRoster();
        }}
      />
    </div>
  );
}
