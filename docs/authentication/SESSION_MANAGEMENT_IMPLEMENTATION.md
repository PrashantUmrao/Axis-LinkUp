# Axis LinkUp — Session Management & Governance Implementation Report

> **Document ID:** DOC-AUTH-014  
> **Status:** Implemented & Verified (Phase 3, Part 3.7)  
> **Institution:** Axis Institute of Technology & Management  
> **Architecture Reference:** DOC-AUTH-006 (Session Management & Security Architecture)  
> **Standards Compliance:** NIST SP 800-63B • OWASP ASVS v4.0 • Indian DPDP Act 2023  
> **Last Updated:** November 2026  

---

## 1. Executive Summary

Phase 3, Part 3.7 implements the cryptographic session lifecycle, security controls, multi-device revocation, and account lifecycle integration for Axis LinkUp.

Session management leverages the approved **Clerk Managed IAM** infrastructure coupled with server-side MongoDB validation in `requireAuth()` and `SessionService`. This dual-layer architecture guarantees sub-10ms Edge JWT decoding on routine navigation while enforcing real-time account status checks and global revocation for suspended or compromised accounts.

### Core Guarantees Delivered:
1. **Zero Client-Side Token Storage:** Authentication JWTs and refresh tokens are strictly isolated within browser cookies configured with `HttpOnly`, `SameSite=Strict`, and `Secure` flags. No authentication credentials exist in `localStorage` or `sessionStorage`.
2. **Deterministic Expiration Timers:** 
   - **Access Tokens (JWT):** Short-lived **15-minute validity window** (900s).
   - **Rolling Inactivity Window:** **7-day inactivity refresh** (604,800s).
   - **Absolute Maximum Lifespan:** **30 days** (2,592,000s).
   - **Administrative Idle Timeout:** **30 minutes** (1,800s) for high-privilege personas.
3. **Global Multi-Device Session Invalidation:** Administrative suspension immediately executes `SessionService.revokeAllUserSessions()`, terminating all active sessions across desktop, mobile, and web clients.
4. **Resilient Logout Boundary:** Reliable sign-out via `POST /api/auth/logout` and `<SignOutButton />` with fail-safe redirection to `/sign-in`.

---

## 2. Session Lifecycle Architecture

```mermaid
stateDiagram-v2
    [*] --> SessionCreated : Sign-In / Student Registration (+ TOTP MFA)
    SessionCreated --> ActiveSession : Issue Short-Lived RS256 JWT (__session)
    ActiveSession --> ActiveSession : Rolling Background Token Refresh (<15 min)
    ActiveSession --> SessionIdle : >30 min Inactivity (Admin Only)
    ActiveSession --> SessionExpired : >7 Days Inactivity / >30 Days Absolute
    ActiveSession --> SessionRevoked : User Logout / Password Reset / Admin Revoke
    ActiveSession --> SessionSuspended : Disciplinary Hold Placed in MongoDB
    
    SessionIdle --> [*] : Redirect to /sign-in?redirect_url=...
    SessionExpired --> [*] : Redirect to /sign-in
    SessionRevoked --> [*] : Terminate Cookies & Redirect to /sign-in
    SessionSuspended --> [*] : Redirect to /account-suspended
```

---

## 3. Session Security Controls & Cookie Configuration

### 3.1 Defensive Cookie Flags
All session tokens transmitted to the browser are hardened in compliance with RFC 6265bis and OWASP standards:

| Security Parameter | Production Configuration | Threat Mitigation |
| :--- | :---: | :--- |
| **`HttpOnly`** | `true` | Prevents Cross-Site Scripting (XSS) attacks by prohibiting JavaScript access via `document.cookie`. |
| **`Secure`** | `true` (enforced in prod) | Ensures tokens are transmitted exclusively over encrypted TLS 1.3 channels. |
| **`SameSite`** | `Strict` | Eliminates Cross-Site Request Forgery (CSRF) by preventing the browser from sending cookies on third-party links. |
| **`Path`** | `/` | Confines cookie transmission strictly to the collegiate application domain. |

### 3.2 Server Actions CSRF Safeguards
Next.js App Router Server Actions inherently assert `Origin` and `Host` request headers on incoming data mutations, rejecting cross-origin POST submissions independently of cookie attributes.

---

## 4. Administrative Session Governance & Disciplinary Suspension

### 4.1 Global Session Invalidation Workflow
When an administrator executes a disciplinary suspension or security lock:
```typescript
import { SessionService } from '@/lib/auth';

// Executes atomic database status update and revokes all active device sessions
await SessionService.suspendUserWithSessionRevocation(
  mongoUserId,
  authProviderId,
  'Disciplinary suspension enforced by Academic Dean'
);
```

1. **Database Update:** The user's document in MongoDB Atlas is updated to `status: 'suspended'`.
2. **Provider Revocation:** The server queries Clerk's session registry via `clerkClient().sessions.getSessionList({ userId })` and revokes every active session ID.
3. **Ingress Lockout:** Any subsequent HTTP request by the user hits Tier-1 Edge Middleware and Tier-2 Layout Gates, immediately redirecting to `/account-suspended`.

---

## 5. Source File Map

```
src/
├── lib/
│   └── auth/
│       ├── session.ts            # Master session governance, expiration policies, & revocation service
│       ├── server.ts             # Server-side identity resolver populating sessionId in UserSession
│       └── index.ts              # Unified exports
├── app/
│   └── api/
│       └── auth/
│           └── logout/route.ts   # Server-side POST endpoint revoking active sessions on sign-out
tests/
└── unit/
    └── session-management.test.ts # Automated test suite validating lifecycle policies and revocation
```

---

## 6. Verification & Quality Gates Audit

| Verification Stage | Command | Result | Details |
| :--- | :--- | :---: | :--- |
| **Unit Test Suite** | `npm test` | ✅ **PASS** | **100/100 tests passed** across 38 test suites (0 failures, 3.23s duration) |
| **TypeScript Check** | `npm run typecheck` | ✅ **PASS** | Zero type errors (`tsc --noEmit`) |
| **ESLint Quality** | `npm run lint` | ✅ **PASS** | Zero errors, zero warnings across all source files |
| **Prettier Format** | `npm run format:check` | ✅ **PASS** | 100% compliant with project styling rules |
| **Production Build** | `npm run build` | ✅ **PASS** | Next.js 15 production build compiled all routes in 5.2s |

---

## 7. Readiness Assessment

- **Prerequisites Verified:** All authentication provider settings, user identity models, RBAC matrix, and protected routes operational.
- **Session Architecture:** Fully implemented, tested, verified, and documented.
- **Readiness:** **`READY`** for Phase 3, Part 3.8 (Multi-Factor Authentication & Account Recovery / Final Security Audit).

