# Phase 5.12 — Skill & Achievement Passport & Faculty Endorsement Pipeline (MOD-15)
## Implementation & Verification Report

**Project:** Axis LinkUp (Axis Colleges Digital Campus Platform)  
**Module:** MOD-15 — Skill & Achievement Passport & Faculty Endorsement Pipeline  
**Status:** Completed & Verified  
**Compliance:** DOC-AUTH-005 (RBAC Permission Matrix), NAAC/NIRF Accreditation Compliance, Strict Academic Calendar Exclusion Policy

---

## 1. Executive Summary

Phase 5.12 delivers the faculty-endorsed Skill & Achievement Passport (MOD-15) for Axis Colleges. Students submit proof-backed co-curricular claims (Technical Certifications, Hackathons & Competitions, Paper Publications, Club Leadership, and Community Service), Faculty and Department Administrators verify or reject claims with SHA-256 cryptographic authenticity seals, Administrators export formula-safe verified NAAC/NIRF accreditation datasets, and students can publish a revocable, rotatable recruiter portfolio link exposing strictly verified achievements.

---

## 2. Data Architecture & Models

### 2.1 `StudentAchievement` (`src/lib/db/models/student-achievement.model.ts`)
- **Fields:** Unique `claimCode` (`AXP-YYYY-XXXXXX`), `studentId`, immutable `studentSnapshot` (`fullName`, `enrollmentNo`, `department`, `branch`, `section`, `semester`), indexed `category`, deterministic `pointsWeight` (`paper_publication: 30`, `hackathon_competition: 25`, `technical_certification: 20`, `club_leadership: 15`, `community_service: 10`), `title`, `issuingOrganization`, `issueDate`, `description`, `skills` (max 10), `credentialUrl`, `proofAttachment` (max 25MB via Cloudinary `FileUploader`), indexed `verificationStatus` (`pending` | `verified` | `rejected`), `resubmissionCount` (max `1`), `verifiedBy` & `verifiedBySnapshot`, `verifiedAt`, `verificationHash`, `reviewRemarks`.
- **Indexes:** `{ studentId: 1, verificationStatus: 1, createdAt: -1 }`, `{ 'studentSnapshot.department': 1, verificationStatus: 1, createdAt: -1 }`, `{ claimCode: 1 }` (unique).
- **Serializers:** `toStudentAchievementDTO()` (guarantees `verificationHash` is strictly `null` unless `verificationStatus === 'verified'`) and `toPublicAchievementDTO()`.

### 2.2 `PassportShare` (`src/lib/db/models/passport-share.model.ts`)
- 1 per student (`studentId` unique), cryptographically random 32-hex `shareToken`, `isEnabled` (default `false`), optional `headline`, `viewCount`, `lastRotatedAt`.
- Serializer: `toPassportShareDTO()`.

---

## 3. Integrity Invariants, Privacy & RBAC Enforcement

### 3.1 Cryptographic Endorsement & Verification Integrity (`src/lib/services/passport.service.ts`)
- **SHA-256 Verification Hash (`computeVerificationHash`):** Computed ONLY upon faculty/admin `verify` decision over `{ claimCode, studentId, title, issuingOrganization, issueDate, verifiedBy, verifiedAt }`. Unverified (`pending`) and `rejected` claims never receive a hash or official seal.
- **Permanent Lock on Verified Claims:** Verified claims are strictly protected against student resubmission, edits, or deletion (`BadRequestError` HTTP `400`).
- **Single Resubmission Rule:** Rejected claims permit at most 1 resubmission (`resubmissionCount < 1`), resetting status to `pending` and clearing previous remarks. A second rejection permanently locks the claim.
- **Validation Hygiene (`src/lib/validations/passport.schema.ts`):** Rejects future `issueDate`, requires at least one of `credentialUrl` or `proofAttachment`, blocks non-`http(s)` URIs (e.g., `javascript:`), and enforces $\ge 10$-char rejection remarks.

### 3.2 Public Recruiter Privacy Invariant
- Added `/passport/(.*)` and `/api/v1/passport/public/(.*)` to `isPublicRoute` in `src/middleware.ts` without impacting `protected-routes.test.ts`.
- Disabled or invalid share tokens return HTTP `404`.
- Active tokens expose ONLY safe public student metadata (`fullName`, `department`, `branch`, `semester`) and strictly `verified` achievements (`PublicAchievementDTO`) — NEVER email, phone number, internal secrets, or pending/rejected claims.

