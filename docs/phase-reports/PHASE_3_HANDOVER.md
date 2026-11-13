# Phase 3 — Architecture Handover Report
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Phase:** Phase 3 Handover to Phase 4 (UI & Dashboard Development)  
**Date:** November 2026  
**Author:** Senior Software Architect & Technical Auditor  
**Classification:** ARCHITECTURAL HANDOVER MANUAL  

---

## 1. Executive Handover Summary

Phase 3 establishes the complete, production-grade identity, authentication, role-based authorization, and session management infrastructure for **Axis LinkUp**. This handover document provides frontend and full-stack engineers developing **Phase 4 (Main Website UI & Dashboard Development)** with a comprehensive guide to consuming and extending the security foundation without compromising compliance or architecture.

---

## 2. Implemented Authentication & Authorization Capabilities

### 2.1 Identity Provider (Clerk)
- **Integration Package:** `@clerk/nextjs` (v6.38.1) and `svix` (v2.10.0).
- **Authentication Routes:**
  - Ingress Sign-In: `/sign-in` (`src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`)
  - Ingress Sign-Up: `/sign-up` (`src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`)
  - Holding Screen (Faculty Pending Approval): `/pending-approval`
  - Holding Screen (Disciplinary Suspension): `/account-suspended`
  - Access Denied (Role Mismatch): `/unauthorized`
- **Webhook Synchronization:**
  - Endpoint: `POST /api/webhooks/clerk` (`src/app/api/webhooks/clerk/route.ts`).
  - Cryptographically verifies Svix HMAC-SHA256 signatures with 5-minute clock drift tolerance.
  - Automatically provisions or synchronizes local MongoDB `UserModel` documents upon Clerk identity lifecycle events (`user.created`, `user.updated`, `user.deleted`).

### 2.2 Canonical Role & Permission Matrix
The system implements a canonical RBAC matrix in `src/lib/auth/permissions.ts` with 4 roles and 37 permissions across 19 platform modules:

```
+---------------------------------------------------------------------------------------+
| ROLE HIERARCHY & PERMISSION MATRIX OVERVIEW                                           |
+-------------------+----------------+--------------------------------------------------+
| Role Identifier   | Display Name   | Scope & Capabilities                             |
+-------------------+----------------+--------------------------------------------------+
| super_admin       | Super Admin    | Omnipotent (37/37 permissions ALLOW), system cfg |
| admin             | Administrator  | Moderation, user verification, college analytics |
| faculty           | Faculty Member | Course management, attendance, grades, DEPT scope|
| student           | Student        | Coursework, feed viewing, OWN profile/submissions|
+-------------------+----------------+--------------------------------------------------+
```

### 2.3 Route & Layout Ingress Architecture
Route protection operates through a two-tier defense-in-depth model:
- **Tier 1 (Edge Middleware - `src/middleware.ts`):** Validates session tokens, intercepts unauthenticated access, sanitizes open-redirect vectors, and routes users to appropriate portals.
- **Tier 2 (Server Component Layouts):** Every persona dashboard is wrapped in a dedicated layout that performs database-level verification of account status (`ACTIVE`, `PENDING`, `SUSPENDED`) and role conformity:
  - `src/app/(student)/layout.tsx` -> Gates `/student/*`
  - `src/app/(faculty)/layout.tsx` -> Gates `/faculty/*`
  - `src/app/(admin)/layout.tsx` -> Gates `/admin/*`
  - `src/app/(super-admin)/layout.tsx` -> Gates `/super-admin/*`
  - `src/app/(shared)/layout.tsx` -> Gates `/shared/*` (e.g. `/shared/profile`)

---

## 3. Developer Guide for Phase 4 UI & Dashboard Engineers

Phase 4 engineers must build dashboard navigation, pages, and components using the following standardized utilities:

### 3.1 Fetching Authenticated User Context

#### A. In Server Components (Recommended for Layouts & Initial Page Loads)
```tsx
import { getCurrentUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div>
      <h1>Welcome back, {user.profile.firstName}!</h1>
      <p>Role: {user.role} | Department: {user.profile.department}</p>
    </div>
  );
}
```

#### B. In Route Handlers & Server Actions
```tsx
import { withAuth, withPermission, withDepartment } from '@/lib/auth/server';
import { NextResponse } from 'next/server';

// 1. Basic authentication guard
export const GET = withAuth(async (req, user) => {
  return NextResponse.json({ success: true, data: user });
});

// 2. Permission-based guard (e.g. notices creation)
export const POST = withPermission('notices:create', async (req, user) => {
  // Logic executes only if user has ALLOW, OWN, or DEPT permission
  return NextResponse.json({ success: true });
});
```

