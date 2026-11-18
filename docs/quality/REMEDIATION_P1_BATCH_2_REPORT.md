# P1 Remediation Batch 2 — Auth Anti-Enumeration, Session Revocation, DB/Error Reliability, URL/Regex Sanitization & Prod Dependency Audit

**Status:** Completed & Verified  
**Targeted Audit Findings:** `AUD-H11`, `AUD-M05`, `AUD-H12`, `AUD-H15`, `AUD-M01`, `AUD-M02`, `AUD-M04`, `AUD-H18`  
**Scope Discipline:** Strictly confined to public auth anti-enumeration & rate limiting, directory PII minimization, session revocation & uniform lifecycle gates, MongoDB reconnect & repository connection guards, cycle-safe logging, API error sanitization, `http(s)` URL protocol enforcement, regex escaping, admin user PATCH hardening, and removal of unused production dependencies (`shadcn`, `cn`). Dashboard mock widgets, broken frontend links, `NoticeDetailDialog`, `ChatLayout`, and residual calendar UI components remain untouched for P2-1. Academic Calendar (MOD-10) remains permanently excluded.

---

## 1. Exact Files Modified & Created

### 1.1 Auth Anti-Enumeration, Rate Limiting & Directory PII (`AUD-H11`, `AUD-M05`)
| File | Action | Summary |
| :--- | :--- | :--- |
| `src/lib/services/password-recovery.service.ts` | Modified | Removed raw unmasked `email` from `requestRecovery()` response; suppressed OTP dispatch uniformly for `suspended`, `deactivated`, `archived`, and `graduated` accounts; masked email in warning logs |
| `src/lib/services/otp.service.ts` | Modified | Replaced 404/403 account-existence and status-leaking errors in `requestOtp()` with uniform silent suppression returning a masked generic response |
| `src/lib/services/activation.service.ts` | Modified | Reordered `validateInvitation()` to verify timing-safe SHA-256 token proof BEFORE checking account existence or lifecycle status, returning a uniform `ValidationError` to callers lacking the secret invitation token |
| `src/app/api/v1/auth/otp/resend/route.ts` | Modified | Added `checkRateLimit` (`5/60s` per IP -> HTTP `429` + `Retry-After`) |
| `src/app/api/v1/auth/otp/verify/route.ts` | Modified | Added `checkRateLimit` (`10/60s` per IP -> HTTP `429` + `Retry-After`) |
| `src/app/api/v1/auth/activation/validate/route.ts` | Modified | Added `checkRateLimit` (`15/60s` per IP -> HTTP `429` + `Retry-After`) |
| `src/app/api/v1/auth/activation/complete/route.ts` | Modified | Added `checkRateLimit` (`5/60s` per IP -> HTTP `429` + `Retry-After`) |
| `src/app/api/v1/auth/password-recovery/reset/route.ts` | Modified | Added `checkRateLimit` (`5/60s` per IP -> HTTP `429` + `Retry-After`) |
| `src/app/api/v1/users/search/route.ts` | Modified | Added `checkRateLimit` (`30/60s` per user) and stripped `email` & `rollNumber` PII when caller is `student` (`AUD-M05`) |
| `src/app/api/v1/chat/users/route.ts` | Modified | Added `checkRateLimit` (`30/60s` per user) and stripped `email` & `rollNumber` PII when caller is `student` (`AUD-M05`) |
| `src/app/api/v1/chat/token/route.ts` | Modified | Added `checkRateLimit` (`20/60s` per user -> HTTP `429` + `Retry-After`) |

