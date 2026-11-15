# Axis LinkUp — Role-Based Login, Authentication & Dashboard Routing Implementation Report

**Document ID:** `DOC-AUTH-008`  
**Phase:** 5.4.2 — Role-Based Ingress & Dashboard Routing Resolution  
**Status:** Approved & Verified  
**Date:** November 15, 2026  
**Audience:** System Administrators, Security Reviewers, Collegiate DevOps  

---

## 1. Executive Summary

This phase resolved a critical routing issue in Axis LinkUp where authenticating via any of the three portal doors (**Student Portal**, **Faculty Portal**, or **Admin Portal**) indiscriminately redirected users to the **Student Dashboard** (`/student/dashboard`).

A comprehensive, zero-trust server-side verification and routing architecture was designed and implemented. All 13 mandated collegiate login, ingress, and authorization test scenarios have been authoritatively implemented and verified. The full automated test suite (496 tests across 144 suites), TypeScript typecheck, ESLint, and Next.js production build (`npm run build`) pass with 100% success and 0 errors.

---

## 2. Root Cause Analysis of the Original Routing Bug

A thorough audit of the authentication and ingress pipeline identified four cascading failure points that led to the universal redirection to `/student/dashboard`:

1. **Clerk JWT Token Session Claims Default Behavior:**  
   In Clerk, the session JWT token does not include custom claims from `user.publicMetadata` unless a custom Session Token template named `default` is manually defined in the Clerk Dashboard. Because `sessionClaims?.publicMetadata` was undefined in Edge runtime requests, `src/middleware.ts` evaluated:
   ```typescript
   const role = metadata.role || 'student';
   ```
   This silently defaulted every user's role to `'student'`.

2. **Middleware Interception on `/sign-in`:**  
   In `src/middleware.ts` (lines 80–90), an ingress interceptor was configured:
   ```typescript
   if (userId && (currentPath.startsWith('/sign-in') || currentPath.startsWith('/sign-up'))) {
     return NextResponse.redirect(new URL(getRoleDashboard(role), req.url));
   }
   ```
   When any user authenticated on `/sign-in?portal=faculty` or `/sign-in?portal=admin`, Clerk finished authentication on `/sign-in`. The middleware immediately intercepted the request before it could reach Clerk's target redirect URL, observed that `userId` was present, evaluated the defaulted role `'student'`, and issued an HTTP 307 redirect to `/student/dashboard`. Furthermore, if an authenticated user clicked any portal door card from the home page, the same interceptor kicked in and immediately routed them to `/student/dashboard`.

3. **Absence of a Server-Side Post-Login Verification Gate:**  
   The application lacked an authoritative, server-side callback to verify that the credentials authenticated by Clerk matched the portal door selected by the user (`?portal=student|faculty|admin`), leaving cross-portal access completely unvalidated.

4. **Incomplete Sub-Role Routing Hierarchy in `getRoleDashboard`:**  
   The existing `getRoleDashboard(role)` helper only mapped top-level roles and lacked knowledge of collegiate administrative sub-roles (`adminSubRole: 'hod' | 'director' | 'sys_admin'`), preventing Department HODs, Executive Directors, and System Administrators from being cleanly routed to their designated workspaces.

---

## 3. Architecture & Authentication Flow

### 3.1 Three-Door Collegiate Ingress Flow
```
[Home Page / Sign-In]
        │
        ├──> Student Portal   (?portal=student)
        ├──> Faculty Portal   (?portal=faculty)
        └──> Admin Portal     (?portal=admin)
                 │
                 ▼
     [RoleLoginForm (Clerk SignIn)]
  (forceRedirectUrl = /auth/verify-role?portal=...)
                 │
                 ▼
    [Tier-2 Server Gate: /auth/verify-role]
  ┌──────────────────────────────────────────────────────────┐
  │ 1. auth() extracts authenticated userId.                 │
  │ 2. Queries MongoDB Atlas authoritatively by authId.      │
  │    (Fallback: primary email/username + auto-linking)     │
  │ 3. Enforces Closed Registration (unprovisioned -> 403).  │
  │ 4. Asserts Account Status (suspended/pending/inactive).  │
  │ 5. Validates Role vs Selected Portal (Zero-Trust Gate).  │
  │ 6. Syncs Clerk publicMetadata in background.             │
  │ 7. Evaluates getRoleDashboard(user.role, adminSubRole).  │
  └──────────────────────────────────────────────────────────┘
                 │
     ┌───────────┴───────────┐
  Match                   Mismatch
     │                       │
     ▼                       ▼
[Target Dashboard]     [/role-mismatch]
- /student/dashboard    (Clear institutional
- /faculty/dashboard     separation message,
- /admin/dashboard       sign-out button, return
- /super-admin/dashboard to portal selection)
```

