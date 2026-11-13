# Role-Based Navigation & Access Governance
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Security Architecture Principles

### 1.1 Server-Authoritative Identity Principle
The authenticated user's role is **exclusively resolved on the server** via `getCurrentSession()` in Server Component layouts. The resolved role is extracted from MongoDB Atlas documents (or cryptographically signed Clerk session claims) and passed as immutable props to presentation components.

```
[Clerk Session Cookie]
          │
          ▼
Server Layout Ingress Gate (`getCurrentSession()`)
          │
          ├── Evaluates MongoDB Atlas `users` Collection
          ├── Verifies Account Status (Active, Suspended, Pending)
          ├── Validates Role Hierarchy & Permissions
          │
          ▼
`<AppShell user={session}>{children}</AppShell>` (Server-to-Client Boundary)
          │
          ▼
`getNavigationForRole(user.role)` (Centralized Filter)
```

### 1.2 Defense-in-Depth Model
Client-side hiding of navigation elements is **purely a UX optimization** to prevent visual clutter. It **NEVER replaces server-side authorization**:
- **Tier 1 (Edge Middleware Ingress):** `src/middleware.ts` intercepts requests before execution and rejects unauthorized role paths.
- **Tier 2 (Server Component Layout Ingress):** Route group layouts (`(student)/layout.tsx`, etc.) invoke `getCurrentSession()` and redirect unauthorized callers to `/unauthorized`.
- **Tier 3 (Server Actions & Route Handlers):** Individual endpoints invoke `requireAuth()`, `requireRole()`, and `requirePermission()`.

---

## 2. Persona Navigation Matrices

### 2.1 Student Persona (`student`)
- **Portal Title:** Student Portal
- **Default Dashboard:** `/student/dashboard`
- **Primary Workspace:**
  - `Dashboard` (`/student/dashboard`, Permission: `student_dash:view`) — **Live**
- **Authorized Modules (Phase 5):**
  - `Campus Notices` (`/student/notices`, Permission: `notices:read`, `disabled: true`)
  - `Assignments` (`/student/assignments`, Permission: `assignments:submit`, `disabled: true`)
  - `Academic Calendar` (`/student/calendar`, Permission: `calendar:view`, `disabled: true`)
  - `Skill Passport` (`/student/passport`, Permission: `passport:submit_proof`, `disabled: true`)
- **Account:**
  - `Profile & Settings` (`/shared/profile`, Permission: `users:read_own`) — **Live**

### 2.2 Faculty Persona (`faculty`)
- **Portal Title:** Faculty Cockpit
- **Default Dashboard:** `/faculty/dashboard`
- **Primary Workspace:**
  - `Dashboard` (`/faculty/dashboard`, Permission: `faculty_dash:view`) — **Live**
- **Authorized Modules (Phase 5):**
  - `Course Notices` (`/faculty/notices`, Permission: `notices:publish_course`, `disabled: true`)
  - `Grading & Submissions` (`/faculty/assignments`, Permission: `assignments:create_grade`, `disabled: true`)
  - `Course Polls` (`/faculty/polls`, Permission: `polls:create_course`, `disabled: true`)
- **Account:**
  - `Profile & Settings` (`/shared/profile`, Permission: `users:read_own`) — **Live**

### 2.3 Administrator Persona (`admin`)
- **Portal Title:** Department Console
- **Default Dashboard:** `/admin/dashboard`
- **Primary Workspace:**
  - `Dashboard` (`/admin/dashboard`, Permission: `admin_dash:view`) — **Live**
- **Authorized Modules (Phase 5):**
  - `College Circulars` (`/admin/notices`, Permission: `notices:publish_college`, `disabled: true`)
  - `Service Queues` (`/admin/requests`, Permission: `requests:approve_reject`, `disabled: true`)
  - `Facility Bookings` (`/admin/spaces`, Permission: `spaces:approve`, `disabled: true`)
- **Account:**
  - `Profile & Settings` (`/shared/profile`, Permission: `users:read_own`) — **Live**

### 2.4 Super Administrator Persona (`super_admin`)
- **Portal Title:** Central Executive Console
- **Default Dashboard:** `/super-admin/dashboard`
- **Primary Workspace:**
  - `Executive Console` (`/super-admin/dashboard`, Permission: `super_admin:view_telemetry`) — **Live**
  - `Dashboard` (`/admin/dashboard`, Permission: `admin_dash:view`) — **Live**
- **Authorized Modules (Phase 5):**
  - `IAM Governance` (`/super-admin/roles`, Permission: `rbac:modify_roles`, `disabled: true`)
  - `Security Audit Logs` (`/super-admin/audit`, Permission: `audit:view_logs`, `disabled: true`)
  - `Emergency Console` (`/super-admin/emergency`, Permission: `emergency:trigger`, `disabled: true`)
  - `College Circulars` (`/admin/notices`, Permission: `notices:publish_college`, `disabled: true`)
  - `Service Queues` (`/admin/requests`, Permission: `requests:approve_reject`, `disabled: true`)
  - `Facility Bookings` (`/admin/spaces`, Permission: `spaces:approve`, `disabled: true`)
- **Account:**
  - `Profile & Settings` (`/shared/profile`, Permission: `users:read_own`) — **Live**

---

## 3. Strict RBAC Matrix Alignment

Every item in `MASTER_NAVIGATION_ITEMS` with an associated `permission` property is verified against the single source of truth in `ROLE_PERMISSIONS_MATRIX` (`src/lib/auth/permissions.ts`):

- No navigation item is rendered for a role if its corresponding RBAC matrix permission is `'DENY'`.
- All navigation filtering is verified automatically via unit tests in `tests/unit/navigation.test.ts`.

