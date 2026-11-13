# AXIS LINKUP — COMMON DASHBOARD COMPONENTS SPECIFICATION
**Document ID:** `SPEC-UI-013`  
**Phase:** 4.8.5 (Dashboard Redesign & Composition)  
**Status:** Approved & Implemented  

---

## 1. Overview

This document specifies the shared design patterns and reusable dashboard components established to maintain strict visual and structural consistency across Student, Faculty, and Administration portals.

---

## 2. Shared Dashboard Components

### 2.1 Concentric Progress Gauge (`ConcentricProgress`)
- **Location:** `src/components/dashboard/concentric-progress.tsx`
- **Design Origin:** Signature multi-ring circular gauge from Reference 2.
- **Visual Language:** Reference 1's light-blue frosted aesthetic and royal-blue accents.
- **Props:**
  - `rings: Array<{ label: string; value: number; color: string; bgColor?: string }>`
  - `centerLabel?: string`
  - `centerValue?: string`
  - `size?: number` (default: 140px)
  - `strokeWidth?: number` (default: 9px)
  - `className?: string`
- **Render Engine:** Pure SVG with `-rotate-90` orientation, smooth stroke-dasharray transitions (`700ms ease-out`), centered readout typography, and auto-generated legend chips.
- **Usage Across Portals:**
  - *Student:* Attendance (84.5%) + Syllabus Coverage (78.0%)
  - *Faculty:* Syllabus Taught (82.0%) + Evaluations Completed (94.0%)
  - *Admin:* IAM Verification (100.0%) + Platform Uptime (99.9%)

---

### 2.2 Top 4-Card Overview Row Pattern
- **Grid Layout:** `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`
- **Card Hierarchy:**
  1. Top Row: Upper-case tracking label (e.g., `ACADEMIC STANDING`) + Category badge + subtle hover menu icon.
  2. Value Row: Large prominent font (`font-heading text-2xl sm:text-3xl font-bold`) + rounded-xl accent icon container.
  3. Bottom Row: Border-t separated trend/status capsule pill (`CheckCircle2` icon + descriptive label) + session badge.
- **Variants:**
  - `StudentMetricsOverview`: Curriculum, Assignments, Notices, IAM.
  - `FacultyMetricsOverview`: Teaching Allocations, Evaluations, Circulars, ABAC.
  - `AdminMetricsOverview`: Students, Faculty, Admins, Requisitions.

---

### 2.3 Reference 2 "Project Card" Pattern
- **Student Version:** `StudentCourseModules`
  - Enrolled subjects, semester code, credits chip, instructor name, attendance badge, and syllabus progress bar.
- **Faculty Version:** `FacultyTeachingModules`
  - Assigned course batches, lecture halls, student headcount, weekly hours, and syllabus coverage progress bar.

---

### 2.4 Reference 2 "Team Member" Rail Pattern
- **Student Version:** `StudentFacultyMentors`
  - Assigned proctors, HOD, and lab superintendents with cabin numbers, office hours, availability indicator dot, and direct message link.

---

### 2.5 Statutory Grievance Redressal Desk Pattern (AICTE / UGC)
- **Student Portal:** `StudentGrievancePortalCard` — Student petition submission and 48-hour HOD SLA tracking.
- **Admin Portal (HOD Scope):** `HodGrievanceDesk` — First-tier adjudication, 48-hour resolution SLA, case resolution, and director escalation.
- **Admin Portal (Director Scope):** `DirectorAppealDesk` — Highest campus ombudsman tribunal, escalated appeals, and executive binding rulings.