### 3.2 Dual-Tier Defense-in-Depth Protection
1. **Tier-1 (Edge Runtime - `middleware.ts`):**  
   - Inspects `sessionClaims.publicMetadata`.
   - If `userId` hits `/sign-in` with `?portal=...`, forwards directly to `/auth/verify-role` to perform an authoritative check.
   - For protected routes (`/super-admin/*`, `/admin/*`, `/faculty/*`, `/student/*`), if the user's role is known and unauthorized, immediately redirects them to their own authorized dashboard (`getRoleDashboard(role, adminSubRole)`).
   - If `role` is not yet present in the JWT, passes through to Tier-2.
2. **Tier-2 (Server Component Layouts - `layout.tsx`):**  
   - Every layout (`(student)/layout.tsx`, `(faculty)/layout.tsx`, `(admin)/layout.tsx`, `(super-admin)/layout.tsx`) calls `getCurrentSession()`, querying MongoDB Atlas directly.
   - Strictly asserts `session.role` and `session.status`.
   - Unauthorized attempts immediately redirect the user to their authorized portal via `getRoleDashboard(session.role, session.adminSubRole)`.

---

## 4. Role-to-Dashboard Routing Table

| Collegiate Persona | Primary Role | Admin Sub-Role | Selected Portal Door | Verification Outcome | Final Authorized Destination |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Enrolled Student** | `student` | `null` | Student Portal (`portal=student`) | **Approved** | `/student/dashboard` |
| **Faculty Member** | `faculty` | `null` | Faculty Portal (`portal=faculty`) | **Approved** | `/faculty/dashboard` |
| **Department HOD** | `admin` | `hod` | Admin Portal (`portal=admin`) | **Approved** | `/admin/dashboard` |
| **Executive Director** | `super_admin` | `director` | Admin Portal (`portal=admin`) | **Approved** | `/admin/dashboard` |
| **System Administrator** | `super_admin` | `sys_admin` | Admin Portal (`portal=admin`) | **Approved** | `/super-admin/dashboard` |
| **Student** attempting Faculty | `student` | `null` | Faculty Portal (`portal=faculty`) | **REJECTED (Mismatch)** | `/role-mismatch?expected=faculty&actual=student` |
| **Student** attempting Admin | `student` | `null` | Admin Portal (`portal=admin`) | **REJECTED (Mismatch)** | `/role-mismatch?expected=admin&actual=student` |
| **Faculty** attempting Admin | `faculty` | `null` | Admin Portal (`portal=admin`) | **REJECTED (Mismatch)** | `/role-mismatch?expected=admin&actual=faculty` |
| **Faculty** attempting Student | `faculty` | `null` | Student Portal (`portal=student`) | **REJECTED (Mismatch)** | `/role-mismatch?expected=student&actual=faculty` |
| **Suspended Account** | *Any* | *Any* | *Any* | **BLOCKED (Hold)** | `/account-suspended` |
| **Pending Verification** | *Any* | *Any* | *Any* | **BLOCKED (Unverified)** | `/pending-approval` |
| **Unprovisioned User** | *None* | *None* | *Any* | **BLOCKED (Closed IAM)** | `/unauthorized?error=not_provisioned` |
| **Direct URL Access** (Student to `/faculty/*`) | `student` | `null` | *Direct URL* | **REJECTED & REROUTED** | `/student/dashboard` |
| **Direct URL Access** (Faculty to `/admin/*`) | `faculty` | `null` | *Direct URL* | **REJECTED & REROUTED** | `/faculty/dashboard` |

---

## 5. Files Created and Modified

