# Faculty Dashboard Component Library & Specifications
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Directory Structure

All faculty dashboard components are colocated under `src/app/(faculty)/faculty/dashboard/components/`:

```
src/app/(faculty)/faculty/dashboard/
├── components/
│   ├── welcome-banner.tsx         # Personalized welcome hero with faculty credentials
│   ├── metrics-overview.tsx       # 4-card overview of teaching load & evaluation queue
│   ├── class-roster.tsx           # Class & subject allocations with departmental isolation
│   ├── assignment-management.tsx  # Coursework evaluations & gradebook queue
│   ├── student-overview.tsx       # Student cohort overview with privacy isolation
│   ├── notice-section.tsx         # Department circulars with course broadcast footnote
│   ├── academic-calendar.tsx      # Compact calendar day grid & teaching timetable
│   ├── quick-actions.tsx          # Fast-access shortcuts to live & Phase 5 faculty tools
│   ├── recent-activity.tsx        # Authentic faculty telemetry & ABAC bindings timeline
│   └── index.ts                   # Component barrel export
└── page.tsx                       # Server Component layout composition
```

---

## 2. Component Specifications

### 2.1 `FacultyWelcomeBanner` (`welcome-banner.tsx`)
- **Props:** `{ user: UserDTO }`
- **Features:**
  - Time-of-day greeting ("Good morning, Professor", "Good afternoon, Professor", "Good evening, Professor").
  - Displays authenticated faculty member's full name, employee ID (`facultyProfile.employeeId`), academic designation (`facultyProfile.designation`), and cabin location (`facultyProfile.cabinRoom`).
  - Generates two-letter uppercase fallback initials for `AvatarFallback` (`FC` default).
  - Indian locale date string formatting (`weekday, day month year`).
  - One-click CTA link to `/shared/profile`.

### 2.2 `FacultyMetricsOverview` (`metrics-overview.tsx`)
- **Props:** `{ user: UserDTO }`
- **Features:**
  - 4 responsive frosted glass metric cards (`variant="glass"`).
  - **Teaching Allocations:** Displays assigned courses count or `Syllabus Pending` (badge: `Active` or `Phase 5`).
  - **Coursework Evaluations:** Displays current pending evaluations (`0 Pending`, badge: `All Clear`).
  - **Course Circulars:** Displays dispatched notice status (`0 Dispatched`, badge: `Phase 5`).
  - **Instructor Security:** Displays ABAC credential standing (`ABAC Verified`, badge: `Protected`).
  - Employs Lucide icons (`BookOpen`, `ClipboardCheck`, `Megaphone`, `ShieldCheck`) with dedicated color accents.

### 2.3 `FacultyClassRoster` (`class-roster.tsx`)
- **Features:**
  - Frosted glass container with heading "Teaching Allocations & Course Sections".
  - Inlines reusable `EmptyState` component for zero-classroom state.
  - Explains that departmental teaching allocations, theoretical lectures, and laboratory batches synchronize in Phase 5.
  - Footnote citing departmental isolation boundaries (`DOC-AUTH-005 ABAC`).

### 2.4 `FacultyAssignmentManagement` (`assignment-management.tsx`)
- **Features:**
  - Frosted glass container with heading "Coursework Evaluations & Gradebook".
  - Inlines reusable `EmptyState` component for zero-pending evaluation queue.
  - Explains that coursework dropboxes and grading rubrics activate in Phase 5.
  - Compliance note citing instructor assignment ownership (`OWN` scope).

### 2.5 `FacultyStudentOverview` (`student-overview.tsx`)
- **Features:**
  - Frosted glass container with heading "Enrolled Students & Academic Cohorts".
  - Inlines reusable `EmptyState` component for roster pending allocation.
  - Explains that cohort student counts and mentorship records populate upon course linking in Phase 5.
  - Student privacy footnote citing peer submission isolation per `DOC-AUTH-005`.

### 2.6 `FacultyNoticeSection` (`notice-section.tsx`)
- **Features:**
  - Frosted glass container with heading "Department Bulletins & Circulars".
  - Inlines reusable `EmptyState` component for zero-announcement state.
  - Explains that collegiate circulars, exam schedules, and alerts activate in Phase 5.
  - Footnote confirming provisioned course broadcast permissions (`notices:publish_course`).

### 2.7 `FacultyAcademicCalendar` (`academic-calendar.tsx`)
- **Features:**
  - Reusable compact calendar widget.
  - Calculates days in current month and first day offset index.
  - Highlights today's date with an emerald glass badge (`bg-emerald-600 text-white font-bold`).
  - Displays instructional timetable schedule slot with a zero-lecture indicator for Phase 5 timetable integration.

### 2.8 `FacultyQuickActions` (`quick-actions.tsx`)
- **Features:**
  - 6-card shortcut grid.
  - **Live Routes:**
    - `Faculty Dossier`: Links to `/shared/profile` (Live badge).
    - `UI Design System`: Links to `/ui-preview` (Live badge).
  - **Upcoming Routes (Phase 5):**
    - `Broadcast Notices`: Disabled card, `Phase 5` badge, hover tooltip.
    - `Gradebook & Evaluations`: Disabled card, `Phase 5` badge, hover tooltip.
    - `Classroom Polls`: Disabled card, `Phase 5` badge, hover tooltip.
    - `Instructional Timetable`: Disabled card, `Phase 5` badge, hover tooltip.

### 2.9 `FacultyRecentActivity` (`recent-activity.tsx`)
- **Props:** `{ user: UserDTO }`
- **Features:**
  - Vertical timeline with frosted glass connector nodes.
  - Renders authentic security and IAM telemetry:
    - Faculty Session Active: 15-minute Clerk JWT TTL.
    - Instructor Scope Provisioned: `DOC-AUTH-005` ABAC bindings.
    - Faculty Identity Created: Webhook synchronization timestamp.
  - NIST SP 800-63B compliance tag.

---

## 3. Reused Architecture Components

| Reused Component | Source Directory | Role in Faculty Dashboard |
| :--- | :--- | :--- |
| `ContentContainer` | `@/components/layouts` | Standardized padding and max-width layout bounds (`max-w-7xl`). |
| `AppShell` | `@/components/layouts` | Outer global authenticated shell with sidebar, topbar, and drawer. |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` | `@/components/ui` | Frosted glass containers with ambient borders and hover lifts. |
| `Badge` | `@/components/ui` | Semantic status badges (`glass`, `success`, `outline`, `info`). |
| `Button` | `@/components/ui` | Interactive glass buttons (`glass-primary`, `ghost`). |
| `Avatar`, `AvatarFallback`, `AvatarImage` | `@/components/ui` | Profile picture rendering with initials fallback. |
| `Tooltip`, `TooltipTrigger`, `TooltipContent` | `@/components/ui` | Accessible hover tooltips on disabled Phase 5 shortcuts. |
| `EmptyState` | `@/components/ui` | Clean zero-data empty states for classes, evaluations, and notices. |

