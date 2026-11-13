# Administrator Dashboard Design & Information Architecture
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Information Architecture & Design Philosophy

The **Administrator Dashboard** (`/admin/dashboard`), designated as the **Departmental Administrator Console**, serves as the operational command and management cockpit for departmental administrators, academic registrars, and student service officers at **Axis Institute of Technology & Management (AITM), Kanpur**.

Built upon the **Glassmorphism Design System** (Part 4.1), encapsulated within the **Global Application Shell** (Part 4.2), and styled with the approved **amber accent palette** (`text-amber-500`, `bg-amber-500/10`, `border-amber-500/20`, `ring-amber-500/30`, `badgeVariant: 'warning'`), the console provides an elegant, high-contrast, trustworthy operational cockpit tailored to collegiate roster governance, student service requisition processing, circular broadcasts, and campus telemetry.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Global AppShell (<AppShell user={session}>)                           │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ AdminWelcomeBanner                                                 │ │
│ │ • Avatar + Admin Name • Staff ID • Admin Domain • Indian Date      │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ AdminMetricsOverview (4-Column Responsive Grid)                    │ │
│ │ [Enrolled Students] [Faculty Roster] [Admin Officers] [Service Q]   │ │
│ ├──────────────────────────────────┬─────────────────────────────────┤ │
│ │ Main Administrative Column (Col 2)│ Telemetry & Governance (Col 1) │ │
│ │ • AdminUserManagement            │ • AdminRecentActivity           │ │
│ │ • AdminRequestTracking (MOD-13)  │ • Administrative Governance     │ │
│ │ • AdminNoticeManagement          │ • System Architecture Health    │ │
│ │ • AdminPollManagement            │                                 │ │
│ │ • AdminQuickActions              │                                 │ │
│ └──────────────────────────────────┴─────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Server-Authoritative Security & RBAC Ingress

### 2.1 Role-Gated Ingress Security
The administrator dashboard route is a **Next.js Server Component** protected by Tier-2 authorization:
```typescript
const session = await requireRole(['admin', 'super_admin']);
```
- Unauthenticated requests are rejected and redirected to `/sign-in`.
- Suspended administrator accounts are redirected to `/account-suspended`.
- Pending verification accounts are redirected to `/pending-approval`.
- Unauthorized roles (e.g. students, faculty) are redirected to `/unauthorized`.
- Client-submitted role claims or headers are **never trusted**.

### 2.2 Departmental Isolation & Scope Boundaries (DOC-AUTH-005)
In strict accordance with `DOC-AUTH-005` (RBAC & Permission Matrix), administrator permissions operate under compartmentalized departmental scoping:
- **`DEPT` Scope (Departmental Oversight):**
  - User directory oversight: `users:manage` (`DEPT` scope).
  - College circulars & bulletins: `notices:publish_college` (`DEPT` scope).
  - Urgent departmental bulletins: `notices:broadcast_urgent` (`DEPT` scope).
  - Service requisition clearance: `requests:approve_reject` (`DEPT` scope).
  - Campus facility approvals: `spaces:approve` (`DEPT` scope).
  - Departmental survey creation: `polls:create_course` (`DEPT` scope).
- **`DENY` Scope (Strict Privilege Boundaries):**
  - Role mutation & elevation: `users:manage_roles` is **DENIED** (strictly reserved for Super Admin).
  - RBAC policy manipulation: `rbac:modify_roles` and `rbac:manage_permissions` are **DENIED**.
  - Campus emergency alarm sirens: `emergency:trigger` is **DENIED** (strictly reserved for Super Admin).
  - Super Admin telemetry: `super_admin:view_telemetry` is **DENIED**.

### 2.3 Authoritative Profile Ingestion
The administrator profile is retrieved from MongoDB Atlas using `UserRepository.findById(session.userId)` and sanitized via `toUserDTO()`:
- `fullName`: Displayed across greetings, banners, and dossier links.
- `adminProfile.adminStaffId`: Institutional staff identifier (e.g. `ADM-010482`).
- `adminProfile.administrativeDomain`: Departmental jurisdiction (e.g. `Academic Affairs & Registry`).
- `adminProfile.assignedQueueScopes`: Array of assigned service queues (e.g. `['Student Services', 'Clearances']`).
- `adminProfile.emergencyOverridePermitted`: Default `false`.

---

## 3. Truth-in-UI & Anti-Hallucination Standards

To strictly adhere to engineering standards prohibiting fake data or phantom features:
1. **Authentic Population Metrics:** Cards query genuine document counts from MongoDB Atlas via `UserRepository.countByRole()` (`students`, `faculty`, `admins`). No fabricated counts or hardcoded numbers are shown.
2. **Phase 5 Modules Handled Gracefully with Frosted Glass Empty States:**
   - **User Directory & Provisioning:** Displays live identity provider status (Clerk + Svix webhooks) and informative notes indicating that bulk CSV user ingestion and multi-cohort directory search activate in Phase 5.
   - **Service Requisition Queue (MOD-13):** Inlines a frosted glass `EmptyState` explaining that student leave clearance tickets, bona fide certificates, and hostel passes queue here upon Phase 5 activation.
   - **College Circulars & Bulletins:** Inlines an `EmptyState` explaining that official institutional circulars and scheduled announcements activate upon Phase 5 activation.
   - **Campus Polls & Surveys:** Inlines an `EmptyState` explaining that student sentiment analysis, voting ballots, and curriculum surveys activate upon Phase 5 activation.

---

## 4. Visual Architecture & Design Tokens

### 4.1 Amber Accent Palette
- **Primary Amber Tone:** `text-amber-500`, `bg-amber-500/10`, `border-amber-500/20`, `ring-amber-500/30`.
- **Badge Variant:** `warning` (per `ROLE_PORTAL_METADATA.admin`).
- **Ambient Glow:** Translucent ambient radial gradients (`bg-amber-500/10 blur-3xl dark:bg-amber-500/15`).
- **Specular Highlights:** Top-edge specular border highlighting (`before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/15`).

### 4.2 Dual-Theme Harmony
- **Light Theme:** `bg-background` (#FFFFFF), `text-foreground` (#0F172A), amber badges with rich amber-700 text and warm amber-50 background.
- **Dark Theme:** Deep slate glass surfaces (`bg-slate-900/60`, `border-slate-800`), glowing amber highlights, crisp typography.

---

## 5. Responsive Layout Architecture

- **Desktop (>= 1024px):** 3-column asymmetric layout (2-column main administrative content + 1-column telemetry and governance sidebar).
- **Tablet (768px – 1023px):** 2-column metric cards, single-column stacked module sections.
- **Mobile (< 768px):** Single-column stacked layout with touch-friendly targets (>= 44px) and full-width navigation drawers.

