# Phase 3 — Bug & Vulnerability Tracking Report
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Component:** Phase 3: Authentication, Authorization & Session Management  
**Audit Date:** November 2026  
**Auditor:** Senior Full-Stack Engineer & Application Security Reviewer  
**Status:** 4 RESOLVED / 1 MONITORED / 1 PENDING CREDENTIAL SETUP  

---

## 1. Defect Severity & Classification Standard

Each identified defect or vulnerability is classified using the following risk matrix:

| Severity Level | Definition | Action Required |
| :--- | :--- | :--- |
| **CRITICAL** | System-wide outage, authentication bypass, remote code execution, or unauthenticated data leak. | Immediate hotfix prior to any milestone progression. |
| **HIGH** | Major feature unavailable, security control degradation, or external service communication block. | Fix required before production staging or live pilot. |
| **MEDIUM** | Non-critical functionality defect, build failure in specific configurations, or performance degradation. | Fix prior to phase closure. |
| **LOW** | Minor code inconsistency, dev toolchain warning, or cosmetic issue with zero runtime impact. | Remediate in maintenance cycle. |

---

## 2. Bug Tracking Matrix

| Bug ID | Severity | Component | Summary | Current Status |
| :--- | :---: | :--- | :--- | :---: |
| **BUG-001** | **HIGH** | Clerk Integration | Clerk Cloud Ingress `host_invalid` error due to unallocated placeholder publishable key domain | **PENDING CONFIG** |
| **BUG-002** | **MEDIUM** | App Router | Next.js App Router route group parallel page collision for `/dashboard` | **RESOLVED** |
| **BUG-003** | **LOW** | API Route (`/api/auth/me`) | Missing named export `toUserDTO` in validation schema import | **RESOLVED** |
| **BUG-004** | **LOW** | Dev Environment | Windows PowerShell multiline subshell hang during headless test runs | **RESOLVED** |
| **BUG-005** | **LOW** | Build Tooling | Transitive vulnerabilities in dev toolchain (`postcss`, `deepmerge`) | **MONITORED** |

---

## 3. Comprehensive Defect Analysis & Resolution

### BUG-001: Clerk Cloud Ingress `host_invalid` Configuration Defect
- **Classification:** HIGH (External Integration / Environment Configuration)
- **First Detected:** Part 3.7 / Part 3.8 Preflight Inspection
- **Affected Components:** Client-side Clerk authentication components (`<SignIn />`, `<SignUp />`), live browser login flows.
- **Description & Reproduction:**
  When executing HTTP client requests to the Clerk Frontend API using the configured test key:
  ```bash
  curl -i -H "Authorization: Bearer pk_test_YXhpcy1saW5rdXAuY2xlcmsuYWNjb3VudHMuZGV2JA" \
       https://axis-linkup.clerk.accounts.dev/v1/client
  ```
  The Clerk cloud edge responds with HTTP 400 Bad Request:
  ```json
  {
    "errors": [
      {
        "message": "We were unable to attribute this request to an instance running on Clerk. Make sure that your Clerk Publishable Key is correct.",
        "long_message": "We were unable to attribute this request to an instance running on Clerk. Make sure that your Clerk Publishable Key is correct.",
        "code": "host_invalid"
      }
    ]
  }
  ```
- **Root Cause Analysis:**
  Clerk publishable keys encode the Frontend API hostname in base64. Decoding `pk_test_YXhpcy1saW5rdXAuY2xlcmsuYWNjb3VudHMuZGV2JA` yields `axis-linkup.clerk.accounts.dev$`. This subdomain has not been registered or claimed on Clerk's cloud infrastructure at `https://dashboard.clerk.com`.
- **System Impact:**
  - Automated tests (`npm test`): **UNIMPACTED** (utilize deterministic cryptographic mock fixtures).
  - Next.js production build (`npm run build`): **UNIMPACTED** (builds successfully with clean static and dynamic compilation).
  - Runtime live browser execution: **BLOCKED** until valid developer instance credentials replace the placeholder key in `.env.local`.
- **Remediation:**
  Documented in detail in `docs/phase-reports/PHASE_3_REMEDIATION_REPORT.md`. Requires copying real API keys from an active Clerk dashboard application.

---

