# P0 Remediation Batch 3 — MongoDB Partial Unique Indexes, Real Resend Email Dispatch, Hardened File Uploads & Concurrency/Ably Fixes

**Status:** Completed & Verified  
**Targeted Audit Findings:** `AUD-C06`, `AUD-C07`, `AUD-C08`, `AUD-C09` (FileUploader subset), `AUD-H13`, `AUD-H14`, `AUD-C10` (Facility concurrency, Audit chain concurrency & `actorId` normalization, Notification broadcast pagination, Ably token TTL & revocation)  
**Scope Discipline:** Strictly confined to MongoDB `Conversation`/`User`/`AuditLog` indexes, `EmailService`, `FileUploader` + upload signature + Complaint/Request compose forms, Facility booking concurrency, Audit chain serialization, Notification broadcast pagination, and Ably token TTL/revocation — zero edits to Notices, Polls, Passport, Dashboard widgets, or `package.json`. Academic Calendar (MOD-10) remains permanently excluded.

---

## 1. Exact Files Modified & Created

| File | Action | Finding Addressed |
| :--- | :--- | :--- |
| `src/lib/db/models/conversation.model.ts` | Modified | `AUD-C06` — Replaced legacy sparse `{ directKey: 1, type: 1 }` index with partial unique index `{ type: 'direct', directKey: { $type: 'string' } }`; removed redundant single-field `directKey` index; added `pre('validate')` guard ensuring group chats never persist `directKey: null` |
| `src/lib/db/models/user.model.ts` | Modified | `AUD-C07` — Replaced legacy `unique + sparse` indexes on `username`, `authProviderId`, `studentProfile.rollNumber`, `facultyProfile.employeeId`, and `adminProfile.adminStaffId` with `$type: 'string', $gt: ''` partial unique indexes matching `studentProfile.enrollmentNumber` |
| `scripts/migrate-p0-indexes.ts` | Created | `AUD-C06` / `AUD-C07` / `AUD-C10` — Safe, idempotent MongoDB Atlas index migration CLI with `--dry-run` support and pure `identifyLegacyIndexesToDrop()` classifier |
| `src/lib/services/email.service.ts` | Modified | `AUD-C08` — Replaced no-op stub with native `fetch('https://api.resend.com/emails')` + `AbortSignal.timeout(10_000)` transactional dispatch, HTML-escaped templates, fail-closed HTTP `503` in production or on gateway failure, and zero raw OTP logging |
| `src/lib/services/assignment.service.ts` | Modified | `AUD-H13` — Hardened `getUploadSignature(session, scope)` with user-scoped folder isolation (`axis-linkup/<scope>/<userId>`), `allowed_formats`, `max_file_size` (`25MB`) inside the canonical SHA-1 signature, scope allowlist (`assignments`/`complaints`/`requests`), and fail-closed `503` in production if Cloudinary is unconfigured |
| `src/app/api/v1/assignments/upload-signature/route.ts` | Modified | `AUD-H13` — Added `?scope=` validation and per-user sliding-window rate limiting (`checkRateLimit`: 30 req/min -> HTTP `429`) |
| `src/components/assignments/file-uploader.tsx` | Modified | `AUD-C09` / `AUD-H13` — Fixed multi-file stale-closure overwrite via `accumulateUploadedFiles()`, added full drag-and-drop (`onDragEnter`/`onDragOver`/`onDragLeave`/`onDrop`), added `scope` prop, and appended signed `allowed_formats` + `max_file_size` to Cloudinary `FormData` |
| `src/components/complaints/complaint-compose-form.tsx` | Modified | `AUD-H14` — Removed fabricated `https://storage.axislinkup.internal/evidence/...` URLs and integrated `<FileUploader scope="complaints" />` |
| `src/components/requests/student-request-compose-modal.tsx` | Modified | `AUD-H14` — Removed ephemeral `URL.createObjectURL` (`blob:`) URLs and integrated `<FileUploader scope="requests" />` |
| `src/lib/db/repositories/facility-booking.repository.ts` | Modified | `AUD-C10` — Added `runInTransaction()` (with standalone MongoDB fallback), `ClientSession` propagation, and atomic conditional `update(..., { expectedStatus: 'pending' })` via `findOneAndUpdate` |
| `src/lib/services/facility.service.ts` | Modified | `AUD-C10` — Added per-facility async mutex (`withFacilityLock`), transactional + atomic `expectedStatus: 'pending'` approval transition, and post-write standalone conflict rollback in `reviewBooking` and `createBooking(autoApprove)` |
| `src/lib/db/models/audit-log.model.ts` | Modified | `AUD-C10` — Added unique index on `previousHash` preventing concurrent hash-chain forks |
| `src/lib/services/audit.service.ts` | Modified | `AUD-C10` — Added serialized `writeQueue`, monotonic `createdAt`, optimistic retry on `E11000` (up to 5 attempts), and canonical `actorObjId` normalization BEFORE computing `entryHash` |
| `src/lib/services/notification.service.ts` | Modified | `AUD-C10` — Replaced 100-user truncation with full paginated recipient collection (`collectAllGovernedRecipientIds`) and batched bulk insertion (`NotificationRepository.createMany`) |
| `src/lib/realtime/ably-broker.ts` | Modified | `AUD-C10` — Exported `ABLY_TOKEN_TTL_MS` (10 minutes) and added non-blocking `AblyBroker.revokeUserTokens(userId)` via Ably REST `/revokeTokens` |
| `src/app/api/v1/chat/token/route.ts` | Modified | `AUD-C10` — Shortened token TTL from 60 min to 10 min, removed unsigned HTTP `200` `keyName`-leaking error fallback (now returns HTTP `503`), and fail-closed in production when `ABLY_API_KEY` is missing |
| `src/lib/services/chat.service.ts` | Modified | `AUD-C10` — Invokes `AblyBroker.revokeUserTokens` non-blockingly when removing group chat members in `manageGroupMembers` |
| `src/lib/services/iam-governance.service.ts` | Modified | `AUD-C10` — Invokes `AblyBroker.revokeUserTokens` non-blockingly when suspending or deactivating a user in `changeUserStatus` |
| `tests/unit/assignment-backend.test.ts` | Modified | Explicit alignment (line 958): updated legacy folder assertion from `axis-linkup/assignments` to hardened user-isolated `axis-linkup/assignments/${facultySession.userId}` + `allowedFormats` & `maxFileSize` |
| `tests/unit/notifications-backend.test.ts` | Modified | Explicit mock alignment (line 145): added `NotificationRepository.createMany` in-memory mock alongside `NotificationRepository.create` |
| `tests/unit/p0-batch3-infra-remediation.test.ts` | Created | 17 dedicated regression tests covering all Batch 3 findings across models, migration classifier, Resend transport, uploads, concurrency races, audit chain serialization, 250-user broadcast pagination, and Ably TTL/503/revocation |