### 1.2 Session Revocation & Uniform Lifecycle Enforcement (`AUD-H12`)
| File | Action | Summary |
| :--- | :--- | :--- |
| `src/lib/services/iam-governance.service.ts` | Modified | Wired non-blocking `SessionService.revokeAllUserSessions()` on account suspension/deactivation (`changeUserStatus`) and role mutations (`changeUserRole`) |
| `src/lib/services/user.service.ts` | Modified | Wired non-blocking `SessionService.revokeAllUserSessions()` on `updateUserStatus` (non-active transitions) and `updateUserRole` |
| `src/lib/auth/session.ts` | Modified | Enforced `userStatus !== 'active'` uniformly in `validateSessionIntegrity()` (covering `suspended`, `pending_verification`, `invited`, `deactivated`, `archived`, `graduated`) |
| `src/lib/auth/server.ts` | Modified | Enforced `effectiveStatus !== 'active'` uniformly in `requireAuth()` (rejecting `invited`, `graduated`, `archived`, `deactivated`, `pending_verification`, `suspended` with `403`) |
| `src/lib/auth/routing.ts` | Modified | Added edge-safe `evaluateAccountLifecycleGate()` returning JSON `403` for non-active `/api/*` requests, permitting `/api/auth/logout`, and routing page requests cleanly |
| `src/middleware.ts` | Modified | Permitted `/api/auth/logout` in `isPublicRoute`, replaced partial status redirects with `evaluateAccountLifecycleGate()` so non-active `/api/*` requests receive JSON HTTP `403` instead of `307` HTML redirects |
| `src/app/(student)/layout.tsx`, `src/app/(faculty)/layout.tsx`, `src/app/(admin)/layout.tsx`, `src/app/(super-admin)/layout.tsx`, `src/app/(shared)/layout.tsx` | Modified | Enforced uniform `status !== 'active'` gating across all 5 portal layouts (redirecting `invited`/`pending_verification` to `/pending-approval`, `suspended` to `/account-suspended`, and `deactivated`/`archived`/`graduated` to `/unauthorized`) |

### 1.3 DB Reconnect, Missing `connectToDatabase`, Logger, Error Sanitization, URL/Regex & Admin PATCH (`AUD-H15`, `AUD-M01`, `AUD-M02`, `AUD-M04`)
| File | Action | Summary |
| :--- | :--- | :--- |
| `src/lib/db/mongodb.ts` | Modified | Resets both `cached.conn` and `cached.promise` when `readyState !== 1` and attaches a one-time `disconnected` event listener for automatic Atlas reconnection |
| `src/lib/db/repositories/chat.repository.ts`, `department.repository.ts`, `otp.repository.ts`, `user.repository.ts` | Modified | Added `ensureConnection()` (`if (process.env.MONGODB_URI) await connectToDatabase();`) across all database access methods |
| `src/lib/logging/logger.ts` | Modified | Added `WeakSet`-based `safeJsonStringify()` and cyclic tracking in `sanitizeLogData()` so circular references emit `'[Circular]'` without throwing `TypeError` |
| `src/lib/api/api-error-handler.ts` | Modified | Mapped JSON `SyntaxError` to HTTP `400` (`'Malformed JSON request body.'`) and sanitized Mongoose `E11000` & `ValidationError` responses (zero `keyPattern` or schema path leakage) |
| `src/lib/validations/common-schemas.ts` | Modified | Exported `isSafeHttpUrl()` and `safeHttpUrlSchema` restricting URLs strictly to `http:` and `https:` protocols |
| `src/lib/validations/assignment.schema.ts`, `chat.schema.ts`, `complaint.schema.ts`, `notice.schema.ts`, `service-request.schema.ts`, `user.schema.ts` | Modified | Replaced permissive `z.string().url()` with `safeHttpUrlSchema` across all 6 schemas (`AUD-M01`), and added `SERVICE_REQUEST_SORT_FIELDS` allowlist in `service-request.schema.ts` (`AUD-M02`) |
| `src/lib/services/poll.service.ts`, `src/lib/services/service-request.service.ts` | Modified | Escaped user-supplied search regex metacharacters (`AUD-M02`) |
| `src/app/api/v1/admin/users/[id]/route.ts` | Modified | Added strict Zod `.strict()` validation on `PATCH`, blocked transitioning self or any active `super_admin` to ANY non-`active` status (`403`), and wired non-blocking Clerk session revocation |

