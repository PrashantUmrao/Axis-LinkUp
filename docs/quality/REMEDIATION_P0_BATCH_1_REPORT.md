# P0 Remediation Batch 1 — Authentication Fail-Closed, Bootstrap Removal & OTP Lifecycle Fixes

**Status:** Completed & Verified  
**Targeted Audit Findings:** `AUD-C04`, `AUD-C05`, `AUD-C10` (OTP TTL & Proof Replay subset), `AUD-C09` (`OtpInput` Infinite Auto-Send subset)  
**Scope Discipline:** Strictly confined to authentication, Clerk webhook/verify-role ingress, OTP lifecycle, `OtpInput`, and root bootstrap CLI — zero edits to Grievance, Chat, Facility, Passport, File Upload, or Dashboard modules.

---

## 1. Exact Files Modified & Created

| File | Action | Finding Addressed |
| :--- | :--- | :--- |
| `src/lib/auth/server.ts` | Modified | `AUD-C04` — Fail-closed `getCurrentSession()` / `resolveProvisionedSession()` + `__setTestSession` production block |
| `src/app/auth/verify-role/page.tsx` | Modified | `AUD-C05` — Removed hardcoded Gmail / `admin01` / `SA-ADMIN01` runtime `super_admin` auto-bootstrap; unprovisioned users redirect to `/unauthorized?error=not_provisioned` |
| `src/app/api/webhooks/clerk/route.ts` | Modified | `AUD-C05` — Removed `super_admin`/`SA-ADMIN01` auto-creation; unprovisioned `user.created`/`user.updated` return HTTP `200` (`ignored: true`) preventing Svix retry storms |
| `src/app/ui-preview/ui-preview-client.tsx` | Modified | Safeguard #3 — Replaced residual personal email placeholder (`theprashantumrao@gmail.com`) with institutional demo placeholder (`aarav.sharma@axiscolleges.in`) |
| `scripts/create-super-admin.ts` | Modified | `AUD-C05` — Removed hardcoded personal Gmail allowlist exception |
| `scripts/bootstrap-root-admin.ts` | Created | `AUD-C05` — Dedicated CLI-only, env-driven (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_FULLNAME`), idempotent root admin bootstrap utility |
| `src/lib/db/repositories/otp.repository.ts` | Modified | `AUD-C10` — `setVerificationProof` atomically extends `expiresAt = proofExpiresAt` (+15 min); `consumeVerificationProof` enforces `expiresAt > now` |
| `src/lib/services/otp.service.ts` | Modified | `AUD-C10` — Passes 15-min `proofExpiresAt` into `setVerificationProof`; blocks hardcoded HMAC fallback in `NODE_ENV === 'production'` |
| `src/lib/services/password-recovery.service.ts` | Modified | `AUD-C10` — Atomically claims/consumes verification proof BEFORE invoking Clerk `users.updateUser(...)` (closing TOCTOU replay window); blocks `archived`/`graduated` accounts; masks email in logs |
| `src/components/auth/otp-input.tsx` | Modified | `AUD-C09` — Added `hasAutoSentRef` single-shot sentinel, removed `isSending`/`cooldown` from `handleRequestOtp` dependency array, and cleared `setTimeout` handles on unmount |
| `tests/unit/password-recovery.test.ts` | Modified | Explicit mock alignment in `handles Clerk failure safely and returns HTTP 502 Bad Gateway` (lines 453–460): added `OtpRepository.consumeVerificationProof` mock because proof consumption now executes atomically BEFORE the Clerk API call |
| `tests/unit/p0-batch1-auth-remediation.test.ts` | Created | 10 dedicated security regression tests covering `AUD-C04`, `AUD-C05`, `AUD-C10`, and `AUD-C09` |

---

## 2. Before vs. After Security Posture

| Finding | Before (Vulnerable) | After (Remediated) |
| :--- | :--- | :--- |
| **`AUD-C04` Closed-Registration Bypass** | When `UserRepository.findByAuthProviderId(userId)` returned `null`, `getCurrentSession()` synthesized `{ role: 'student', status: 'active' }` from Clerk claims, allowing unprovisioned users into `/api/v1/*` and `/student/*`. `__setTestSession` was unguarded in production. | `resolveProvisionedSession()` and `getCurrentSession()` strictly fail closed (return `null` -> `requireAuth()` throws HTTP `401 UnauthorizedError`). `__setTestSession()` throws immediately if `NODE_ENV === 'production'`. Already-provisioned users continue linking via `/auth/verify-role` seamlessly. |
| **`AUD-C05` Hardcoded Super-Admin Bootstrap & Webhook Retry Storm** | `verify-role/page.tsx` auto-created root `super_admin` (`sys_admin`, `SA-ADMIN01`) for hardcoded `hey.prashantumrao@gmail.com`, `admin01`, or `publicMetadata.role === 'super_admin'`. Clerk webhook auto-created `SA-ADMIN01` and returned HTTP `403` on unprovisioned signups (causing Svix retry storms). | Zero hardcoded personal emails or `SA-ADMIN01` strings anywhere in `src/` (`git grep` verified 0 matches). Unprovisioned Clerk users redirect to `/unauthorized?error=not_provisioned`. Unprovisioned Svix webhooks create zero DB records and return HTTP `200` (`{ received: true, ignored: true, reason: 'closed_registration_unprovisioned' }`). Root admin provisioning is strictly CLI/env-driven via `scripts/bootstrap-root-admin.ts`. |
| **`AUD-C10` OTP TTL Premature Proof Expiry & Replay Race** | 5-min `OtpModel` TTL deleted/expired 15-min `proofTokenHash` 10 minutes early; `resetPassword` consumed proof *after* Clerk `updateUser` (concurrent replay race); hardcoded `'axis-linkup-otp-secret'` fallback active in production. | `setVerificationProof` atomically extends `expiresAt` to `proofExpiresAt` (+15 min) while OTP code stays `isConsumed: true`. `resetPassword` atomically consumes proof BEFORE Clerk mutation (verified via concurrent `Promise.allSettled` test). Production throws HTTP 500 if neither `OTP_HMAC_SECRET` nor `CLERK_SECRET_KEY` is configured. |
| **`AUD-C09` `OtpInput` Infinite Auto-Send Loop** | `[email, purpose, isSending, cooldown]` dependency array re-triggered `autoSendOnMount` every 60s when cooldown reached `0` and looped tightly on fetch errors; uncleaned `setTimeout` handles risked unmounted state updates. | Single-shot `hasAutoSentRef` guarantees `autoSendOnMount` dispatches at most once per mount; `isSendingRef`/`cooldownRef` stabilize `handleRequestOtp`; all timers clear on unmount. |

---

## 3. Verification Results

| Gate | Command | Result |
| :--- | :--- | :--- |
| Hardcoded String Scan | `git grep -i "prashantumrao" -- src/` & `git grep "SA-ADMIN01" -- src/` | **PASS** — `0` matches for both |
| TypeScript Strict Check | `npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 errors |
| ESLint | `npm run lint` (`eslint`) | **PASS** — 0 errors, 0 warnings |
| Unit Regression Suite | `npm test` | **842 / 842 PASS** across 256 suites (+10 new P0 Batch 1 tests, 0 regressions) |
| Cross-Module Integration Suite | `npm run test:integration` | **5 / 5 PASS** (0 failures) |
| Combined Suite | `npm run test:all` | **847 / 847 PASS** (0 failures) |
| Production Build | `npm run build` (`next build`) | **PASS** — Compiled cleanly in 18.3s; 39/39 static pages + all dynamic routes & middleware (`93.5 kB`) |
