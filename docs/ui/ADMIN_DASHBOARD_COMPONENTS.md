# Administrator Dashboard Component Library
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Component Architecture Overview

All Administrator Dashboard components reside within `src/app/(admin)/admin/dashboard/components/` and are exported through the central barrel `index.ts`. They strictly follow the **Glassmorphism Design System**, the **amber accent palette** (`text-amber-500`, `bg-amber-500/10`), dual-theme compatibility, and server-authoritative RBAC scoping.

```
src/app/(admin)/admin/dashboard/
├── components/
│   ├── index.ts                # Component barrel export
│   ├── welcome-banner.tsx      # Admin greeting, credentials, and dossier CTA
│   ├── metrics-overview.tsx    # 4-card collegiate population overview
│   ├── user-management.tsx     # Collegiate roster & directory provisioning overview
│   ├── notice-management.tsx   # College circulars & broadcast management
│   ├── poll-management.tsx     # Campus polls & student feedback surveys
│   ├── request-tracking.tsx    # Student service requisition queues (MOD-13)
│   ├── quick-actions.tsx       # Fast-access shortcuts and Phase 5 tooltips
│   └── recent-activity.tsx     # Security and administrative telemetry timeline
└── page.tsx                    # Server Component orchestrator
```

---

## 2. Component Specifications

### 2.1 `AdminWelcomeBanner`
- **File:** `src/app/(admin)/admin/dashboard/components/welcome-banner.tsx`
- **Type:** Client Component (`'use client'`)
- **Props:**
  ```typescript
  interface WelcomeBannerProps {
    user: UserDTO;
  }
  ```
- **Functionality:**
  - Dynamic local time greeting ("Good morning, Administrator", "Good afternoon, Administrator", "Good evening, Administrator").
  - Administrator full name display with initials avatar fallback (`AD` default).
  - Amber ambient glow: `bg-amber-500/10 blur-3xl dark:bg-amber-500/15`.
  - Credentials strip: Staff ID (`adminProfile.adminStaffId`), Administrative Domain (`adminProfile.administrativeDomain`), and assigned queue scopes.
  - Formatted Indian date string (`en-IN` locale, e.g., "Friday, 13 November 2026").
  - Fast-access action button linking to `/shared/profile` (Admin Dossier).

---

### 2.2 `AdminMetricsOverview`
- **File:** `src/app/(admin)/admin/dashboard/components/metrics-overview.tsx`
- **Type:** Client Component (`'use client'`)
- **Props:**
  ```typescript
  export interface AdminMetricsCounts {
    students: number;
    faculty: number;
    admins: number;
    pendingRequests: number;
  }

  interface MetricsOverviewProps {
    counts: AdminMetricsCounts;
  }
  ```
- **Functionality:**
  - **Enrolled Students:** Queries genuine student documents from MongoDB Atlas (badge: `info`).
  - **Instructional Faculty:** Queries genuine faculty documents from MongoDB Atlas (badge: `success`).
  - **Administrative Officers:** Queries genuine administrator documents from MongoDB Atlas (badge: `warning`).
  - **Service Requisitions:** Reflects active queue clearance state ("0 Pending", badge: `glass`).
  - Strict anti-hallucination compliance: zero fabricated mock statistics.

---

### 2.3 `AdminUserManagement`
- **File:** `src/app/(admin)/admin/dashboard/components/user-management.tsx`
- **Type:** Client Component (`'use client'`)
- **Props:**
  ```typescript
  interface UserManagementProps {
    counts: AdminMetricsCounts;
  }
  ```
- **Functionality:**
  - Search input with placeholder for collegiate directory queries.
  - Filter pills for interactive persona breakdown ("All Users", "Students", "Faculty", "Administrators") with dynamic counts.
  - 3-column directory telemetry cards:
    - Identity Provider status: Clerk Live (Svix cryptographically signed webhooks).
    - RBAC Scope: `users:manage: DEPT` departmental boundary enforcement.
    - Role Mutation Control: `users:manage_roles` strictly locked for Super Admin.
  - Informative Phase 5 card explaining upcoming bulk CSV user onboarding and cohort directory search.

---

### 2.4 `AdminNoticeManagement`
- **File:** `src/app/(admin)/admin/dashboard/components/notice-management.tsx`
- **Type:** Client Component (`'use client'`)
- **Functionality:**
  - Header with `Megaphone` icon in amber and "Phase 5" badge.
  - Frosted glass `EmptyState` explaining that official institutional circulars and scheduled departmental announcements will be dispatched here.
  - Scope guidance cards detailing that departmental publishing (`notices:publish_college: DEPT`) is permitted, while emergency siren alarms (`emergency:trigger`) are strictly reserved for Super Admin.

---

### 2.5 `AdminPollManagement`
- **File:** `src/app/(admin)/admin/dashboard/components/poll-management.tsx`
- **Type:** Client Component (`'use client'`)
- **Functionality:**
  - Header with `BarChart3` icon in cyan and "Phase 5" badge.
  - Frosted glass `EmptyState` explaining that department surveys, student sentiment voting, and curriculum polls activate in Phase 5.
  - Scope cards detailing department survey creation authority (`polls:create_course: DEPT`) and cryptographic ballot integrity.

---

### 2.6 `AdminRequestTracking`
- **File:** `src/app/(admin)/admin/dashboard/components/request-tracking.tsx`
- **Type:** Client Component (`'use client'`)
- **Functionality:**
  - Header with `Inbox` icon in amber and "Phase 5" badge.
  - Frosted glass `EmptyState` explaining that student leave applications, bona fide certificates, and hostel passes queue here.
  - Institutional SLA standards card:
    - Turnaround SLA: 48 business hours.
    - Digital Verification: QR Signed passes.
    - Approval Scope: `requests:approve_reject: DEPT` departmental queue gate.

---

### 2.7 `AdminQuickActions`
- **File:** `src/app/(admin)/admin/dashboard/components/quick-actions.tsx`
- **Type:** Client Component (`'use client'`)
- **Functionality:**
  - Surfaces active shortcuts to live routes:
    - `/shared/profile` (Admin Dossier) — Live
    - `/ui-preview` (UI Design System) — Live
    - `/shared/profile` (Department Settings) — Live
  - Clearly badges upcoming modules with Phase 5 tooltips:
    - `/admin/notices` (Publish Circulars) — Phase 5
    - `/admin/requests` (Process Requisitions) — Phase 5
    - `/admin/spaces` (Facility Reservations) — Phase 5

---

### 2.8 `AdminRecentActivity`
- **File:** `src/app/(admin)/admin/dashboard/components/recent-activity.tsx`
- **Type:** Client Component (`'use client'`)
- **Props:**
  ```typescript
  interface RecentActivityProps {
    user: UserDTO;
  }
  ```
- **Functionality:**
  - Surfaces authentic administrator telemetry and NIST SP 800-63B standards.
  - Timeline events:
    - "Administrator Session Active": Clerk JWT session validated with 15-minute token TTL.
    - "Tier-2 Ingress Authorized": DOC-AUTH-005 administrative scope verified.
    - "Admin Identity Synced": Synchronized with MongoDB Atlas cluster via Svix webhook.
    - "Immutable Audit Logging": Administrative actions bound to immutable audit trail.