### BUG-002: Next.js App Router Route Group Parallel Page Collision
- **Classification:** MEDIUM (Architecture / Next.js App Router)
- **First Detected:** Part 3.6 Route Protection Implementation
- **Affected Components:** Next.js Build Engine (`next build`), layout route groups.
- **Description:**
  Running `npm run build` failed with the following fatal error:
  ```
  Error: You cannot have two parallel pages that resolve to the same path.
  Please check /(admin)/dashboard/page and /(faculty)/dashboard/page.
  Refer to the route group docs for more info.
  ```
- **Root Cause Analysis:**
  In Next.js App Router, parentheses in folder names `(name)` denote route groups for layout organization and do **not** add URL path segments. Defining `dashboard/page.tsx` within `src/app/(admin)`, `src/app/(faculty)`, `src/app/(student)`, and `src/app/(super-admin)` created four conflicting handlers competing for the identical URL path `/dashboard`.
- **Resolution Applied:**
  Nested the dashboard pages inside explicit persona directory segments:
  - `src/app/(student)/student/dashboard/page.tsx` -> Resolves to `/student/dashboard`
  - `src/app/(faculty)/faculty/dashboard/page.tsx` -> Resolves to `/faculty/dashboard`
  - `src/app/(admin)/admin/dashboard/page.tsx` -> Resolves to `/admin/dashboard`
  - `src/app/(super-admin)/super-admin/dashboard/page.tsx` -> Resolves to `/super-admin/dashboard`
  - `src/app/(shared)/shared/profile/page.tsx` -> Resolves to `/shared/profile`
- **Verification:**
  `npm run build` compiled all routes without collisions.

---

### BUG-003: Incorrect DTO Module Import in Auth Me Route Handler
- **Classification:** LOW (Code Quality / Typo)
- **First Detected:** Part 3.6 TypeScript Verification
- **Affected Components:** `src/app/api/auth/me/route.ts`
- **Description:**
  TypeScript compilation failed with error:
  ```
  TS2305: Module '"@/lib/validations/user.schema"' has no exported member 'toUserDTO'.
  ```
- **Root Cause Analysis:**
  The `toUserDTO` serialization function was implemented and exported from `@/lib/db/models/user.model.ts`, but the route handler mistakenly attempted to import it from `@/lib/validations/user.schema.ts`.
- **Resolution Applied:**
  Updated the import statement in `src/app/api/auth/me/route.ts` to source `toUserDTO` directly from `@/lib/db/models/user.model`.
- **Verification:**
  `npm run typecheck` passed with 0 errors.

---

### BUG-004: Windows PowerShell Subshell Execution Hang
- **Classification:** LOW (Developer Experience / Testing Automation)
- **First Detected:** Part 3.8 Test Automation
- **Affected Components:** Windows PowerShell terminal sessions executing Node subshells.
- **Description:**
  Multi-line commands passing inline scripts via `node -e @"..."@` hung indefinitely waiting for interactive standard input in the Windows console environment.
- **Root Cause Analysis:**
  PowerShell scriptblock evaluation handles quoted multiline strings differently from POSIX bash shells, causing standard input pipes to remain open without transmitting EOF signals.
- **Resolution Applied:**
  Standardized test execution through dedicated test scripts and clean single-line invocation commands (`npm test`).
- **Verification:**
  All automated test commands run synchronously within ~3.6 seconds.

---

### BUG-005: Transitive Dependency Vulnerabilities in Build Toolchain
- **Classification:** LOW (Supply Chain / Dev Tooling)
- **First Detected:** Part 3.8 Security Audit (`npm audit`)
- **Affected Components:** `postcss` (via `next`), `deepmerge` (via `@shadcn/ui` CLI scaffolding).
- **Description:**
  `npm audit` reports 13 vulnerabilities in transitive packages:
  - 2 Low severity
  - 10 Moderate severity (`postcss` unescaped line breaks)
  - 1 High severity (`deepmerge` prototype pollution in CLI configuration)
- **Impact Assessment:**
  These packages are not included in runtime production bundles and run exclusively during offline build steps or interactive developer UI component scaffolding. There is zero exposure to untrusted user input at runtime.
- **Resolution Plan:**
  Monitor upstream Next.js and shadcn releases for patched dependency updates. No immediate breaking updates required.

