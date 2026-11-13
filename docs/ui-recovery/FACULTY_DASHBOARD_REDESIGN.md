# AXIS LINKUP — FACULTY DASHBOARD REDESIGN SPECIFICATION
**Document ID:** `SPEC-UI-011`  
**Phase:** 4.8.5 (Dashboard Redesign & Composition)  
**Status:** Approved & Implemented  
**Target Ingress:** `src/app/(faculty)/faculty/dashboard/page.tsx`  

---

## 1. Executive Summary

The Faculty Dashboard provides instructional cockpits for department professors, associate professors, and lecturers at AITM Kanpur. In full alignment with Reference 1 and Reference 2:
- **Atmosphere:** Frosted sky-blue glass panels (`rgba(255, 255, 255, 0.65)` in light, `rgba(13, 27, 42, 0.65)` in dark), soft background radial glow, subtle 1px border.
- **Composition:** High-density SaaS dashboard with 4 top KPI cards, 2/3 main instructional canvas, and 1/3 right-hand student tracking and scheduling rail.

---

## 2. Layout Structure & Grid Composition

### 2.1 Top 4-Card Overview Row (Reference 2 KPI Row)
- **Grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- **Component:** `FacultyMetricsOverview` (`src/app/(faculty)/faculty/dashboard/components/metrics-overview.tsx`)
- **Card 1: Teaching Allocations**
  - Label: `Teaching Allocations` | Category: `Curriculum`
  - Value: `4 Sections` (Truth-in-UI verified)
  - Subtext: `B.Tech CSE & Lab complex`
  - Footer Trend Pill: `Active Semester`
- **Card 2: Coursework Evaluations**
  - Label: `Coursework Evaluations` | Category: `Evaluations`
  - Value: `0 Pending`
  - Subtext: `All submissions reviewed`
  - Footer Trend Pill: `Dropboxes Cleared`
- **Card 3: Course Circulars**
  - Label: `Course Circulars` | Category: `Broadcasts`
  - Value: `3 Dispatched`
  - Subtext: `Department & class feeds`
  - Footer Trend Pill: `Syllabus Updates`
- **Card 4: Instructor Scope**
  - Label: `Instructor Scope` | Category: `Governance`
  - Value: `ABAC Active`
  - Subtext: `Tier-2 Institutional Gate`
  - Footer Trend Pill: `Role Protected`

---

## 3. Main Instructional Canvas (2/3 Column)

1. **Active Teaching Allocations (`FacultyTeachingModules`):**
   - Reference 2 Project Cards adapted to academic courses.
   - 4 Allocated Sections:
     - `CSE-301`: Data Structures & Algorithms (Batch A, Hall LH-102, 64 Students, 82% Syllabus, 4h/week).
     - `CSE-301-L`: Data Structures Laboratory (Batch A-1, Lab 2, 32 Students, 90% Syllabus, 3h/week).
     - `CSE-502`: Advanced Algorithm Design (Batch C, Hall LH-204, 58 Students, 74% Syllabus, 4h/week).
     - `CSE-701`: Cloud Distributed Systems (Final Year Ele-2, Seminar Hall 1, 45 Students, 70% Syllabus, 3h/week).
   - "Manage Roster" and "Enter Attendance" direct triggers.
2. **Class & Subject Roster (`FacultyClassRoster`):**
   - Roster table with student roll numbers, attendance records, and mid-term evaluations.
3. **Assignment Management & Gradebook (`FacultyAssignmentManagement`):**
   - Coursework dropboxes, rubric grading tools, and submission deadlines.
4. **Moderated Academic Communication Groups (`FacultyAcademicGroupsCard`):**
   - Implementation of Phase 4.8.2 communication specification.
   - Shows faculty-moderated class channels (`@cse301_official`, `@algo_research_grp`, `@cp_aitm_mentored`).
   - Moderation policies: Broadcast-Only vs Open Discussion.
5. **Department Notices & Circulars Desk (`FacultyNoticeSection`):**
   - Department notices dispatch panel.
6. **Quick Actions Shortcuts (`FacultyQuickActions`):**
   - Rapid grading, attendance entry, and quiz release.

---

## 4. Right-Hand Analytics & Schedule Rail (1/3 Column)

1. **Instructional Coverage Gauge (`ConcentricProgress`):**
   - Concentric circular gauge:
     - Outer Ring: Syllabus Taught (82.0%, Royal Blue `#2563eb`).
     - Inner Ring: Evaluations Met (94.0%, Emerald Green `#10b981`).
     - Center Readout: `82.0% Syllabus`.
     - Sub-metrics: Mid-Term SLA (On Schedule), Graded Tasks (128 Total).
2. **Enrolled Students & Cohort Overview (`FacultyStudentOverview`):**
   - Aggregate headcount, department breakdown, and proctorial mentee list.
3. **Academic Calendar & Teaching Schedule (`FacultyAcademicCalendar`):**
   - Day schedule breakdown and lecture slot countdowns.
4. **Recent Security & Telemetry Activity (`FacultyRecentActivity`):**
   - Audit trail of coursework publication and grade submissions.
5. **Departmental Governance Boundary Card:**
   - ABAC instructor ownership scope (`DOC-AUTH-005` matrix).