### 1.4 Production Dependency Cleanup (`AUD-H18`)
| File | Action | Summary |
| :--- | :--- | :--- |
| `package.json`, `package-lock.json` | Modified | Removed `shadcn` and `cn` from `dependencies` (-196 transitive packages); added zero-vuln `dotenv` to `devDependencies` for offline CLI scripts; preserved `next@15.5.29` and `postinstall: "node scripts/patch-ably.js"` |
| `src/lib/utils/cn.ts` | Modified | Replaced external `export { cn } from 'cn'` with a clean, zero-dependency local `cn()` implementation |
| `src/components/ui/*.tsx` (11 files) | Modified | Switched `import { cn } from 'cn'` to `import { cn } from '@/lib/utils/cn'` |
| `src/app/globals.css` | Modified | Removed residual `@import 'shadcn/tailwind.css';` (Tailwind v4, `tw-animate-css`, and all Glassmorphism tokens remain intact locally) |

### 1.5 Regression Tests & Outdated Legacy Test Alignments
| File | Action | Summary |
| :--- | :--- | :--- |
| `tests/unit/p1-batch2-lifecycle-infra.test.ts` | Created | 15 dedicated security & reliability tests covering `AUD-H11`, `AUD-M05`, `AUD-H12`, `AUD-H15`, `AUD-M01`, `AUD-M02`, `AUD-M04`, and `AUD-H18` |
| `tests/unit/password-recovery.test.ts` | Modified | Aligned 2 outdated assertions (lines 60, 87) that previously expected unmasked `result.email` on `requestRecovery()` -> now strictly asserts `result.email === undefined` and `result.maskedEmail === 'ka***@axiscolleges.in'` |
| `tests/unit/account-activation.test.ts` | Modified | Aligned 3 outdated anti-enumeration assertions (lines 153, 179, 198) to expect uniform `ValidationError` without leaking `'No collegiate account found'` |
| `tests/unit/account-lifecycle-integration.test.ts` | Modified | Aligned outdated raw-email recovery assertions (lines 456, 462) to assert `email === undefined` + `maskedEmail`, and supplied valid `activationTokenHash` to the suspended-account fixture (line 563) so the lifecycle gate is tested after cryptographic token proof |
| `tests/unit/security-concurrency-failure.test.ts` | Modified | Aligned outdated assertion (line 206) where a cleared-token active account previously leaked `ConflictError` to an unauthenticated caller without a token -> now asserts uniform `ValidationError` |

---

## 2. Production Dependency Audit (`npm audit --omit=dev`) Before vs. After

| Severity | Before (`shadcn` + `cn` in `dependencies`) | After (Removed `shadcn` & `cn`, -196 packages) | Delta |
| :--- | :---: | :---: | :---: |
| **Critical** | 0 | 0 | 0 |
| **High** | **9** | **1** *(bundled `next@15.5.29 -> postcss`, requires major `next@16`)* | **-8 (All `shadcn` High vulns eliminated)** |
| **Moderate** | **3** | **1** *(bundled `next@15.5.29 -> postcss`)* | **-2** |
| **Low** | 0 | 0 | 0 |
| **Total Prod Vulns** | **12** | **2** | **-10 (-83.3%)** |

---

## 3. Verification Results

| Gate | Command | Result |
| :--- | :--- | :--- |
| Production Dependency Audit | `npm audit --omit=dev` | **PASS** — 12 -> 2 (0 vulnerabilities from `shadcn`/`cn`; only Next 15 bundled `postcss` remains) |
| TypeScript Strict Check | `npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 errors |
| ESLint | `npm run lint` (`eslint`) | **PASS** — 0 errors, 0 warnings |
| P1 Batch 2 Regression Suite | `npx tsx --test tests/unit/p1-batch2-lifecycle-infra.test.ts` | **15 / 15 PASS** (0 failures) |
| Full Unit Regression Suite | `npm test` | **894 / 894 PASS** across 276 suites (+15 new P1 Batch 2 tests, 0 failures) |
| Cross-Module Integration Suite | `npm run test:integration` | **5 / 5 PASS** (0 failures) |
| Combined Test Suite | `npm run test:all` | **899 / 899 PASS** (0 failures) |
| Production Build | `npm run build` (`next build`) | **PASS** — Compiled cleanly in 19.3s; 39/39 static pages + all dynamic routes & middleware (`93.7 kB`) |
