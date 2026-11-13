# AXIS LINKUP — STUDENT DASHBOARD REDESIGN SPECIFICATION
**Document ID:** `SPEC-UI-010`  
**Phase:** 4.8.5 (Dashboard Redesign & Composition)  
**Status:** Approved & Implemented  
**Target Ingress:** `src/app/(student)/student/dashboard/page.tsx`  

---

## 1. Executive Summary

The Student Dashboard serves as the daily academic hub for enrolled students at Axis Institute of Technology & Management (AITM), Kanpur. Following the approved design direction:
$$\text{Student Dashboard} = \text{Reference 1 (Visual Identity)} + \text{Reference 2 (Layout \& Density)}$$
it pairs soft sky-blue atmospheric glassmorphism surfaces (`#edf5fd` light, `#08111f` dark) with a high-density SaaS layout consisting of a top 4-card KPI row, 2/3 main analytical canvas, and 1/3 right-hand activity and mentoring rail.

---

## 2. Layout Structure & Grid Composition

### 2.1 Top 4-Card Overview Row (Reference 2 KPI Row)
- **Grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- **Component:** `StudentMetricsOverview` (`src/app/(student)/student/dashboard/components/metrics-overview.tsx`)
- **Card 1: Academic Standing**
  - Label: `Academic Standing` | Category: `Curriculum`
  - Value: `Sem 6` (Authoritative semester from MongoDB Atlas `studentProfile.currentSemester`)
  - Subtext: `B.Tech Regular Degree`
  - Footer Trend Pill: `Active Enrollment`
- **Card 2: Pending Coursework**
  - Label: `Pending Coursework` | Category: `Assignments`
  - Value: `0 Tasks` (Truth-in-UI verified)
  - Subtext: `No submissions overdue`
  - Footer Trend Pill: `All Deadlines Met`
- **Card 3: College Bulletins**
  - Label: `College Bulletins` | Category: `Notices`
  - Value: `0 New`
  - Subtext: `Central & Dept circulars`
  - Footer Trend Pill: `Up to Date`
- **Card 4: Security & Access**
  - Label: `Security & Access` | Category: `Governance`
  - Value: `Tier-2 Active`
  - Subtext: `AITM Campus Directory`
  - Footer Trend Pill: `IAM Verified`

---

## 3. Main Analytical Canvas (2/3 Column)

1. **Enrolled Course Modules (`StudentCourseModules`):**
   - Direct realization of Reference 2's Project Cards.
   - Displays 4 enrolled subjects (`CSE-301 Data Structures`, `CSE-302 Operating Systems`, `CSE-303 Database Management Systems`, `CSE-304 Computer Networks`).
   - Features subject code badge, credit count, assigned faculty instructor chip, attendance percentage badge, and smooth animated syllabus progress bar.
2. **Coursework & Assignment Dropboxes (`StudentAssignmentOverview`):**
   - Active submission dropboxes with assignment deadlines, submission statuses, and gradebook indicators.
3. **Statutory Grievance Redressal Desk (`StudentGrievancePortalCard`):**
   - Statutory AICTE / UGC mandated grievance redressal integration.
   - Shows open petition count (0 active, clean record), 48-hour resolution SLA to HOD, confidentiality guarantee (Internal Complaints Committee), and direct "Lodge Grievance" action button.
4. **Campus Notices Feed (`StudentNoticeFeed`):**
   - Real-time campus bulletin stream categorized by Central, Academic, Examination, and Cultural boards.
5. **Quick Actions Hub (`StudentQuickActions`):**
   - Fast shortcuts to submit coursework, view attendance ledger, request library clearances, or contact department advisors.

---

## 4. Right-Hand Activity & Mentorship Rail (1/3 Column)

1. **Concentric Progress Ring Gauge (`ConcentricProgress`):**
   - Reference 2 signature concentric circular progress gauge rendered in smooth vector SVG.
   - Outer Ring: Overall Attendance (84.5%, Royal Blue `#2563eb`).
   - Inner Ring: Syllabus Coverage (78.0%, Sky Cyan `#0284c7`).
   - Center Readout: `84.5% Attendance`.
   - Criteria Callout: Eligible for semester examinations (threshold 75.0%).
2. **Faculty Mentors & Advisors Rail (`StudentFacultyMentors`):**
   - Reference 2 "Team Member" rail adapted to university mentorship.
   - Lists assigned proctors:
     - Dr. R. K. Verma (HOD CSE, Room B-204)
     - Prof. Anjali Sharma (Academic Proctor, Room A-112)
     - Dr. P. Gupta (DBMS Lab Superintendent, Lab Complex 3)
   - Real-time office hours and direct messaging link.
3. **Academic Calendar Widget (`StudentAcademicCalendar`):**
   - Current month view with day highlight, examination slots, and holiday markers.
4. **Recent Telemetry & Audit Activity (`StudentRecentActivity`):**
   - Authentic cryptographic session login and profile update events.
5. **Institutional Boundary IAM Card:**
   - Displays campus authority (AITM Kanpur), Clerk JWT status, and RBAC Tier-2 verification.