### 3.3 Exact RBAC Alignment (`src/lib/auth/permissions.ts`)
| Role | Submit / Resubmit / Share | Verify / Reject Queue | NAAC/NIRF CSV Export |
|---|---|---|---|
| `student` | Allowed (`PASSPORT_SUBMIT_PROOF`, `OWN`) | `403 Forbidden` | `403 Forbidden` |
| `faculty` | `403 Forbidden` | Allowed (`PASSPORT_VERIFY_CLAIM`, dept-scoped) | `403 Forbidden` |
| `admin` | `403 Forbidden` | Allowed (`DEPT`-isolated) | Allowed (`DEPT`-scoped) |
| `super_admin` | `403 Forbidden` (submit) | Allowed (Global) | Allowed (Global) |

---

## 4. REST API Endpoints (`src/app/api/v1/passport/...`)

| Method | Endpoint | Guard | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/passport` | `requireAuth()` | Student own passport + stats; Faculty/Admin verification queue |
| `POST` | `/api/v1/passport` | `requireRole('student')` | Submit new achievement proof |
| `GET` | `/api/v1/passport/[id]` | Author or Verifier | Detailed view of single achievement claim |
| `PATCH` | `/api/v1/passport/[id]` | `requireRole('student')` | Resubmit rejected claim (max 1 time) |
| `DELETE` | `/api/v1/passport/[id]` | `requireRole('student')` | Withdraw unverified `pending` claim |
| `POST` | `/api/v1/passport/[id]/verify` | `requireRole(['faculty', 'admin', 'super_admin'])` | Endorse (`verify`) + SHA-256 stamp or `reject` |
| `GET` / `PATCH` | `/api/v1/passport/share` | `requireRole('student')` | Toggle, update headline, or rotate public link |
| `GET` | `/api/v1/passport/export` | `requireRole(['admin', 'super_admin'])` | Download formula-safe verified NAAC/NIRF CSV |
| `GET` | `/api/v1/passport/public/[shareToken]` | Public (token-gated) | Read-only recruiter view of verified achievements |

---

## 5. Frontend Portals & Navigation

- **Activated Navigation (`src/config/navigation.ts`):** Activated `student-passport` (`/student/passport`), added `faculty-passport` (`/faculty/passport`), added `admin-passport` (`/admin/passport`), and updated `tests/unit/navigation.test.ts`.
- **Components (`src/components/passport/`):** `StudentPassportView`, `AchievementSubmitModal` (reusing Cloudinary `FileUploader`), `PassportVerificationView`, `AchievementVerifyModal`, `PublicPassportView`.
- **Portal Pages:** `/student/passport`, `/faculty/passport`, `/admin/passport`, and public `/passport/[shareToken]`.

---

## 6. Verification Results

| Verification Check | Result | Details |
|---|---|---|
| Phase 5.12 Backend Unit Suite | **PASS** | `tests/unit/passport-backend.test.ts` — 9 / 9 tests passing |
| Phase 5.12 Frontend Integration Suite | **PASS** | `tests/unit/passport-frontend-integration.test.ts` — 5 / 5 tests passing |
| Navigation & RBAC Consistency Suite | **PASS** | `tests/unit/navigation.test.ts` — 13 / 13 tests passing |
| Protected Routes & Ingress Suite | **PASS** | `tests/unit/protected-routes.test.ts` — 17 / 17 tests passing |
| Full Project Regression Suite (`npm test`) | **PASS** | **803 / 803 tests passing** across 128 top-level suites (0 failures, 0 regressions) |
| TypeScript Compiler (`npx tsc --noEmit`) | **PASS** | 0 errors |
| ESLint (`npm run lint`) | **PASS** | 0 errors, 0 warnings |
| Production Build (`npm run build`) | **PASS** | Compiled cleanly in 17.7s across all 40 static/dynamic routes including `/student/passport`, `/faculty/passport`, `/admin/passport`, `/passport/[shareToken]`, and all `/api/v1/passport/*` endpoints |