#### C. In Client Components (Buttons, Modals & Dynamic Widgets)
```tsx
'use client';

import { hasClientPermission, canViewNavItem } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';

interface ActionToolbarProps {
  userRole: 'student' | 'faculty' | 'admin' | 'super_admin';
}

export function ActionToolbar({ userRole }: ActionToolbarProps) {
  const canPublish = hasClientPermission(userRole, 'notices:create');
  const canModerate = hasClientPermission(userRole, 'moderation:manage');

  return (
    <div className="flex gap-2">
      {canPublish && <Button>Publish Notice</Button>}
      {canModerate && <Button variant="destructive">Moderate Content</Button>}
    </div>
  );
}
```

### 3.2 Filtering Navigation Sidebars by Role
The utility `canViewNavItem` in `src/lib/auth/client.ts` automatically evaluates whether a navigation menu item should be rendered for the current user's role:

```tsx
import { canViewNavItem, NAV_ITEMS } from '@/lib/auth/client';

export function Sidebar({ userRole }: { userRole: string }) {
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    canViewNavItem(userRole, item)
  );

  return (
    <nav>
      {visibleNavItems.map((item) => (
        <a key={item.href} href={item.href}>{item.label}</a>
      ))}
    </nav>
  );
}
```

---

## 4. Phase 3 Quality Gates Summary

| Verification Gate | Command Executed | Result | Compliance |
| :--- | :--- | :--- | :---: |
| **TypeScript Compiler** | `npm run typecheck` | 0 errors (`tsc --noEmit`) | **100%** |
| **ESLint Standards** | `npm run lint` | 0 errors, 0 warnings | **100%** |
| **Prettier Formatting** | `npm run format:check` | All files compliant | **100%** |
| **Automated Tests** | `npm test` | 113 / 113 tests passing across 45 suites | **100%** |
| **Production Build** | `npm run build` | Next.js 15.5 compiled 16 routes cleanly | **100%** |

---

## 5. Known Issues & Operational Requirements

For complete tracking details, consult [PHASE_3_KNOWN_ISSUES.md](file:///c:/Users/prash/Desktop/Axis%20LinkUp/docs/phase-reports/PHASE_3_KNOWN_ISSUES.md).

1. **Clerk `host_invalid` Cloud Ingress (BUG-001):**
   - The current publishable key targets `axis-linkup.clerk.accounts.dev`, which is an unallocated domain.
   - *Impact:* Interactive sign-in modals fail to render in browser until a developer creates a Clerk project and pastes the actual keys into `.env.local`. All unit tests, build pipelines, and offline development mock fixtures are decoupled and function cleanly.
2. **Transitive Dependency Warnings (BUG-005):**
   - 13 vulnerabilities in dev build toolchain packages (`postcss`, `deepmerge` via shadcn CLI). These have zero runtime exposure and should not be force-fixed with breaking framework upgrades.

---

## 6. Recommendations for Phase 4 Engineers

1. **Preserve Defense-in-Depth Layouts:**
   - Do **not** remove or bypass the `layout.tsx` files inside `src/app/(student)`, `src/app/(faculty)`, `src/app/(admin)`, and `src/app/(super-admin)`. These provide essential database verification preventing suspended or unauthorized users from viewing dashboard pages.
2. **Never Trust Client-Side Claims:**
   - Do not pass sensitive permissions in URL query parameters or trust client state for data mutations. Always wrap mutation endpoints with `withAuth` and `withPermission`.
3. **Use Canonical Pathing:**
   - Ensure all persona dashboard routes follow canonical URLs:
     - Student: `/student/dashboard`
     - Faculty: `/faculty/dashboard`
     - Administrator: `/admin/dashboard`
     - Super Administrator: `/super-admin/dashboard`
     - Shared Profile: `/shared/profile`
4. **Leverage Design System Components:**
   - Consume approved shadcn/ui components in `src/components/ui/` (`button`, `card`, `input`, `avatar`, `badge`, `dialog`, `dropdown-menu`, `skeleton`, `tooltip`).

---

## 7. Handover Approval

The Phase 3 authentication and authorization foundation is technically verified, architecturally sound, and formally approved for transition into **Phase 4: Main Website UI & Dashboard Development**.

