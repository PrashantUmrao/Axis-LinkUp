# Axis LinkUp — Login, Registration & Authentication Implementation Report

> **Document ID:** DOC-AUTH-011  
> **Status:** Implemented & Verified (Phase 3, Part 3.4)  
> **Institution:** Axis Institute of Technology & Management  
> **Approved Provider:** Clerk (`@clerk/nextjs` v7) + Svix (`svix` v2)  
> **Decision Reference:** DEC-AUTH-01 (Approved)  
> **Last Updated:** November 2026  

---

## 1. Executive Implementation Summary

Phase 3, Part 3.4 establishes the complete authentication, registration, routing security, and profile synchronization foundation for the Axis LinkUp platform.

All security requirements established in the Phase 3.1 architecture and Phase 3.3 data models have been physically implemented and verified with zero build or lint warnings.

### Key Guarantees Delivered:
1. **Zero Raw Password Storage:** Authentication credentials, hashing, brute-force defenses, and passwordless authentication are managed securely by Clerk's SOC-2 Type II infrastructure. No passwords or password hashes exist in MongoDB Atlas.
2. **Strict Ingress Segregation:** Self-registration is strictly confined to enrolled students. Administrative and faculty accounts are protected against public self-registration.
3. **Defense-in-Depth Pipeline:** Tier-1 Next.js Edge Middleware intercepts unauthenticated or unauthorized route navigation before serverless compute executes.
4. **Tamper-Resistant Role Claims:** Identity roles (`student`, `faculty`, `admin`, `super_admin`) are stored in server-managed `publicMetadata`, preventing client-side privilege escalation.
5. **Cryptographic Identity Synchronization:** Inbound lifecycle events (`user.created`, `user.updated`, `user.deleted`) are verified with HMAC-SHA256 signatures via Svix headers before persisting to MongoDB Atlas.

---

## 2. Implemented Architecture & Source Map

```
src/
├── app/
│   ├── layout.tsx                                      # Root layout wrapped in ClerkProvider with AITM design tokens
│   ├── (auth)/
│   │   ├── layout.tsx                                  # Centered collegiate auth layout with crest, navbar, & security badges
│   │   ├── sign-in/[[...sign-in]]/page.tsx             # Customized Clerk SignIn with institutional branding
│   │   ├── sign-up/[[...sign-up]]/page.tsx             # Student-only self-registration with policy banner
│   │   ├── account-suspended/page.tsx                  # Administrative hold screen with Dean/Registrar contacts
│   │   └── pending-approval/page.tsx                   # Registrar roster verification holding screen
│   └── api/
│       └── webhooks/
│           └── clerk/route.ts                          # Svix-verified HMAC-SHA256 user synchronization handler
├── middleware.ts                                       # Tier-1 Edge Ingress Guard with route-group boundary enforcement
├── lib/
│   ├── db/
│   │   └── repositories/user.repository.ts             # DAL updates: syncExternalProfile and linkAuthProviderId
│   └── services/
│       ├── invitation.service.ts                       # Faculty and staff administrative invitation engine
│       └── index.ts                                    # Service barrel exports
scripts/
└── create-super-admin.ts                               # Closed CLI provisioning tool for Super Administrators
tests/
└── unit/
    └── auth-system.test.ts                             # Svix signature verification and ingress routing test suite
```

---

## 3. Detailed Component Breakdown

### 3.1 Edge Middleware Ingress (`src/middleware.ts`)
- Employs Clerk v7 `clerkMiddleware()` with `createRouteMatcher()`.
- **Public Routes:** `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/account-suspended`, `/pending-approval`, `/api/health(.*)`, `/api/webhooks(.*)`, `/ui-preview`.
- **Role Ingress Gates:**
  - `/student(.*)`: Requires authenticated user with `role === 'student'` (or admin/super_admin).
  - `/faculty(.*)`: Requires authenticated user with `role === 'faculty'` (or admin/super_admin).
  - `/admin(.*)`: Requires authenticated user with `role === 'admin'` or `'super_admin'`.
  - `/super-admin(.*)`: Requires authenticated user with `role === 'super_admin'`.
- **Account Status Enforcements:**
  - `status === 'suspended'` navigators are intercepted and redirected to `/account-suspended`.
  - `status === 'pending_verification'` navigators are intercepted and redirected to `/pending-approval`.
- **Seamless Return Redirection:** Injects `redirect_url` query parameters on unauthenticated attempts to resume workflows post-login.

### 3.2 Cryptographic Webhook Synchronization (`src/app/api/webhooks/clerk/route.ts`)
- Verifies headers `svix-id`, `svix-timestamp`, and `svix-signature` against `CLERK_WEBHOOK_SECRET`.
- Rejects tampered payloads or missing headers with `HTTP 400 Bad Request`.
- **Event Handlers:**
  - `user.created`: Checks for existing pre-provisioned user by email. If found, links `authProviderId`. If not, creates new user document adhering to role schema subdocument requirements (`studentProfile`, `facultyProfile`, or `adminProfile`).
  - `user.updated`: Synchronizes profile attributes (`fullName`, `avatarUrl`, email) in MongoDB.
  - `user.deleted`: Enforces soft-deactivation (`status: 'deactivated'`) to maintain relational integrity and audit trails.

### 3.3 Administrative Provisioning CLI (`scripts/create-super-admin.ts`)
- Super Administrator accounts **cannot** be created through public browser sign-ups.
- Execution requires explicit CLI invocation with domain validation:
  ```bash
  npx tsx scripts/create-super-admin.ts --email=admin.lead@axiscolleges.in --name="Campus IT Director"
  ```
- Rejects any email not ending with `@axiscolleges.in`.
- Configures full administrative scopes: `adminStaffId: SA-AITM-XXXX`, `administrativeDomain: 'Central IT Administration'`, and `emergencyOverridePermitted: true`.

### 3.4 Faculty Invitation Gateway (`src/lib/services/invitation.service.ts`)
- Pre-provisions faculty profiles in MongoDB Atlas with status `'invited'`.
- Enforces institutional email constraints (`@axiscolleges.in`).
- Dispatches signed invitation links via Clerk Server SDK.

---

## 4. Verification & Quality Gates

All five mandatory engineering verification checks passed cleanly:

1. **TypeScript Typecheck:** `npm run typecheck` (`tsc --noEmit`) -> **0 errors**.
2. **ESLint Code Quality:** `npm run lint` (`eslint`) -> **0 errors, 0 warnings**.
3. **Prettier Formatting:** `npm run format:check` -> **100% formatted**.
4. **Unit Test Suite:** `npm test` -> **34 tests passing across 13 suites, 0 failures**.
5. **Next.js Production Build:** `npm run build` -> **Compiled and bundled successfully**.