---

## 2. Before vs. After Security & Reliability Posture

| Finding | Before (Vulnerable / Broken) | After (Remediated) |
| :--- | :--- | :--- |
| **`AUD-C06` Group Chat `E11000` Crash** | Compound `{ directKey: 1, type: 1 }, { unique: true, sparse: true }` indexed `{ directKey: null, type: 'group' }` because `type` is always present, crashing the 2nd group chat with `E11000`. | Partial unique index `{ type: 'direct', directKey: { $type: 'string' } }` applies strictly to direct chats; `pre('validate')` strips `directKey` on group chats. Safe Atlas migration script provided. |
| **`AUD-C07` User `null` Index Collisions** | `default: null` on `username` and `authProviderId` (plus optional staff/student IDs) conflicted with `unique + sparse` indexes, causing `E11000` on bulk provisioning of unactivated users. | All 6 optional unique user fields use `partialFilterExpression: { <field>: { $type: 'string', $gt: '' } }`. Zero collisions on `null` or empty values. |
| **`AUD-C08` No-Op Email Stub** | `EmailService.sendOtpEmail` logged and returned `{ success: true }` without making any network call, blocking real OTP activation and password recovery in production. | Real native-`fetch` POST to `https://api.resend.com/emails` (10s timeout, zero new dependencies), HTML-escaped templates, fails closed with HTTP `503` on gateway errors or missing production `RESEND_API_KEY`. |
| **`AUD-C09` / `AUD-H13` / `AUD-H14` Uploads** | Multi-file selection overwrote prior files via stale closure; drag-and-drop did nothing; upload signatures lacked format/size/user-folder restrictions and rate limiting; complaints fabricated `storage.axislinkup.internal` URLs and requests saved ephemeral `blob:` URLs. | `accumulateUploadedFiles()` preserves all N files; drag-and-drop implemented; signatures bind `allowed_formats`, `max_file_size` (`25MB`), and `axis-linkup/<scope>/<userId>` behind a 30/min sliding-window rate limiter; complaints and requests both use `<FileUploader>`. |
| **`AUD-C10` Concurrency, Pagination & Ably** | Concurrent facility approvals had a TOCTOU double-booking window; concurrent audit writes forked `previousHash` and hashed non-ObjectId `actorId` differently from stored ObjectId; broadcasts silently truncated at 100 users; Ably tokens lasted 60 min, leaked `keyName` on error, and were never revoked on kick/suspension. | Per-facility lock + MongoDB transaction (standalone-safe) + atomic `{ status: 'pending' }` conditional update; serialized audit `writeQueue` + unique `previousHash` + `E11000` retry + canonical `actorObjId` hashing; paginated multi-page broadcast with batched `createMany`; 10-minute Ably TTL + HTTP `503` fail-closed + active `revokeUserTokens` on group removal and account suspension/deactivation. |

---

## 3. Database Index Migration Runbook (Production Atlas)

Before deploying Batch 3 to a live MongoDB Atlas cluster that already contains legacy sparse indexes, execute:

```bash
# 1. Inspect legacy sparse indexes safely without mutating the database
npx tsx scripts/migrate-p0-indexes.ts --dry-run

# 2. Drop legacy sparse indexes and sync new partial unique indexes idempotently
npx tsx scripts/migrate-p0-indexes.ts
```

---

## 4. Verification Results

| Gate | Command | Result |
| :--- | :--- | :--- |
| TypeScript Strict Check | `npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 errors |
| ESLint | `npm run lint` (`eslint`) | **PASS** — 0 errors, 0 warnings |
| P0 Batch 3 Regression Suite | `npx tsx --test tests/unit/p0-batch3-infra-remediation.test.ts` | **17 / 17 PASS** (0 failures, clean exit) |
| Full Unit Regression Suite | `npm test` | **879 / 879 PASS** across 270 suites (+17 new P0 Batch 3 tests, 0 failures) |
| Cross-Module Integration Suite | `npm run test:integration` | **5 / 5 PASS** (0 failures) |
| Combined Test Suite | `npm run test:all` | **884 / 884 PASS** (0 failures) |
| Production Build | `npm run build` (`next build`) | **PASS** — Compiled cleanly in 19.7s; 39/39 static pages + all dynamic routes & middleware (`93.5 kB`) |
