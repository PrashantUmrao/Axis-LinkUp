# Student Dashboard Component Library & Specifications
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Directory Structure

All student dashboard components are colocated under `src/app/(student)/student/dashboard/components/`:

```
src/app/(student)/student/dashboard/
├── components/
│   ├── welcome-banner.tsx         # Personalized welcome hero with student identity
│   ├── metrics-overview.tsx       # 4-card operational academic standing overview
│   ├── notice-feed.tsx            # College bulletins section with empty-state handling
│   ├── assignment-overview.tsx    # Coursework submissions overview with ABAC notes
│   ├── academic-calendar.tsx      # Compact calendar day grid & schedule slots
│   ├── quick-actions.tsx          # Fast-access shortcuts to live & Phase 5 modules
│   ├── recent-activity.tsx        # Authentic IAM lifecycle & security audit timeline
│   └── index.ts                   # Component barrel export
└── page.tsx                       # Server Component layout composition
```

---

## 2. Component Specifications

### 2.1 `StudentWelcomeBanner` (`welcome-banner.tsx`)
- **Props:** `{ user: UserDTO }`
- **Features:**
  - Time-of-day greeting calculation (Morning `< 12:00`, Afternoon `< 17:00`, Evening `≥ 17:00`).
  - Displays authenticated student's full name, roll number (`studentProfile.rollNumber`), semester, and cohort batch year.
  - Generates two-letter uppercase fallback initials for `AvatarFallback` if `avatarUrl` is null.
  - Indian locale date string formatting (`weekday, day month year`).
  - One-click CTA link to `/shared/profile`.

### 2.2 `StudentMetricsOverview` (`metrics-overview.tsx`)
- **Props:** `{ user: UserDTO }`
- **Features:**
  - 4 responsive frosted glass metric cards (`variant="glass"`).
  - **Academic Standing:** Displays active semester (`Sem 1` through `Sem 8`).
  - **Coursework Due:** Displays current pending submissions (`0 Pending`, badge: `All Clear`).
  - **College Bulletins:** Displays unread notice status (`0 Unread`, badge: `Phase 5`).
  - **Identity Verification:** Displays IAM standing (`IAM Verified`, badge: `Protected`).
  - Employs Lucide icons (`BookOpen`, `FileCheck2`, `Bell`, `ShieldCheck`) with dedicated color accents.

### 2.3 `StudentNoticeFeed` (`notice-feed.tsx`)
- **Features:**
  - Frosted glass container with heading "Campus Notices & Circulars".
  - Inlines reusable `EmptyState` component for zero-announcement state.
  - Explains that departmental bulletins and emergency broadcast channels activate in Phase 5.
  - Footer compliance note citing cryptographic verification and administrative protocols.

### 2.4 `StudentAssignmentOverview` (`assignment-overview.tsx`)
- **Features:**
  - Frosted glass container with heading "Coursework & Assignments".
  - Inlines reusable `EmptyState` component for zero-pending coursework.
  - Explains that assignment deadlines and rubrics link automatically upon instructor course upload in Phase 5.
  - ABAC compliance note citing peer submission isolation (`DOC-AUTH-005`).

### 2.5 `StudentAcademicCalendar` (`academic-calendar.tsx`)
- **Features:**
  - Reusable compact calendar widget.
  - Calculates days in current month and first day offset index.
  - Displays day-of-week abbreviations (`M`, `T`, `W`, `T`, `F`, `S`, `S`).
  - Highlights today's date with a sapphire glass badge (`bg-primary text-primary-foreground font-bold`).
  - Displays upcoming schedule status with a zero-event placeholder for Phase 5 calendar integration.

### 2.6 `StudentQuickActions` (`quick-actions.tsx`)
- **Features:**
  - 6-card shortcut grid.
  - **Live Routes:**
    - `Student Profile`: Links to `/shared/profile` (Live badge).
    - `UI Design System`: Links to `/ui-preview` (Live badge).
  - **Upcoming Routes (Phase 5):**
    - `Campus Bulletins`: Disabled card, `Phase 5` badge, hover tooltip.
    - `Assignments Portal`: Disabled card, `Phase 5` badge, hover tooltip.
    - `Academic Timetable`: Disabled card, `Phase 5` badge, hover tooltip.
    - `Service Requests`: Disabled card, `Phase 5` badge, hover tooltip.

### 2.7 `StudentRecentActivity` (`recent-activity.tsx`)
- **Props:** `{ user: UserDTO }`
- **Features:**
  - Vertical timeline with frosted glass connector nodes.
  - Renders authentic security and IAM telemetry:
    - Session Authenticated: 15-minute Clerk JWT TTL.
    - Student Role Bound: Deny-by-Default RBAC enforcement.
    - Collegiate Identity Created: Webhook synchronization timestamp.
  - NIST SP 800-63B compliance tag.

---

## 3. Reused Architecture Components

| Reused Component | Source Directory | Role in Student Dashboard |
| :--- | :--- | :--- |
| `ContentContainer` | `@/components/layouts` | Standardized padding and max-width layout bounds (`max-w-7xl`). |
| `AppShell` | `@/components/layouts` | Outer global authenticated shell with sidebar, topbar, and drawer. |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` | `@/components/ui` | Frosted glass containers with ambient borders and hover lifts. |
| `Badge` | `@/components/ui` | Semantic status badges (`glass`, `success`, `outline`, `info`). |
| `Button` | `@/components/ui` | Interactive glass buttons (`glass-primary`, `ghost`). |
| `Avatar`, `AvatarFallback`, `AvatarImage` | `@/components/ui` | Profile picture rendering with initials fallback. |
| `Tooltip`, `TooltipTrigger`, `TooltipContent` | `@/components/ui` | Accessible hover tooltips on disabled Phase 5 shortcuts. |
| `EmptyState` | `@/components/ui` | Clean zero-data empty states for notices and assignments. |