### Created Files
1. `src/lib/auth/routing.ts` — Centralized collegiate persona routing, portal compatibility validation, route authorization, and redirect sanitization.
2. `src/app/auth/verify-role/page.tsx` — Server-side zero-trust post-login verification gate querying MongoDB Atlas and checking account status and portal matching.
3. `src/app/(auth)/role-mismatch/page.tsx` — Dedicated institutional clearance mismatch experience offering clear messaging, return to authorized dashboard, or Clerk sign-out.
4. `tests/unit/role-auth-routing.test.ts` — Comprehensive unit test suite implementing all 13 required test scenarios.
5. `docs/phase-5/PHASE_5_ROLE_AUTH_ROUTING_IMPLEMENTATION_REPORT.md` — Complete architectural and implementation sign-off report.

### Modified Files
1. `src/middleware.ts` — Re-architected Edge Ingress: added `/auth/verify-role` and `/role-mismatch` to public routes, routed authenticated sign-in hits with query parameters to the verification gate, and updated cross-role route denials to redirect unauthorized users to their authorized portal.
2. `src/components/auth/role-login-form.tsx` — Routed Clerk `<SignIn />` completion directly to `/auth/verify-role?portal=${portal}`, and rendered security error banners when role mismatch parameters are present.
3. `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` — Added query parameter handling for error alerts (`role_mismatch`, `not_provisioned`, `inactive_account`).
4. `src/lib/auth/index.ts` — Exported master routing utilities.
5. `src/lib/db/repositories/user.repository.ts` — Added `findByAdminStaffId` query helper for administrative account pre-flight checks.
6. `src/lib/validations/provision.schema.ts` — Added `provisionAdminSchema` for authorized administrative account provisioning.
7. `src/lib/services/provisioning.service.ts` — Added `provisionAdminAccount` method supporting administrative sub-roles and admin profile structures.
8. `src/lib/services/activation.service.ts` — Synchronized `adminSubRole` to Clerk `publicMetadata` during OTP account activation.
9. `src/app/(student)/layout.tsx` — Tier-2 Server Component Layout Ingress: redirects unauthorized users to their authorized dashboard via `getRoleDashboard`.
10. `src/app/(faculty)/layout.tsx` — Tier-2 Server Component Layout Ingress: redirects unauthorized users to their authorized dashboard via `getRoleDashboard`.
11. `src/app/(admin)/layout.tsx` — Tier-2 Server Component Layout Ingress: redirects unauthorized users to their authorized dashboard via `getRoleDashboard`.
12. `src/app/(super-admin)/layout.tsx` — Tier-2 Server Component Layout Ingress: redirects unauthorized users to their authorized dashboard via `getRoleDashboard`.
13. `src/components/notices/notice-detail-dialog.tsx` — Added safe optional chaining for author snapshots and DTO field access.
14. `src/components/polls/poll-card.tsx` — Added safe optional chaining for poll creator and selected option projections.
15. `src/components/notices/notice-form-dialog.tsx` — Removed unused import.
16. `tests/unit/notices-polls-frontend-e2e.test.ts` — Corrected test fixture notice category, removed unused imports, and updated type assertions.

---

## 6. Verification & Quality Gates Results

| Check / Gate | Target / Standard | Result | Status |
| :--- | :--- | :--- | :--- |
| **All Required Scenarios (1-13)** | `tests/unit/role-auth-routing.test.ts` | 13/13 passed | **PASS (100%)** |
| **Total Test Suite (`npm test`)** | 144 test suites | 496/496 tests passed (0 failures) | **PASS (100%)** |
| **TypeScript Typecheck** | `npx tsc --noEmit` | 0 errors | **PASS** |
| **ESLint Quality Check** | `npm run lint` | 0 errors, 0 warnings | **PASS** |
| **Production Build** | `npm run build` | 28/28 routes compiled cleanly | **PASS** |

---

## 7. Remaining Manual Configuration Requirements

For production environments connected to live Clerk Dashboard and MongoDB Atlas instances:

1. **Clerk Session Token JWT Template (Recommended Optimization):**  
   In the Clerk Dashboard under **Configure > Sessions > Customize Session Token**, add custom claims to the default JWT template:
   ```json
   {
     "publicMetadata": "{{user.public_metadata}}"
   }
   ```
   *Note:* Even if this is omitted or pending, our Tier-2 Server Component Layouts and `/auth/verify-role` gate authoritatively query MongoDB Atlas directly, guaranteeing zero-trust security.
2. **MongoDB Atlas Production Connectivity:**  
   Ensure the `MONGODB_URI` environment variable is active and whitelist the application hosting environment IP addresses.

