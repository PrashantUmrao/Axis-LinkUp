# AXIS LINKUP — COMPLETE SYSTEM FUNCTIONALITY, API, UI/UX & SECURITY AUDIT

**Audit Date:** 2026-11-18  
**Target Repository:** `c:\Users\prash\Desktop\Axis LinkUp` (`axis-linkup@0.1.0`)  
**Audit Mode:** Strictly Read-Only (Zero application code, dependency, configuration, or database mutations performed)  
**Audited Scope:** All 36 App Router pages, 7 layouts, 99 API route files (121 exported HTTP handlers), 22 Mongoose models, 19 repositories, 21 domain services, 13+ validation schemas, middleware/RBAC/session modules, 837 automated tests, build artifacts, and dependency graph.

---

## 1. Executive Summary

While Axis LinkUp compiles cleanly (`tsc --noEmit` 0 errors, `eslint` 0 errors/0 warnings, `next build` 14.5s) and passes **837 / 837 mocked automated tests** (832 unit tests + 5 cross-module integration workflows), this forensic read-only audit uncovered **critical security, data integrity, and operational blockers** that make the platform **NOT READY for immediate production cutover** until remediated.

### Headline Findings
1. **Severe RBAC & Privacy Breaches Across Grievances, Notices, Polls, Facilities, Passport, Chat, and Profiles:**
   - Any Department HOD—and **any regular non-HOD faculty member**—can read confidential student grievances across **all departments including Executive Director-only grievances** via query-parameter filter overwrite (`ComplaintRepository.queryWithFilters`), and students receive confidential `isInternal: true` tribunal notes.
   - Unprovisioned Clerk accounts bypass Closed Registration when hitting routes/APIs directly because `getCurrentSession()` synthesizes an active `student` session from JWT claims when MongoDB returns `null`.
   - Hardcoded personal Gmail (`hey.prashantumrao@gmail.com`) and username (`admin01`) auto-bootstrap root `super_admin` (`sys_admin`) in `verify-role/page.tsx`.
   - `super_admin` (`sys_admin` & `director`) conflation allows System Admin to exercise Director grievance authority, read unredacted complaints, grade assignments, and add themselves to private academic group chats; conversely, Director bypasses `sys_admin`-only checks in `ProfileService` (`updateAcademicProfile`, private faculty phones) and `AuditService`.
   - Any HOD can archive/delete/inspect receipts on notices and close/archive/delete polls across **all departments and institution-wide circulars**; `FacilityService` has a tautological `DEPT` check granting global access to all admins; `PassportService` and `ServiceRequestService` fail open when `departmentId` is missing (and `PassportService` skips department checks for faculty entirely).
2. **Production-Breaking Database Schema & Concurrency Defects:**
   - Compound sparse unique index `{ directKey: 1, type: 1 }` on `ConversationModel` breaks creation of the **2nd group chat** with MongoDB `E11000`.
   - `default: null` on `User.username` and `User.authProviderId` breaks `unique + sparse` indexes on the 2nd pre-provisioned user without a username/Clerk ID.
   - `OtpModel`'s 5-minute TTL index deletes/expires the 15-minute password-recovery proof token 10 minutes early.
   - `AuditService.recordEvent` has a concurrent hash-chain fork race; `FacilityService.reviewBooking` has a TOCTOU double-booking race; all 6 sequential code generators lack atomic counters; `NotificationService.broadcastAlert` silently truncates `all_users`/`by_role` broadcasts at **100 users**.
3. **Stubbed / Broken External Integrations & Attachment Workflows:**
   - `EmailService.sendOtpEmail` is a **complete no-op stub** (neither `resend` nor `nodemailer` is installed; no HTTP/SMTP call is made even when `RESEND_API_KEY` or `SMTP_HOST` is set), silently returning `{ success: true }` while delivering zero emails.
   - Complaint evidence uploads fabricate fake `https://storage.axislinkup.internal/...` URLs; Service Request attachments persist browser-local `blob:` URLs into MongoDB (broken after refresh and unreadable by admins); `FileUploader` overwrites all but the last file in multi-file uploads; Cloudinary signed uploads enforce zero MIME, size, folder-ownership, or rate limits.
   - Removed chat members retain live Ably channel access for up to **60 minutes** (no token revocation).
4. **Incomplete Dashboards, Residual Calendar Artifacts & Unimplemented Modules:**
   - All 4 portal dashboards contain significant hardcoded mock widgets, dead buttons (`hod-grievance-desk.tsx`, `director-appeal-desk.tsx`), broken 404 links (`/faculty/classes`, `/ui-preview` in public header, `/faculty/assignments` for `admin`), stale `"Phase 5"` disabled quick-actions for live modules, and live residual Academic Calendar widgets (`student/dashboard`, `faculty/dashboard`, landing page).
   - **MOD-12 (Notes & Study Materials)** and **MOD-18 (Departmental Analytics & Reports)** are **Not Implemented** (permission constants only).
5. **Testing & Environment Verification Limits:**
   - All 837 passing tests use mocked in-memory repositories and SSR string rendering (`renderToStaticMarkup`); **no Playwright, Cypress, or Lighthouse tooling is installed**, and live browser rendering, responsive viewports (360/390/768/1366/1440px), and live third-party services (Atlas, Clerk, Ably, Cloudinary, Resend) could not be verified end-to-end in this read-only audit.

---

## 2. Repository and Architecture Overview

### Verified Tech Stack (`package.json`)
- **Framework:** Next.js `15.5.29` (App Router), React `19.1.0`, TypeScript `5.6.3` (strict mode, `noUncheckedIndexedAccess: true`)
- **UI & Styling:** Tailwind CSS v4 (`^4`), Radix UI (`^1.8.1`), `lucide-react` (`^1.70.0`), `class-variance-authority` (`^0.7.1`)
- **Database:** Mongoose `^9.12.1` targeting MongoDB Atlas (`ap-south-1` Mumbai)
- **Authentication:** `@clerk/nextjs` `^7.9.26` + `svix` `^2.10.0` webhooks
- **Realtime:** `ably` `^2.30.0` (patched via `postinstall: "node scripts/patch-ably.js"`)
- **Validation:** Zod `^4.6.7`
- **Notable Dependency Findings:**
  - `shadcn` (`^4.23.0`) is erroneously listed in production `dependencies` instead of `devDependencies`/CLI-only, introducing **9 high + 2 moderate vulnerabilities** into production `node_modules`.
  - `cn` (`^0.5.2`) is listed in `dependencies` (stray package; `src/lib/utils.ts` uses custom `cn`).
  - Neither `resend`, `nodemailer`, `cloudinary`, `firebase`, `firebase-admin`, `playwright`, nor `lighthouse` is installed in `package.json`.

### Codebase Scale
- **App Router Pages:** 36 `page.tsx` routes across 7 layouts (`(auth)`, `(student)`, `(faculty)`, `(admin)`, `(super-admin)`, `(shared)`, root)
- **API Surface:** 99 `route.ts` files exporting 121 HTTP method handlers
- **Data Layer:** 22 Mongoose models (`src/lib/db/models/`), 19 repositories (`src/lib/db/repositories/`), 21 domain services (`src/lib/services/`)
- **Tests:** 39 unit test files (`tests/unit/**/*.test.ts`, 832 tests) + 1 integration test file (`tests/integration/platform-workflows.test.ts`, 5 workflows)

---

## 3. Complete Module Inventory

| # | Module | Classification | Evidence & Key Gaps |
| :-: | :--- | :--- | :--- |
| 1 | **Authentication & Account Activation** | **Implemented but partially functional** | Closed `/sign-up` redirect works, but `getCurrentSession()` bypasses closed registration for unprovisioned Clerk users; hardcoded `super_admin` Gmail/`admin01` bootstrap in `verify-role`; `OtpInput` infinite auto-send loop; 5-min OTP TTL expires 15-min recovery proof early; `EmailService` is a no-op stub (zero real emails sent); account enumeration & unmasked email leak in password recovery; `session.ts` idle/expiry engine is dead code. |
| 2 | **Student, Faculty & Administration Portals (Dashboards & Shell)** | **Implemented but partially functional (Mixed live + mock UI)** | Dedicated sub-pages are live, but all 4 dashboard pages (`student`, `faculty`, `admin`, `super-admin`) mix live widgets with hardcoded mock data (courses, mentors, attendance rings, grievances/appeals with dead buttons, zeroed KPIs, static health assertions), broken links (`/faculty/classes`, `/ui-preview`), stale `"Phase 5"` disabled quick actions, and live residual Academic Calendar widgets. |
| 3 | **User Profiles & Academic Entity Synchronization** | **Implemented but partially functional** | Self-service profile, department roster, and bulk CSV provisioning work with DB/Clerk, but Director bypasses `sys_admin`-only checks in `ProfileService` (private faculty phones + `updateAcademicProfile`); `User.username`/`authProviderId` `default: null` breaks unique sparse indexes; `searchDirectory` leaks student email/rollNumber; `ProfileEditDialog` retains stale state; roster search filters only current 15-row page. |
| 4 | **Notices & Announcements** | **Implemented but partially functional** | Backend CRUD, audience targeting, and read receipts exist, but any HOD can archive/delete/read receipts of ANY notice campus-wide (missing dept check); HOD `update`/`publish` compares ObjectId vs dept code (always fails); UI lacks Publish/Edit/Archive controls for drafts; student category filter values mismatch creation form (`event` vs `event_cultural`); Markdown is rendered as plain text. |
| 5 | **Polls & Voting** | **Implemented but partially functional** | Creation, voting, and unique-index duplicate prevention exist, but any HOD can close/archive/delete polls campus-wide; `getPollResults` omits audience & draft checks; `recordVote` lacks active-status/expiry atomic predicate and masks all MongoServerErrors as duplicate votes; hardcoded HMAC fallback secret; duplicate `optionIds` not deduplicated. |
| 6 | **Grievance & Complaint Management** | **Broken / regression detected** | **Critical security & functional defects:** `queryWithFilters` allows HODs/faculty to overwrite `departmentId`/`recipientRole` and read all campus/Director complaints; ALL regular faculty get HOD-level departmental grievance access; `sys_admin` gets Director authority & unredacted replies/attachments; `isInternal: true` notes leak to students; compose UI fabricates fake `storage.axislinkup.internal` URLs (no real upload); Admin dashboard grievance/appeal buttons have no `onClick` handlers. |
| 7 | **Direct Messaging & Academic Group Chat** | **Implemented but partially functional** | Direct chats & Ably token minting work, but `ConversationSchema` compound sparse index crashes the **2nd group chat** with `E11000`; removed group members keep live Ably access for up to 60 min (no revocation); `super_admin` can add themselves to any private group; deleted messages keep attachments & plaintext `lastMessage`; `ChatLayout` has a read-receipt effect loop and empty `catch` on send/delete; attach/emoji buttons are dead; mobile info panel is hidden. |
| 8 | **Assignment Management & Submissions** | **Implemented but partially functional** | Lifecycle, submissions, revisions, late rules, and grading work, but `GET /api/v1/assignments` allows students to overwrite `semester`/`section` cohort filters; `FileUploader` drops all but the last file in multi-file uploads and has no drag-and-drop; empty `assignedCourses: []` bypasses faculty course check; `sys_admin` can grade coursework; uncaught `req.json()` returns 500; re-grading over-increments `gradedCount`. |
| 9 | **Student Service Requests (MOD-13)** | **Implemented but partially functional** | Lifecycle, queue, and notifications exist, but `StudentRequestComposeModal` saves ephemeral `blob:` URLs to MongoDB (broken on refresh and unreadable by admins); `GET /api/v1/requests/stats` lets faculty read global counts; `admin` without `departmentId` fails open to global access; Admin dashboard widget still renders hardcoded `pendingRequests: 0` empty state; non-atomic ticket counter. |
| 10 | **Facility Bookings (MOD-14)** | **Implemented but partially functional** | Directory and booking UI/API exist, but `FacilityService.canApproveSpaces` has a tautological `DEPT` check removing all departmental isolation for admins; `reviewBooking` has a TOCTOU double-booking race without DB transaction/lock; student lookups expose faculty requester email/employeeId/reviewRemarks; `FacultySpacesView` drops `scope=mine` on refresh. |
| 11 | **IAM Governance & Security Audit Logs (MOD-19)** | **Implemented but partially functional** | Role/status governance, SHA-256 hash chaining, verification, and formula-safe exports work, but `AuditService.recordEvent` has a concurrent hash-chain fork race (and non-ObjectId `actorId` hash mismatch); `AuditService` allows Director to export/verify logs; `audit-logs-view.tsx` and `iam-governance-view.tsx` hard-cap at 100 rows with no pagination UI; `audit-log.model.ts` `pre('deleteOne')` only guards query middleware, not document `doc.deleteOne()`. |
| 12 | **Emergency Broadcast Console (MOD-16)** | **Implemented and functional (with medium gaps)** | Dual-confirmation (`CONFIRM EMERGENCY`), Ably global banner/takeover, audit logging, and idempotent acknowledgment receipts work cleanly. Gaps: no partial unique index enforcing single active emergency under concurrency; `admin` (HOD) acknowledgment endpoint lacks department isolation and exposes raw `ipAddress`/`userAgent`; `acknowledgeAlert` ignores `targetDepartments`; modal lacks `Escape`/focus trap. |
| 13 | **Skill & Achievement Passport (MOD-15)** | **Implemented but partially functional** | Submission, single resubmission, SHA-256 verification stamps, CSV export, and privacy-preserved public share link work, but any `faculty` member can view & verify/reject claims from **other departments**; `admin` without `departmentId` fails open; Withdraw button lacks confirmation dialog; `StudentPassportView` swallows share/delete errors silently. |
| 14 | **In-App Notifications & Preferences (MOD-17)** | **Implemented but partially functional** | Persistent inbox, 90-day TTL, 60s dedupe, locked Emergency preferences, Topbar bell, and cross-module hooks work, but `broadcastAlert` silently truncates `all_users`/`by_role` at **100 users**; `faculty`/`admin` can broadcast unmutable `emergency`/`urgent` alerts to up to 200 arbitrary `specific_users` across departments; SSR hydration mismatch on relative timestamps; silent UI mutation errors & Topbar unread desync. |
| 15 | **Notes & Study Materials (MOD-12)** | **Not implemented** | Zero pages, zero APIs, zero models/services/components. Only `NOTES_UPLOAD`/`NOTES_DOWNLOAD` permission keys in `src/lib/auth/permissions.ts:74-75` and display label in `iam-governance.service.ts:61`. |
| 16 | **Departmental Analytics & Reports (MOD-18)** | **Not implemented** | Zero pages, zero APIs, zero models/services/components. Only `ANALYTICS_VIEW_REPORTS` permission key in `src/lib/auth/permissions.ts:97` and display label in `iam-governance.service.ts:67`. |
| — | **Smart Academic Calendar (MOD-10 — Excluded)** | **Removed (residual cleanup artifacts remain)** | No calendar APIs or DB models exist, and `navigation.ts` removed `/student/calendar`. However, live calendar widgets remain mounted on Student & Faculty dashboards, plus a disabled `/faculty/calendar` quick action, public landing page Capability 3, `role-selector.tsx:36`, `permissions.ts`, and `lib/auth/client.ts:73`. |

---

## 4. Route and Navigation Inventory

### Page & Layout Routes (36 Pages, 7 Layouts)
- **Root (`src/app/layout.tsx`):** `/` (Public Landing — contains broken prod link to `/ui-preview`), `/not-found`, `/ui-preview` (server-gated 404 in production), `/auth/verify-role`, `/passport/[shareToken]` (public recruiter view)
- **Auth (`(auth)/layout.tsx`):** `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]` (redirects to `/sign-in`), `/activate`, `/forgot-password`, `/account-suspended`, `/pending-approval`, `/role-mismatch`, `/unauthorized`
- **Student (`(student)/layout.tsx`):** `/student/dashboard`, `/student/messages`, `/student/assignments`, `/student/notices`, `/student/polls`, `/student/complaints`, `/student/requests`, `/student/passport`
- **Faculty (`(faculty)/layout.tsx`):** `/faculty/dashboard`, `/faculty/messages`, `/faculty/assignments`, `/faculty/notices`, `/faculty/polls`, `/faculty/complaints`, `/faculty/spaces`, `/faculty/passport`
- **Admin (`(admin)/layout.tsx`):** `/admin/dashboard`, `/admin/messages`, `/admin/assignments`, `/admin/notices`, `/admin/polls`, `/admin/complaints`, `/admin/requests`, `/admin/spaces`, `/admin/passport`
- **Super Admin (`(super-admin)/layout.tsx`):** `/super-admin/dashboard`, `/super-admin/audit`, `/super-admin/emergency`, `/super-admin/roles`
- **Shared (`(shared)/layout.tsx`):** `/shared/notifications`, `/shared/profile`

### Navigation & Layout Integrity Findings
1. **Broken & Duplicate Admin Sidebar Item (`src/config/navigation.ts:241-250, 319-328`):** `faculty-grading` (`/faculty/assignments`) includes `'admin'` and `'super_admin'` alongside `admin-assignments` (`/admin/assignments`). `(faculty)/layout.tsx:27` rejects `admin`, so clicking "Grading & Submissions" redirects `admin` back to `/admin/dashboard`, while `super_admin` sees duplicate Assignment links.
2. **Broken 404 Route Reference (`teaching-modules.tsx:141-150`):** All 4 "Manage Roster" buttons link to non-existent `/faculty/classes`.
3. **Production 404 in Public Header (`src/app/page.tsx:68-74`):** Public landing header links to `/ui-preview`, which returns 404 when `NODE_ENV === 'production'`.
4. **No `error.tsx` / `global-error.tsx` / `loading.tsx`:** Zero Next.js error/loading boundaries exist; uncaught server awaits in `shared/notifications/page.tsx:20-23` and `shared/profile/page.tsx:18` render unbranded error screens on transient DB failures.
5. **Disabled Search Bar in Topbar (`src/components/navigation/topbar.tsx:115-137`):** Non-functional `"Search campus..."` + `⌘K` placeholder still references `"planned for Phase 5 implementation"`.
6. **Stale Quick Actions (`faculty/dashboard/components/quick-actions.tsx:66-98`, `admin/dashboard/components/quick-actions.tsx:66-99`):** Live routes (`/faculty/notices`, `/faculty/assignments`, `/admin/notices`, `/admin/requests`, `/admin/spaces`) are still marked `isLive: false` with `"Phase 5"` badges.

---

## 5. Frontend and UI/UX Findings

*(Static code, SSR rendering, component lifecycle, form/state, and accessibility audit; live browser viewport testing limitations are documented in Section 14.)*

### Summary of Concrete UI/UX Defects
- **Mock / Fabricated Data Displayed on Live Dashboards:**
  - Student Dashboard: hardcoded Semester 6 / 84.5% attendance / 78.0% syllabus ring (`student/dashboard/page.tsx:111-155`), hardcoded `ENROLLED_COURSES` (`course-modules.tsx:23-64`), hardcoded `ASSIGNED_MENTORS` (`faculty-mentors.tsx:32-63`), zeroed `'0 Tasks'`/`'0 New'` KPIs (`metrics-overview.tsx:40-63`), hardcoded `Open Petitions: 0` (`grievance-portal-card.tsx:45-50`).
  - Faculty Dashboard: hardcoded `ALLOCATED_COURSES` (`teaching-modules.tsx:25-70`), contradictory `"No Course Sections Assigned Yet"` (`class-roster.tsx:48-53`) & `"Pending Batch Allocation"` (`student-overview.tsx:47-52`), hardcoded `MANAGED_GROUPS` (`academic-groups-card.tsx:23-48`), hardcoded `82.0%` syllabus / `94.0%` evaluations / `128 Total` (`faculty/dashboard/page.tsx:137-161`), fabricated `'3 Dispatched'` circulars (`metrics-overview.tsx:55`).
  - Admin Dashboard: hardcoded `DEPARTMENT_GRIEVANCES` (`hod-grievance-desk.tsx:25-48`) & `ACTIVE_APPEALS` (`director-appeal-desk.tsx:23-42`) with **zero `onClick` handlers** on action buttons; hardcoded `pendingRequests: 0` (`admin/dashboard/page.tsx:92`) and static empty `request-tracking.tsx:58-63`; hardcoded `100.0%` IAM / `99.9%` uptime (`admin/dashboard/page.tsx:127-173`); fake fallback staff ID `'ADM-010482'` (`welcome-banner.tsx:56`); `admin-workspace-view.tsx:32-78` allows any admin to switch client-side desks across `sys_admin`/`hod`/`director`.
  - Super Admin Dashboard: `super-admin/dashboard/page.tsx:1-168` fetches zero live telemetry and displays outdated `"all 15 Next.js server components"` text.
- **Broken Interactive Workflows:**
  - `OtpInput` (`src/components/auth/otp-input.tsx:61-108`) triggers infinite/recurring auto-OTP sends due to `[isSending, cooldown]` in `useCallback` dependencies wired to `useEffect`.
  - `ComplaintComposeForm` (`src/components/complaints/complaint-compose-form.tsx:80-102`) persists fabricated `storage.axislinkup.internal` URLs instead of uploading files.
  - `StudentRequestComposeModal` (`src/components/requests/student-request-compose-modal.tsx:148-158`) persists browser-local `blob:` URLs instead of uploading files (and leaks object URLs).
  - `FileUploader` (`src/components/assignments/file-uploader.tsx:204, 226-252`) drops all files except the last in multi-file uploads (stale closure) and has no drag-and-drop handlers despite claiming `"Click or drop files"`.
  - `NoticeDetailDialog` (`src/components/notices/notice-detail-dialog.tsx`) has no Publish/Edit/Archive actions for draft notices and never triggers read-receipts on open; Student Notice Feed category dropdown (`event`, `general`) mismatches Notice creation categories (`event_cultural`, `fee_accounts`).
  - `NoticeManagement` & `PollManagement` (`admin/dashboard/components/`) hardcode `currentUserRole="super_admin"`, exposing forbidden controls to regular `admin` HODs.
  - `ChatLayout` (`src/components/chat/chat-layout.tsx:70-110, 295-319, 428`) re-fires `markAsRead` on every `messagesMap` mutation, silently swallows send/delete failures, hides `ChatInfoPanel` on mobile (`hidden md:block`), and renders dead Paperclip/Smile buttons (`chat-conversation-view.tsx:396-416`).
- **Hydration, State Reset, Pagination & Accessibility Gaps:**
  - **Hydration risks:** `Date.now()` / `new Date()` / `toLocaleDateString()` executed during render in 9 client components (`welcome-banner.tsx` x3, `academic-calendar.tsx` x2, `student-assignment-view.tsx`, `notification-center-view.tsx`, `faculty-spaces-view.tsx`, `booking-create-modal.tsx`).
  - **Missing pagination:** Audit Logs (`limit=100`, client-only filtering unless Refresh clicked), IAM Users (`limit=100`), Assignments (`limit=50`/`100`), Complaints (`limit=50`), Requests (`limit=50`/`100`), Facilities (`limit=100`), Passport (`limit=100`).
  - **Accessibility:** Clickable `<Card>`/`<div>`/`<tr>` elements without `role`, `tabIndex`, or keyboard handlers across `poll-card.tsx`, `student-assignment-view.tsx`, `faculty-assignment-view.tsx`, `student-complaints-view.tsx`, `student-requests-view.tsx`, `admin-requests-queue-view.tsx`; hover-only message delete (`chat-conversation-view.tsx:361`); `EmergencyGlobalBanner` modal lacks `Escape`/focus trap; `super-admin/dashboard/page.tsx` strips `focus:outline-none` without replacement.
  - **XSS Check (`dangerouslySetInnerHTML`):** Only 1 occurrence in the entire repo (`src/app/layout.tsx:45-60`, static theme script with zero user input — safe). However, attachment/avatar URLs lack `https:` protocol validation (see Finding `AUD-H15`).

---

## 6. Complete API Endpoint Inventory and Audit Results

All **99 route files** (**121 exported HTTP handlers**) under `src/app/api/**/route.ts` were statically audited for authentication, RBAC/resource isolation, Zod validation, malformed JSON handling, rate limiting, and response consistency.

| # | Route | Methods | Auth Guard | RBAC / Resource Scope | Input Validation | Rate Limit | Audit Result |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `/api/auth/logout` | `POST` | `getCurrentSession` (middleware blocks unauth/suspended) | Self revoke | None | None | **PARTIAL** (blocked by middleware for suspended/pending users) |
| 2 | `/api/auth/me` | `GET` | `requireAuth` | Self | None | None | **PARTIAL** (unprovisioned Clerk bypass via `getCurrentSession`) |
| 3 | `/api/health` | `GET` | Public | Public | None | None | **PASS** (minor non-standard envelope; secret-free) |
| 4 | `/api/health/db` | `GET` | Public | Public | None | None | **PASS** (minor non-standard envelope) |
| 5 | `/api/webhooks/clerk` | `POST` | Svix signature | Webhook secret | Manual JSON | None | **FAIL** (hardcoded `SA-ADMIN01`/`admin01`; 403 retry storm) |
| 6 | `/api/v1/admin/users` | `GET` | `requireAuth` | `sys_admin` | Manual query (no Zod) | None | **PARTIAL** (`NaN` page/limit propagation) |
| 7 | `/api/v1/admin/users/activation/resend` | `POST` | `requireAuth` | `sys_admin` | Zod `resendActivationSchema` | None | **PASS** |
| 8 | `/api/v1/admin/users/bulk/preview` | `POST` | `requireAuth` | `sys_admin` | Zod `bulkPreviewRequestSchema` | None | **PASS** |
| 9 | `/api/v1/admin/users/bulk/provision` | `POST` | `requireAuth` | `sys_admin` | Zod `bulkProvisionRequestSchema` | None | **PASS** |
| 10 | `/api/v1/admin/users/bulk/template` | `GET` | `requireAuth` | `sys_admin` | Manual (`role` fallback) | None | **PASS** |
| 11 | `/api/v1/admin/users/provision` | `POST` | `requireAuth` | `sys_admin` | Service Zod | None | **PARTIAL** (`null` JSON body -> 500 `TypeError`) |
| 12 | `/api/v1/admin/users/[id]` | `GET`, `PATCH` | `requireAuth` | `sys_admin` | `GET`: ObjectId; `PATCH`: **No Zod** | None | **FAIL** (unvalidated PATCH; root `admin01` can be archived) |
| 13 | `/api/v1/admin/users/[id]/academic-profile` | `PATCH` | `requireAuth` | `sys_admin` / same-dept HOD | ObjectId + Zod | None | **FAIL** (Director bypasses `sys_admin` check) |
| 14 | `/api/v1/assignments` | `GET`, `POST` | `requireAuth` | Cohort/dept; faculty/HOD/`super_admin` | Zod (uncaught `req.json()`) | None | **FAIL** (student `semester`/`section` IDOR; empty `assignedCourses` bypass; bad JSON -> 500) |
| 15 | `/api/v1/assignments/upload-signature` | `GET` | `requireAuth` | Any active user | None | **MISSING** | **FAIL** (no MIME/size/user-folder/rate-limit enforcement) |
| 16 | `/api/v1/assignments/[id]` | `GET`, `PATCH`, `DELETE` | `requireAuth` | Cohort/dept; author/HOD/`sys_admin` | Zod (uncaught `req.json()`) | None | **PARTIAL** (bad JSON -> 500; `javascript:` URLs; `sys_admin` edits) |
| 17 | `/api/v1/assignments/[id]/archive` | `POST` | `requireAuth` | Author/HOD/`sys_admin` | Repo ObjectId | None | **PASS** |
| 18 | `/api/v1/assignments/[id]/close` | `POST` | `requireAuth` | Author/HOD/`sys_admin` | Repo ObjectId | None | **PASS** |
| 19 | `/api/v1/assignments/[id]/publish` | `POST` | `requireAuth` | Author/HOD/`sys_admin` | Repo ObjectId | None | **PASS** |
| 20 | `/api/v1/assignments/[id]/submissions` | `GET`, `POST` | `requireAuth` | Author/HOD/`sys_admin`; student | Zod (uncaught `req.json()`) | None | **PARTIAL** (bad JSON -> 500; `javascript:` URLs; resubmission race) |
| 21 | `/api/v1/assignments/[id]/submissions/me` | `GET` | `requireAuth` | Self | Repo ObjectId | None | **PASS** |
| 22 | `/api/v1/assignments/[id]/submissions/[submissionId]/evaluate` | `POST` | `requireAuth` | Author/HOD/`sys_admin` | Zod (uncaught `req.json()`) | None | **PARTIAL** (bad JSON -> 500; `sys_admin` can grade) |
| 23 | `/api/v1/audit/export` | `GET` | `requireRole('super_admin')` | `super_admin` (Director included) | Zod `auditExportQuerySchema` | None | **PARTIAL** (Director not separated from `sys_admin`) |
| 24 | `/api/v1/audit/logs` | `GET` | `requireRole(['admin','super_admin'])` | `admin` (DEPT) / `super_admin` | Zod `auditLogQuerySchema` | None | **PASS** |
| 25 | `/api/v1/audit/stats` | `GET` | `requireRole(['admin','super_admin'])` | `admin` (DEPT) / `super_admin` | None | None | **PASS** |
| 26 | `/api/v1/audit/verify` | `GET` | `requireRole('super_admin')` | `super_admin` | Clamped `limit` | None | **PARTIAL** (Director allowed; concurrent hash-chain fork risk) |
| 27 | `/api/v1/auth/activation/complete` | `POST` | Public | Token-gated | Zod `activateAccountSchema` | **MISSING** | **FAIL** (no rate limit; non-constant-time hash check) |
| 28 | `/api/v1/auth/activation/validate` | `GET` | Public | Token-gated | Zod `validateActivationQuerySchema` | **MISSING** | **FAIL** (no rate limit; leaks account lifecycle status before token check) |
| 29 | `/api/v1/auth/otp/request` | `POST` | Public | Public | Zod `requestOtpSchema` | 5/60s IP | **FAIL** (404/403 enumeration; `EmailService` no-op stub) |
| 30 | `/api/v1/auth/otp/resend` | `POST` | Public | Public | Zod `resendOtpSchema` | **MISSING** | **FAIL** (no IP rate limit; enumeration; stubbed email) |
| 31 | `/api/v1/auth/otp/verify` | `POST` | Public | Public | Zod `verifyOtpSchema` | **MISSING** | **FAIL** (no IP rate limit; hardcoded HMAC fallback; 5-min TTL kills proof) |
| 32 | `/api/v1/auth/password-recovery/request` | `POST` | Public | Public | Zod `passwordRecoveryRequestSchema` | 5/60s IP | **FAIL** (leaks existence + full unmasked `email` on username lookup; stubbed email) |
| 33 | `/api/v1/auth/password-recovery/reset` | `POST` | Public | Proof-token gated | Zod `passwordResetSchema` | **MISSING** | **FAIL** (no rate limit; proof replay TOCTOU; 5-min TTL expires proof early) |
| 34 | `/api/v1/chat/conversations` | `GET`, `POST` | `requireAuth` | Participant / non-student group | Zod | None | **FAIL** (2nd group chat crashes `E11000`; no dept check on group creation) |
| 35 | `/api/v1/chat/conversations/[id]` | `GET`, `PATCH` | `requireAuth` | Participant / creator,admin,`super_admin` | Zod | None | **PARTIAL** (`super_admin` modifies group without membership) |
| 36 | `/api/v1/chat/conversations/[id]/members` | `POST` | `requireAuth` | Creator,admin,`super_admin` | Zod | None | **FAIL** (`super_admin` can self-add to private group; no dept check; duplicate `members` bug) |
| 37 | `/api/v1/chat/conversations/[id]/messages` | `GET`, `POST` | `requireAuth` | Participant + broadcast-only check | Zod | None | **PARTIAL** (`javascript:` attachment URLs allowed) |
| 38 | `/api/v1/chat/conversations/[id]/messages/[messageId]` | `DELETE` | `requireAuth` | Author / group admin / `super_admin` | Repo ObjectId | None | **FAIL** (missing participant check; keeps attachments & `lastMessage` plaintext) |
| 39 | `/api/v1/chat/conversations/[id]/read` | `POST` | `requireAuth` | Participant | Repo ObjectId | None | **PASS** |
| 40 | `/api/v1/chat/token` | `GET` | `requireAuth` | Per-conversation capabilities | None | **MISSING** | **FAIL** (60-min TTL with no revocation; 100-chat cap; unsigned 200 fallback leaking `keyName`) |
| 41 | `/api/v1/chat/users` | `GET` | `requireAuth` | Active users | Manual query | **MISSING** | **FAIL** (no rate limit; exposes student `email`/`rollNumber`) |
| 42 | `/api/v1/complaints` | `GET`, `POST` | `requireAuth` | Student/HOD/Director/SysAdmin | Zod | None | **FAIL** (**CRITICAL** cross-dept/Director overwrite; regular faculty HOD access; `isInternal` leak; unescaped regex) |
| 43 | `/api/v1/complaints/stats` | `GET` | `requireAuth` | Student/HOD/Director/SysAdmin | None | None | **FAIL** (**CRITICAL** regular faculty gets HOD stats; random ObjectId if dept missing) |
| 44 | `/api/v1/complaints/[id]` | `GET` | `requireAuth` | `assertCanAccessComplaint` | ObjectId | None | **FAIL** (**CRITICAL** regular faculty access; `sys_admin` reads replies/attachments; `isInternal` leak) |
| 45 | `/api/v1/complaints/[id]/assign` | `POST` | `requireAuth` | HOD / Director / `super_admin` | ObjectId + Zod | None | **FAIL** (`sys_admin` equated to Director) |
| 46 | `/api/v1/complaints/[id]/escalate` | `POST` | `requireAuth` | HOD / Student owner | ObjectId + Zod | None | **FAIL** (regular faculty can escalate; student SLA breach never checked) |
| 47 | `/api/v1/complaints/[id]/responses` | `POST` | `requireAuth` | `assertCanAccessComplaint` | ObjectId + Zod | None | **FAIL** (regular faculty & `sys_admin` can reply; students can set `isInternal: true`) |
| 48 | `/api/v1/complaints/[id]/status` | `PATCH` | `requireAuth` | Student(close/reopen), HOD/Director/SysAdmin | ObjectId + Zod | None | **FAIL** (`sys_admin` can resolve/reject complaints) |
| 49 | `/api/v1/departments/[id]/roster` | `GET` | `requireAuth` | Blocks students; dept-scoped faculty/HOD | ObjectId + Zod | None | **PASS** |
| 50 | `/api/v1/emergency/active` | `GET` | `requireAuth` | Active user (dept-scoped) | None | None | **PASS** |
| 51 | `/api/v1/emergency/history` | `GET` | `requireRole(['admin','super_admin'])` | `admin`/`super_admin` | Zod | None | **PARTIAL** (`admin` sees global history) |
| 52 | `/api/v1/emergency/trigger` | `POST` | `requireRole('super_admin')` | `super_admin` + phrase | Zod | 5/300s user | **PARTIAL** (no partial unique index for concurrent trigger race) |
| 53 | `/api/v1/emergency/[id]/acknowledge` | `POST` | `requireAuth` | `EMERGENCY_ACKNOWLEDGE` | ObjectId | None | **PARTIAL** (ignores `targetDepartments`) |
| 54 | `/api/v1/emergency/[id]/acknowledgments` | `GET` | `requireRole(['admin','super_admin'])` | `admin`/`super_admin` | ObjectId + Zod | None | **FAIL** (no dept isolation for `admin`; exposes raw IP & UA) |
| 55 | `/api/v1/emergency/[id]/deactivate` | `POST` | `requireRole('super_admin')` | `super_admin` | ObjectId + Zod | None | **PASS** |
| 56 | `/api/v1/facilities` | `GET`, `POST` | `requireAuth` / `admin`,`super_admin` | All / `canApproveSpaces` | Zod | None | **FAIL** (tautological `DEPT` bypass for `admin`) |
| 57 | `/api/v1/facilities/bookings` | `GET`, `POST` | `requireAuth` / non-student | Persona-scoped | Zod | None | **FAIL** (`admin` sees all depts; student view leaks requester email/remarks; autoApprove TOCTOU) |
| 58 | `/api/v1/facilities/bookings/[id]/cancel` | `POST` | `requireRole(['faculty','admin','super_admin'])` | Owner / `canApproveSpaces` | ObjectId + Zod | None | **FAIL** (`admin` can cancel any dept's bookings) |
| 59 | `/api/v1/facilities/bookings/[id]/review` | `POST` | `requireRole(['admin','super_admin'])` | `canApproveSpaces` | ObjectId + Zod | None | **FAIL** (tautological `DEPT` bypass + TOCTOU double-booking race) |
| 60 | `/api/v1/facilities/stats` | `GET` | `requireAuth` | Persona-scoped | None | None | **PASS** |
| 61 | `/api/v1/facilities/[id]` | `GET`, `PATCH` | `requireAuth` / `admin`,`super_admin` | All / `canApproveSpaces` | ObjectId + Zod | None | **FAIL** (cross-dept `PATCH`; student `GET` leaks requester email/employeeId/remarks) |
| 62 | `/api/v1/iam/matrix` | `GET` | `requireRole('super_admin')` | `sys_admin` only | None | None | **PASS** (notes residual disabled calendar row) |
| 63 | `/api/v1/iam/stats` | `GET` | `requireRole('super_admin')` | `sys_admin` only | None | None | **PASS** |
| 64 | `/api/v1/iam/users` | `GET` | `requireRole('super_admin')` | `sys_admin` only | Zod | None | **PASS** |
| 65 | `/api/v1/iam/users/[id]/role` | `POST` | `requireRole('super_admin')` | `sys_admin` + safeguards | ObjectId + Zod | None | **PARTIAL** (does not revoke active Clerk sessions) |
| 66 | `/api/v1/iam/users/[id]/status` | `POST` | `requireRole('super_admin')` | `sys_admin` + safeguards | ObjectId + Zod | None | **PARTIAL** (does not revoke active Clerk sessions) |
| 67 | `/api/v1/notices` | `GET`, `POST` | `requireAuth` | Audience / publishing rules | Zod | None | **PARTIAL** (faculty w/o deptId bypass; `javascript:` URLs; broken cursor pagination) |
| 68 | `/api/v1/notices/unread-count` | `GET` | `requireAuth` | Self + audience | None | None | **PASS** (N+1/unbounded `$nin` scaling note) |
| 69 | `/api/v1/notices/[id]` | `GET`, `PATCH`, `DELETE` | `requireAuth` | Audience / author,HOD,`sys_admin` | ObjectId + Zod | None | **FAIL** (`DELETE` cross-dept HOD IDOR; `PATCH` broken HOD ObjectId vs code comparison) |
| 70 | `/api/v1/notices/[id]/archive` | `POST` | `requireAuth` | Author/HOD/`sys_admin` | ObjectId | None | **FAIL** (cross-dept HOD IDOR) |
| 71 | `/api/v1/notices/[id]/publish` | `POST` | `requireAuth` | Author/HOD/`sys_admin` | ObjectId | None | **FAIL** (broken HOD ObjectId vs deptCode comparison) |
| 72 | `/api/v1/notices/[id]/receipt` | `POST` | `requireAuth` | Audience-verified self | ObjectId | None | **PARTIAL** (non-atomic counter increment) |
| 73 | `/api/v1/notices/[id]/receipts` | `GET` | `requireAuth` | Author/HOD/Director/`sys_admin` | ObjectId + manual `limit` | None | **FAIL** (cross-dept HOD IDOR; `NaN` limit) |
| 74 | `/api/v1/notifications` | `GET` | `requireAuth` | Self | Zod | None | **PASS** |
| 75 | `/api/v1/notifications/broadcast` | `POST` | `requireRole(['faculty','admin','super_admin'])` | Scope rules | Zod | 10/60s user | **FAIL** (`specific_users` cross-dept + `emergency` abuse; silent 100-user truncation) |
| 76 | `/api/v1/notifications/preferences` | `GET`, `PATCH` | `requireAuth` | Self | Zod | None | **PASS** |
| 77 | `/api/v1/notifications/read-all` | `POST` | `requireAuth` | Self | Zod | None | **PASS** |
| 78 | `/api/v1/notifications/unread-summary` | `GET` | `requireAuth` | Self | None | None | **PASS** |
| 79 | `/api/v1/notifications/[id]` | `DELETE` | `requireAuth` | Self | ObjectId | None | **PASS** |
| 80 | `/api/v1/notifications/[id]/read` | `PATCH` | `requireAuth` | Self | ObjectId | None | **PASS** |
| 81 | `/api/v1/passport` | `GET`, `POST` | `requireAuth` / `student` | Student / verifier queue | Zod | None | **FAIL** (fail-open dept scoping when admin/faculty lacks `departmentId`) |
| 82 | `/api/v1/passport/export` | `GET` | `requireRole(['admin','super_admin'])` | `admin` (DEPT) / `super_admin` | Zod | None | **FAIL** (fail-open if `admin` lacks `departmentId`) |
| 83 | `/api/v1/passport/public/[shareToken]` | `GET` | Public | Revocable token (verified only) | Token lookup | 60/60s IP | **PASS** (in-memory XFF rate-limit caveat) |
| 84 | `/api/v1/passport/share` | `GET`, `PATCH` | `requireRole('student')` | Self | Zod | None | **PARTIAL** (`upsertByStudentId` E11000 race) |
| 85 | `/api/v1/passport/[id]` | `GET`, `PATCH`, `DELETE` | `requireAuth` / `student` | Author or verifier / author | ObjectId + Zod | None | **FAIL** (`GET` cross-dept faculty IDOR & fail-open admin; delete/resubmit races) |
| 86 | `/api/v1/passport/[id]/verify` | `POST` | `requireRole(['faculty','admin','super_admin'])` | Verifier | ObjectId + Zod | None | **FAIL** (cross-dept faculty IDOR — any faculty can verify/reject any dept's claims) |
| 87 | `/api/v1/polls` | `GET`, `POST` | `requireAuth` | Audience / publishing rules | Zod | None | **PARTIAL** (unescaped `$regex`; faculty w/o deptId bypass; N+1 vote lookup) |
| 88 | `/api/v1/polls/[id]` | `GET`, `DELETE` | `requireAuth` | Audience / creator,HOD,`sys_admin` | ObjectId | None | **FAIL** (`DELETE` cross-dept HOD IDOR) |
| 89 | `/api/v1/polls/[id]/archive` | `POST` | `requireAuth` | Creator/HOD/`sys_admin` | ObjectId | None | **FAIL** (cross-dept HOD IDOR) |
| 90 | `/api/v1/polls/[id]/close` | `POST` | `requireAuth` | Creator/HOD/Director/`sys_admin` | ObjectId | None | **FAIL** (cross-dept HOD IDOR) |
| 91 | `/api/v1/polls/[id]/results` | `GET` | `requireAuth` | Visibility policy only | ObjectId | None | **FAIL** (missing audience & draft checks) |
| 92 | `/api/v1/polls/[id]/vote` | `POST` | `requireAuth` | Audience + unique ballot | ObjectId + Zod | None | **PARTIAL** (closing race; error masking; hardcoded HMAC fallback; non-deduped `optionIds`) |
| 93 | `/api/v1/profile/me` | `GET`, `PATCH` | `requireAuth` | Self | Zod (swallows bad JSON) | None | **PARTIAL** (malformed JSON -> 200; `javascript:` `avatarUrl`) |
| 94 | `/api/v1/requests` | `GET`, `POST` | `requireAuth` | Student/admin(DEPT)/`super_admin` | Zod | None | **FAIL** (fail-open admin; unescaped `$regex`; `javascript:` URLs; concurrent 1-per-cat race) |
| 95 | `/api/v1/requests/stats` | `GET` | `requireAuth` | Student/admin (**no faculty check**) | None | None | **FAIL** (any faculty reads global campus stats) |
| 96 | `/api/v1/requests/[id]` | `GET` | `requireAuth` | Student/admin(DEPT)/`super_admin` | ObjectId | None | **FAIL** (fail-open if `admin` lacks `departmentId`) |
| 97 | `/api/v1/requests/[id]/action` | `POST` | `requireAuth` + role check | `admin`(DEPT)/`super_admin` | ObjectId + Zod | None | **FAIL** (fail-open admin; `javascript:` fulfillment URL) |
| 98 | `/api/v1/users/search` | `GET` | `requireAuth` | Active users | Manual query | **MISSING** | **FAIL** (no rate limit; exposes student `email` & `rollNumber`; non-ObjectId filter bug) |
| 99 | `/api/v1/users/[id]/profile` | `GET` | `requireAuth` | Context-aware privacy projection | ObjectId | None | **FAIL** (Director gets full `AdminProfileDTO` + private faculty phones) |

---

## 7. Authentication and RBAC Findings

### Role-Boundary Audit Matrix

| Role / Persona | Policy Requirement | Observed Implementation Status |
| :--- | :--- | :--- |
| **Unprovisioned / Public** | Closed registration; zero access without IT provisioning | **FAIL** — `/sign-up` redirects cleanly, but `getCurrentSession()` (`src/lib/auth/server.ts:48-72`) synthesizes an active `student` session if MongoDB has no user record; `verify-role/page.tsx:62-91` hardcodes personal Gmail & `admin01` to auto-bootstrap `super_admin`. |
| **Student** | Access only own academic records & authorized chats; no faculty/admin actions | **PARTIAL** — Properly blocked from admin/faculty portals, notices/polls creation, broadcasts, and group creation. **Breaches:** can overwrite `semester`/`section` in `GET /api/v1/assignments`; can view out-of-audience poll results; receives leaked `isInternal: true` grievance notes; can scrape all students' emails/rollNumbers via `/api/v1/users/search` and faculty emails/remarks via `/api/v1/facilities/[id]`. |
| **Faculty** | Authorized teaching groups & department academic tasks; no HOD/Director/SysAdmin actions | **FAIL** — Granted full HOD grievance access (`complaint.service.ts:180,414,533,581`); can verify/reject Skill Passport claims across ANY department; can create assignments for any course when `assignedCourses: []`; can read global Service Request stats; can broadcast `emergency`/`urgent` notifications to 200 arbitrary users campus-wide; can create groups for foreign departments. |
| **HOD (`admin` + `hod`)** | Strictly restricted to authorized department | **FAIL** — Can overwrite `departmentId`/`recipientRole` in `GET /api/v1/complaints` to read all campus & Director complaints; can archive/delete/read receipts of ANY notice and close/archive/delete ANY poll campus-wide; has global Facility approval/edit/cancel access (tautological `DEPT` check); sees global emergency acknowledgments (including raw IPs/UAs); fails open in `ServiceRequestService` and `PassportService` if `departmentId` is missing; meanwhile cannot edit/publish own-dept notices due to ObjectId vs code mismatch. |
| **Director (`super_admin` + `director`)** | Approved institutional oversight; no SysAdmin IAM/provisioning authority | **PARTIAL** — Properly blocked from User Provisioning & IAM Governance (`assertCanManageUserRoles`). **Breaches:** Treated as `sys_admin` in `ProfileService` (mutates academic profiles, reads private faculty phones & `AdminProfileDTO`), can export/verify Audit Logs, can enter `/super-admin/*`, and can self-add to private group chats. |
| **System Administrator (`super_admin` + `sys_admin`)** | IAM/system admin only; no Director authority or unrestricted access to private complaints/chats | **FAIL** — Equated to Director in `ComplaintService.assignComplaint` (`478`), allowed to reply/resolve/reject complaints (`255-360`), receives unredacted complaint subjects/responses/attachments/timeline (`213-247`), and root `super_admin` (no `adminSubRole`) bypasses narrative redaction completely (`196,213,244`). Can also add self to any private academic group chat (`chat.service.ts:393-402`) and grade student assignments (`assignment.service.ts:941`). |

### Additional Auth / Session / Lifecycle Defects
- **Stale Clerk JWTs & No Session Revocation:** Suspending, deactivating, or demoting a user never calls `SessionService.revokeAllUserSessions` (dead code in `src/lib/auth/session.ts`). All 5 portal layouts omit `deactivated`, `archived`, `graduated`, and `invited` checks; `requireAuth()` omits `graduated` and `invited`.
- **Dead Session Expiry Engine:** `SESSION_CONFIG` (30-min admin inactivity timeout, 30-day max session) in `src/lib/auth/session.ts` is completely unreferenced across `src/`.
- **Portal Switching Loop:** `/role-mismatch` links to `/sign-in` without clearing `axis_selected_portal`; `verify-role/page.tsx:103,176` calls `cookieStore.delete()` inside a Server Component (silently fails in Next.js App Router).
- **Blocked Logout for Non-Active Users:** `/api/auth/logout` is not in `isPublicRoute`, so suspended/pending/deactivated users are blocked by middleware from calling it.
- **Unstripped Spoofable Headers:** `middleware.ts:198-203` does not strip client-supplied `x-user-admin-sub-role` when unset or `x-user-*` on public/shared routes (currently latent — no downstream code reads these headers).
- **Production Export of Test Hook:** `__setTestSession` (`src/lib/auth/server.ts:20-28`) is exported into the production bundle via `src/lib/auth/index.ts:9` without a `NODE_ENV === 'test'` guard.

---

## 8. Database and Data Integrity Findings

All 22 Mongoose models, 19 repositories, and `src/lib/db/mongodb.ts` were inspected:

1. **Broken Compound Sparse Unique Index (`conversation.model.ts:114`):** `{ directKey: 1, type: 1 }, { unique: true, sparse: true }` indexes `{ directKey: null, type: 'group' }`, causing the **2nd group chat** in MongoDB to crash with `E11000`.
2. **Broken `unique + sparse` Indexes With `default: null` (`user.model.ts:154-180, 293-294`):** Persists explicit `null` for `username` and `authProviderId`, causing `E11000` on the 2nd user provisioned without a username or Clerk ID.
3. **Premature TTL Expiry of Password Recovery Proof (`otp.model.ts:93`, `otp.service.ts:36,253,286`):** 5-minute `expiresAt` TTL deletes/expires the 15-minute `proofTokenHash` 10 minutes early.
4. **Stale Connection Promise in `mongodb.ts:53-95`:** `cached.promise` is never cleared on disconnect, preventing reconnection after a transient Atlas network drop.
5. **4 Repositories Missing `connectToDatabase()`:** `chat.repository.ts`, `department.repository.ts`, `otp.repository.ts`, `user.repository.ts` fail on cold starts due to `bufferCommands: false`.
6. **Non-Atomic Code Generators (6 Repositories):** `service-request`, `facility-booking`, `audit-log`, `student-achievement`, `emergency-alert`, and `complaint` repositories all use non-atomic `countDocuments` -> `exists` without an atomic counter or `E11000` retry.
7. **Critical Concurrency Races:**
   - `FacilityService.reviewBooking` & `createBooking(autoApprove)`: TOCTOU double-booking race (no transaction/lock/`status: 'pending'` predicate).
   - `AuditService.recordEvent`: Concurrent writes fork `previousHash`, permanently breaking `verifyHashChain`; non-ObjectId `actorId` hashes string while saving random ObjectId.
   - `EmergencyService.triggerAlert` & `ServiceRequestService.submitRequest`: Missing partial unique indexes allow concurrent duplicates.
   - `PollRepository.recordVote`: Non-transactional fallback orphans ballots; update omits `status: 'active'`/`expiresAt` check; catches all `MongoServerError`s as duplicate votes.
   - `PasswordRecoveryService.resetPassword`: Consumes proof token *after* Clerk password update (TOCTOU replay).
   - `ChatRepository.addMembersToGroup`: `$addToSet` with fresh `joinedAt: new Date()` creates duplicate `members` subdocuments.
8. **Mongoose 9 Deprecations & Index Hygeine:** 38 occurrences of deprecated `{ new: true }` across 16 repositories; 9 models declare duplicate indexes; `user.repository.ts` omits `runValidators: true` on 5 update methods; `user.model.ts:46` caps `currentSemester` at 8 while 5 other models cap at 12; `audit-log.model.ts:180-184` omits `{ document: true }` on `pre('deleteOne')`; broken cursor pagination in `notice.repository.ts:90-98,204-214`.

---

## 9. Feature Workflow Audit Results

*(Results below combine static code-path verification and mocked unit/integration test runs; live browser & live Atlas/third-party E2E execution was NOT performed.)*

| Feature Workflow | Static / Mock Verification | Blocking Defects Identified |
| :--- | :---: | :--- |
| **Notices & Polls** | **PARTIAL** | Create/publish/vote/read-receipt backend logic works in mocked tests, but UI cannot publish/edit/archive drafts; student category filter values mismatch; HOD cross-dept IDOR on archive/delete/close/receipts; `getPollResults` omits audience check; `updateNotice`/`publishNotice` HOD check always false; broken cursor pagination. |
| **Grievances** | **FAIL** | Student submission, HOD/Director routing, and appeals exist in backend, **but** compose UI fakes attachment URLs; `queryWithFilters` allows cross-dept & Director complaint read bypass; all regular faculty get HOD access; `isInternal: true` notes leak to students; `sys_admin` has Director mutation rights & sees replies/attachments; student escalation skips SLA breach check; Admin dashboard buttons are dead. |
| **Chat** | **FAIL** | Direct chat creation, Ably token capability minting (no wildcards), and broadcast-only checks work in unit tests, **but** MongoDB compound sparse index breaks the **2nd group chat** (`E11000`); removed members keep live Ably access up to 60 min; `super_admin` can self-add to private groups; deleted messages retain attachments & `lastMessage` text; UI read-receipt effect loops and silently swallows send/delete failures; dead attach/emoji buttons. |
| **Assignments** | **PARTIAL** | Draft/publish/close/archive, submissions, revisions, late penalties, and grading work in 46+ unit tests, **but** student cohort filter overwrite IDOR on `GET /api/v1/assignments`; `FileUploader` drops all but last file on multi-select and lacks drag-and-drop; empty `assignedCourses: []` bypasses faculty course restriction; `sys_admin` can grade; bad JSON causes 500; re-grading over-increments `gradedCount`. |
| **Service Requests (MOD-13)** | **FAIL** | Backend workflow & MOD-17 notification hook work, **but** UI persists broken `blob:` URLs; `requests/stats` exposed to faculty; `admin` w/o `departmentId` fails open; Admin dashboard hardcodes `0` requests. |
| **Facility Bookings (MOD-14)** | **PARTIAL** | Directory & overlap checks work sequentially, **but** tautological `DEPT` check removes admin isolation; TOCTOU race under concurrent approvals; student lookups leak faculty requester email/employeeId/remarks. |
| **IAM Governance & Audit Logs (MOD-19)** | **PARTIAL** | Role/status controls & SHA-256 chain work sequentially, **but** concurrent audit writes fork the hash chain; UI caps at 100 rows without pagination; Clerk sessions not revoked on suspend/demote. |
| **Emergency Broadcasts (MOD-16)** | **PARTIAL** | Dual-confirm, Ably banner/takeover, critical audit log, and idempotent acks work; minor gaps in concurrent single-active enforcement, HOD ack scoping/IP PII exposure, and modal `Escape` handling. |
| **Skill Passport (MOD-15)** | **PARTIAL** | Claims, SHA-256 stamps, CSV export, and privacy-safe public link work, **but** cross-department faculty IDOR allows verifying/rejecting other departments' claims; fail-open admin scoping. |
| **In-App Notifications (MOD-17)** | **PARTIAL** | Inbox, 60s dedupe, 90-day TTL, and locked Emergency preferences work, **but** `all_users`/`by_role` broadcasts silently drop all users past 100; faculty/admin can push unmutable `emergency` alerts to 200 cross-dept users; hydration mismatch on timestamps. |
| **MOD-12 (Notes) & MOD-18 (Analytics)** | **NOT TESTED (Pending)** | Not implemented (permission keys only). |

---

## 10. External Integration Status

Strictly distinguishing implementation status, local configuration presence (inspected via secret-free boolean check — **zero secret values printed**), and live testability:

| Integration | Implementation Status | Local Workspace Config Status | Live Verification Status | Evidence & Critical Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Clerk** | Real SDK integrated (`@clerk/nextjs`, `svix`) | Configured with **TEST keys** (`pk_test_*` / `sk_test_*`) + `CLERK_WEBHOOK_SECRET` | **Not testable in current audit** (no live browser/webhook execution) | Must switch to `pk_live_*`/`sk_live_*` for production; webhook hardcodes `SA-ADMIN01` & returns 403 on unprovisioned users (infinite retries); active sessions never revoked on suspend/role change. |
| **MongoDB Atlas** | Real Mongoose ODM (`mongoose@^9.12.1`) | `MONGODB_URI` configured | **Not testable in current audit** (unit/integration tests mock repositories; read-only rule avoids live DB mutations) | `mongodb.ts:53-95` stale `cached.promise` blocks reconnect; 4 repos missing `connectToDatabase()`; `Conversation` & `User` unique sparse indexes will fail `E11000` on real MongoDB! |
| **Ably Realtime** | Real SDK (`ably@^2.30.0`) + `AblyBroker` + `/api/v1/chat/token` | `ABLY_API_KEY` configured | **Mock / fallback only in tests** (live WebSocket pub/sub not executed) | Fragile `scripts/patch-ably.js` mutates `node_modules` & spoofs `pubsub-device/3.1.0`; 60-min token TTL with no revocation; 3 separate client connections per tab (`useAblyChat`, `TopbarNotifications`, `EmergencyGlobalBanner`); broken unsigned 200 fallback on token error. |
| **Cloudinary** | Partial (SHA-1 signature in `AssignmentService` only; **not wired** in Complaints/Requests) | **Configuration missing** (`CLOUD_NAME`, `API_KEY`, `API_SECRET` all missing locally) | **Configuration missing / Mock fallback** | Signature omits `allowed_formats`, `max_file_size`, per-user folder isolation, and rate limiting. Complaints fabricate fake URLs; Requests save `blob:` URLs. |
| **Resend / Email** | **Mock / No-op stub ONLY** (`src/lib/services/email.service.ts:45-89`) | **Configuration missing** (`RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `SMTP_HOST` all missing) | **Integration not implemented** | Even when `RESEND_API_KEY` or `SMTP_HOST` IS provided, `EmailService` makes **zero HTTP/SMTP calls** (`resend`/`nodemailer` not installed) and falsely returns `{ success: true }`. |
| **Firebase Cloud Messaging (FCM)** | **Integration not implemented** | **Configuration missing** | **Integration not implemented** | Zero Firebase packages or FCM/push-token code anywhere in `src/` (only commented lines previously in `.env.example`). |
| **Canonical App URL (`NEXT_PUBLIC_APP_URL`)** | Referenced in emails, activation links, and `env-validator.ts` | **Configuration missing** locally | **Configuration missing** | `scripts/verify-production-env.ts` also fails locally because it does not load `.env.local`/`.env`. |

---

## 11. Security Audit Summary

| Security Domain | Finding Summary | Severity |
| :--- | :--- | :---: |
| **Secrets in Git / Source** | `git ls-files` confirms `.env`/`.env.local` are **NOT** git-tracked (only `.env.example`). `git grep` found zero live API keys or DB URIs. **However:** hardcoded personal Gmail (`hey.prashantumrao@gmail.com`) & `admin01` super_admin auto-bootstrap (`verify-role/page.tsx:64-66`), plus hardcoded HMAC fallback secrets (`otp.service.ts:280,316`, `poll.service.ts:40`). | **Critical** |
| **Broken Access Control / IDOR** | Cross-dept & Director grievance filter overwrite (`complaint.repository.ts:360-376`), regular faculty HOD grievance access (`complaint.service.ts:180,581`), `sys_admin`/Director conflation (`complaint.service.ts`, `profile.service.ts`, `chat.service.ts`, `audit.service.ts`), HOD cross-dept notice/poll destruction (`notice.service.ts`, `poll.service.ts`), tautological facility `DEPT` bypass (`facility.service.ts:60-81`), faculty cross-dept passport verification (`passport.service.ts:524`), student assignment cohort overwrite (`assignment.service.ts:636-637`), cross-dept `specific_users` emergency notification abuse (`notification.service.ts:359`). | **Critical** |
| **Authentication Bypass** | Unprovisioned Clerk users gain active `student` session via `getCurrentSession()` fallback (`src/lib/auth/server.ts:48-72`); stale Clerk JWTs remain active after suspension/demotion (no session revocation); 5 layouts omit `deactivated`/`archived`/`graduated`/`invited` checks. | **Critical** |
| **Rate Limiting & Brute-Force** | Only 5 of 99 routes enforce rate limits. Missing on `/api/v1/auth/otp/verify`, `/otp/resend`, `/activation/validate`, `/activation/complete`, `/password-recovery/reset`, `/users/search`, `/chat/users`, `/assignments/upload-signature`, `/chat/token`. In-memory `Map` + leftmost `X-Forwarded-For` (`rate-limiter.ts:120-127`) is bypassable across serverless instances or via spoofed headers. | **High** |
| **XSS & Unsafe URLs** | No user-controlled `dangerouslySetInnerHTML`. **However**, Zod `z.string().url()` in 6 validation schemas (`assignment`, `chat`, `complaint`, `notice`, `service-request`, `user` avatarUrl) accepts `javascript:` and `data:` schemes (stored XSS risk on render). | **Medium** |
| **Injection Risks (ReDoS / NoSQL)** | Unescaped user `search` strings passed directly into `new RegExp()` / `$regex` in `complaint.repository.ts:375`, `poll.service.ts:442`, `service-request.service.ts:147,213`. Unvalidated `sortBy` strings in `complaint.schema.ts:178` and `service-request.schema.ts:192`. | **Medium** |
| **Unsafe File Uploads** | Cloudinary signed upload (`assignment.service.ts:1012-1025`) enforces zero `allowed_formats`, zero `max_file_size`, zero per-user folder isolation, and zero rate limits; `assignment.schema.ts:44` permits `image/*` (including SVG) and `application/octet-stream`. | **High** |
| **Sensitive Data & Logging** | Unmasked email disclosure on username password recovery (`password-recovery.service.ts:95`); `isInternal: true` complaint notes leaked to students; student email/rollNumber exposed via `/users/search`; raw IP/UA exposed to HODs in emergency acks; raw emails logged in `chat.service.ts` & `password-recovery.service.ts`; `logger.ts:38-41` crashes on circular references; `api-error-handler.ts:63-97` leaks raw Mongoose field paths & `keyPattern`. | **High** |
| **HTTP Security Headers** | All 6 headers (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`) and `poweredByHeader: false` configured in `next.config.ts`. Note: No `Content-Security-Policy` (CSP) header is configured yet. | **Low / Info** |
| **Dependency Vulnerabilities (`npm audit --omit=dev`)** | **12 vulnerabilities** in production dependencies (**0 Critical, 9 High, 3 Moderate**): `shadcn@^4.23.0` (wrongly in `dependencies`) pulls in 9 high + 2 moderate (`picomatch` ReDoS GHSA-fc5q-39xc-vjpf, `fast-glob`, `micromatch`, `@dotenvx/dotenvx`, `@shadcn/registry`, `@ts-morph/common`, `fdir`, `minimatch`, `ts-morph`); `next@15.5.29` bundles vulnerable `postcss<=8.5.22` (GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-qx2v-qp2m-jg93, GHSA-fxqj-rqcc-2cmp). | **High** |

---

## 12. Performance and Reliability Findings

1. **Production Bundle & Middleware Metrics (`next build`):**
   - Compiled cleanly in `14.5s`; Shared First Load JS: `103 kB`; Middleware: `93.5 kB`.
   - Largest First Load JS pages: `/student|faculty|admin/messages` (`311 kB`), `/admin/dashboard` (`307 kB`), `/faculty/dashboard` (`296 kB`), `/student/dashboard` (`291 kB`).
   - Webpack cache warning observed during build: `Serializing big strings (281kiB) impacts deserialization performance`.
2. **Realtime Connection Multiplication & Listener Leaks:**
   - Up to **3 concurrent `Ably.Realtime` WebSocket clients per browser tab** (`EmergencyGlobalBanner`, `TopbarNotifications`, `useAblyChat`) instead of a shared singleton client.
   - `useAblyChat.ts:87-194,218,270-275` leaks a live socket if unmounted during `/api/v1/chat/token` fetch and never removes `channel.on('failed', ...)` listeners.
   - `ChatLayout` (`chat-layout.tsx:70-110`) re-triggers `POST /api/v1/chat/conversations/[id]/read` on every `messagesMap` state update (read-receipt API storm).
3. **Database N+1 & Unbounded Queries:**
   - `NotificationService.broadcastAlert` (`notification.service.ts:388-404`): executes 3 sequential DB queries + 1 Ably REST call per recipient inside `for...of` (never uses `NotificationRepository.createMany`).
   - `ChatService.sendMessage` (`chat.service.ts:498-515`): sequential `for...of` Ably REST calls per participant.
   - `GET /api/v1/chat/token` (`route.ts:22`): calls full `ChatService.getUserConversations` (hydrating avatars & unread counts via N+1) just to extract conversation IDs/types.
   - `PollService.getPollFeed` (`poll.service.ts:480-486`): sequential `await PollRepository.findVote(...)` per poll.
   - `NoticeRepository.countUnreadForUser` (`notice.repository.ts:244-253`): loads all read receipts into memory for an unbounded `$nin` query.
   - `ChatRepository.markMessagesAsRead` (`chat.repository.ts:354-362`): updates unbounded `readBy` array across all messages in a conversation.
4. **Missing Pagination & Hard 100-Row Ceilings:**
   - `AuditLogsView` (100 rows), `IamGovernanceView` (100 users), `AdminSpacesView`/`FacultySpacesView` (100 bookings), `StudentPassportView`/`PassportVerificationView` (100 claims), `StudentRequestsView`/`AdminRequestsQueueView` (50/100), `StudentComplaintsView`/`AuthorityComplaintsView` (50), `StudentAssignmentView`/`FacultyAssignmentView` (50/100).
   - `student/dashboard/components/notice-feed.tsx:48-80,155` fires `/api/v1/notices` on every keystroke without debouncing.
5. **Memory & Timer Leaks:**
   - `StudentRequestComposeModal` calls `URL.createObjectURL(file)` without `URL.revokeObjectURL()`.
   - Uncleaned `setTimeout` calls in `otp-input.tsx:89,199`, `student-passport-view.tsx:127`, `profile-edit-dialog.tsx:124`.
   - `mongodb.ts:53-95` fails to clear `cached.promise` on disconnect, preventing automatic recovery after transient Atlas outages.

---

## 13. Automated Test Execution Results

All read-only verification commands were freshly executed during this audit:

| Check | Command | Exit Code | Observed Result |
| :--- | :--- | :-: | :--- |
| **TypeScript Strict Check** | `npm run typecheck` (`tsc --noEmit`) | `0` | **PASS** — 0 errors |
| **ESLint** | `npm run lint` (`eslint`) | `0` | **PASS** — 0 errors, 0 warnings |
| **Unit Test Suite** | `npm test` (`npx tsx --test tests/unit/**/*.test.ts`) | `0` | **PASS** — **832 / 832** passed across 251 suites (mocked repositories + SSR static markup) |
| **Integration Test Suite** | `npm run test:integration` | `0` | **PASS** — **5 / 5** cross-module workflows passed (mocked in-memory stores) |
| **Combined Suite** | `npm run test:all` | `0` | **PASS** — **837 / 837** passed (0 failures) |
| **Production Build** | `npm run build` (`next build`) | `0` | **PASS** — Compiled in 14.5s; 39/39 static pages + all dynamic portal/API routes built |
| **Prod Env Pre-Flight** | `npm run verify:prod -- --strict` | `1` | **FAIL** — All 11 vars reported `[MISSING]` because CLI checks `process.env` without loading `.env.local`; local `.env`/`.env.local` also lacks `NEXT_PUBLIC_APP_URL`, Cloudinary, and Resend keys, and uses Clerk `pk_test_`/`sk_test_` keys. |
| **Dependency Audit** | `npm audit --omit=dev --json` | `1` | **FAIL** — 12 prod vulnerabilities (**9 High, 3 Moderate**, 0 Critical) |
| **Browser E2E / Lighthouse** | N/A | N/A | **NOT TESTED** — Playwright, Cypress, and Lighthouse are not installed in `package.json`. |

---

## 14. Browser, Live Integration & Manual Testing Limitations

Because this was a strictly read-only audit with **no Playwright/Cypress/Lighthouse packages installed** and **missing live Cloudinary/Resend credentials + Clerk test keys**, the following were **NOT** executed and **MUST** be manually verified by the QA/Engineering team after defect fixes:

1. **Responsive Viewport Testing (Not Tested in Live Browser):** Visual layout, horizontal overflow, touch targets, drawer transitions, and contrast at **360px, 390px, 768px, 1366px, and 1440px** across all 36 routes in light and dark themes.
2. **Real Browser Hydration & Console Verification (Not Tested):** Confirming zero React hydration mismatch warnings (especially on the 9 flagged `Date.now()`/`new Date()` components) and zero runtime network 4xx/5xx failures across live sessions.
3. **Live Third-Party Runtime Verification (Not Tested):**
   - Clerk live login (username + email), portal-door enforcement, Svix webhook delivery, session expiry, and password reset against a live Clerk Production instance.
   - Real MongoDB Atlas index creation (`Conversation` group chat creation, `User` pre-provisioning without username, `Otp` TTL behavior, replica-set transactions, concurrent load tests).
   - Real Ably WebSocket message delivery, presence, offline reconnection, and multi-tab fan-out.
   - Real Cloudinary signed direct uploads and download rendering across Assignments, Complaints, Service Requests, and Skill Passport.
   - Real Resend email delivery (after replacing the `EmailService` no-op stub) including SPF/DKIM/DMARC inbox placement.
4. **Lighthouse Accessibility & Performance Audits (Not Tested):** WCAG 2.1 AA color contrast ratios, keyboard tab order, and Core Web Vitals (LCP/INP/CLS).

---

## 15. Critical and High-Priority Defects

### CRITICAL DEFECTS (10)

#### `AUD-C01` — Cross-Department & Director Grievance Read Bypass (Query Parameter Overwrite)
- **Severity:** Critical
- **Affected Module & Route/API:** Grievances — `GET /api/v1/complaints`
- **File & Lines:** `src/lib/db/repositories/complaint.repository.ts:349-382`, `src/app/api/v1/complaints/route.ts:22-58`
- **Reproduction Steps:** Authenticate as Dept A HOD (or any Dept A faculty via `AUD-C02`); request `GET /api/v1/complaints?departmentId=<DEPT_B_ID>&recipientRole=director`. Also as Director, request `GET /api/v1/complaints?search=a` (overwrites `baseFilter.$or`).
- **Expected Behavior:** Base authorization scope (`departmentId`, `recipientRole`, `$or`) must be immutable and combined via `$and`.
- **Actual Behavior:** `queryWithFilters` unconditionally overwrites `filter.recipientRole`, `filter.departmentId`, and `filter.$or` with caller query params, exposing all campus & confidential Director grievances.
- **Evidence:** `complaint.repository.ts:360-365, 376`: `if (params.recipientRole) filter.recipientRole = params.recipientRole; if (params.departmentId ...) filter.departmentId = ...; if (params.search) filter.$or = ...`.
- **Recommended Correction:** Combine `baseFilter` and user query filters using `{ $and: [baseFilter, userFilter] }` and disallow non-Director/SysAdmin callers from overriding scope fields.

#### `AUD-C02` — All Regular Non-HOD Faculty Granted Full Departmental HOD Grievance Access
- **Severity:** Critical
- **Affected Module & Route/API:** Grievances — `GET /api/v1/complaints`, `GET /api/v1/complaints/[id]`, `POST /api/v1/complaints/[id]/responses`, `POST /api/v1/complaints/[id]/escalate`, `GET /api/v1/complaints/stats`
- **File & Lines:** `src/lib/services/complaint.service.ts:179-182, 413-415, 531-535, 579-591`
- **Reproduction Steps:** Authenticate as a regular `faculty` (`adminSubRole: null`) with a `departmentId`; call any of the 5 endpoints above.
- **Expected Behavior:** Unassigned regular faculty must receive HTTP 403 Forbidden; only HOD (`adminSubRole === 'hod'`) or explicitly assigned inquiry officers (`assignedTo.id === session.userId`) may access complaints.
- **Actual Behavior:** Conditions include `(session.role === 'faculty' && session.departmentId)`, letting any regular faculty read, reply to, and escalate confidential student complaints (including complaints filed against themselves).
- **Evidence:** `complaint.service.ts:180, 581`: `(session.role === 'faculty' && session.departmentId)`.
- **Recommended Correction:** Remove `session.role === 'faculty'` from all HOD branches; grant faculty access solely when `complaint.assignedTo?.id?.toString() === session.userId`.

#### `AUD-C03` — System Administrator Gains Director Grievance Mutation Authority & Unredacted Complaint Content
- **Severity:** Critical
- **Affected Module & Route/API:** Grievances — `/api/v1/complaints/**`
- **File & Lines:** `src/lib/services/complaint.service.ts:196-250, 255-326, 350-394, 478, 518, 602-605`
- **Reproduction Steps:** Authenticate as `super_admin` (`sys_admin` or root `super_admin` without `adminSubRole`); call `GET /api/v1/complaints`, `GET /api/v1/complaints/[id]`, `POST .../responses`, `PATCH .../status`, or `POST .../assign`.
- **Expected Behavior:** System Administrator must NOT have Director adjudication authority or access to private complaint narratives, dialogue, or evidence attachments.
- **Actual Behavior:** Root `super_admin` without `adminSubRole` bypasses redaction entirely; even `sys_admin` sees unredacted `subject`, `responses` (including internal notes), `attachments`, `escalation.reason`, and `timeline`, and can reply, resolve, close, reject, and assign complaints (`const isDirector = session.adminSubRole === 'director' || session.role === 'super_admin'`).
- **Evidence:** `complaint.service.ts:196, 213-217, 244-247, 478, 602-605`.
- **Recommended Correction:** Use `isDirector(session)` vs `isSysAdmin(session)` consistently; block `sys_admin` from `addResponse`, `updateStatus`, `assignComplaint`, and strip `subject`/`narrative`/`description`/`responses`/`attachments`/`escalation.reason` for metadata-only oversight (or deny entirely per policy).

#### `AUD-C04` — Closed Registration Bypass via `getCurrentSession()` Fallback for Unprovisioned Clerk Users
- **Severity:** Critical
- **Affected Module & Route/API:** Authentication — All authenticated routes & `/api/v1/*`
- **File & Lines:** `src/lib/auth/server.ts:48-72`, `src/middleware.ts:50-53, 168-188`
- **Reproduction Steps:** Authenticate via Clerk with an account NOT present in MongoDB; navigate directly to `/student/dashboard` or call `GET /api/v1/notices`, `/api/v1/users/search`, or `/api/v1/facilities`.
- **Expected Behavior:** Unprovisioned accounts must be denied access (HTTP 401/403 or redirect to `/unauthorized`).
- **Actual Behavior:** `getCurrentSession()` catches `if (!user)` and synthesizes `{ role: 'student', status: 'active' }`, passing `requireAuth()` and granting active student access across APIs and pages.
- **Evidence:** `src/lib/auth/server.ts:48-72`: `if (!user) { ... return { userId, ..., role: metadata.role || 'student', status: metadata.status || 'active' }; }`.
- **Recommended Correction:** Return `null` from `getCurrentSession()` when `UserRepository.findByAuthProviderId(userId)` finds no MongoDB record (fail-closed).

#### `AUD-C05` — Hardcoded Personal Email & `admin01` Auto-Bootstrap to Root `super_admin`
- **Severity:** Critical
- **Affected Module & Route/API:** Authentication — `/auth/verify-role` & `POST /api/webhooks/clerk`
- **File & Lines:** `src/app/auth/verify-role/page.tsx:62-91`, `src/app/api/webhooks/clerk/route.ts:115-138`
- **Reproduction Steps:** Sign in via Clerk using `hey.prashantumrao@gmail.com` or username `admin01` without pre-provisioning in MongoDB; visit `/auth/verify-role`.
- **Expected Behavior:** Root administrators must be provisioned explicitly via controlled institutional seeding/CLI—never hardcoded personal emails in runtime production routes.
- **Actual Behavior:** Runtime route automatically creates an active `super_admin` (`sys_admin`, `emergencyOverridePermitted: true`, `SA-ADMIN01`) in MongoDB.
- **Evidence:** `verify-role/page.tsx:64-66`: `primaryEmail.toLowerCase().trim() === 'hey.prashantumrao@gmail.com' || username?.toLowerCase().trim() === 'admin01'`.
- **Recommended Correction:** Remove hardcoded email/username auto-bootstrap from `verify-role/page.tsx` and webhook handler; bootstrap initial admin exclusively via one-time secure seed script.

#### `AUD-C06` — Compound Sparse Unique Index Breaks 2nd Group Chat Creation (`E11000`)
- **Severity:** Critical
- **Affected Module & Route/API:** Chat — `POST /api/v1/chat/conversations` (`type: 'group'`)
- **File & Lines:** `src/lib/db/models/conversation.model.ts:114`, `src/lib/db/repositories/chat.repository.ts:131-142`
- **Reproduction Steps:** Against real MongoDB, create Group Chat #1 (`type: 'group'`, `directKey: undefined`), then create Group Chat #2.
- **Expected Behavior:** Unlimited group conversations can be created while direct conversations remain unique per participant pair.
- **Actual Behavior:** MongoDB indexes `{ directKey: null, type: 'group' }` because compound `sparse: true` only omits documents missing *all* indexed fields; Group Chat #2 fails with `E11000 duplicate key error`.
- **Evidence:** `conversation.model.ts:114`: `ConversationSchema.index({ directKey: 1, type: 1 }, { unique: true, sparse: true });`.
- **Recommended Correction:** Replace with `partialFilterExpression: { type: 'direct', directKey: { $type: 'string' } }` and drop the old sparse index in Atlas.

#### `AUD-C07` — `default: null` Breaks `unique + sparse` Indexes on `User.username` & `User.authProviderId`
- **Severity:** Critical
- **Affected Module & Route/API:** User Provisioning & Profiles — `POST /api/v1/admin/users/provision`, `/bulk/provision`
- **File & Lines:** `src/lib/db/models/user.model.ts:154-180, 293-294`
- **Reproduction Steps:** Against real MongoDB, provision two pre-provisioned/legacy users without a `username` or without an `authProviderId`.
- **Expected Behavior:** Multiple users may have unset `username` or pending `authProviderId` prior to activation.
- **Actual Behavior:** Mongoose persists explicit `null` via `default: null`, which MongoDB `sparse: true` indexes—failing the 2nd insert with `E11000`.
- **Evidence:** `user.model.ts:157, 179, 293-294` (`default: null` + `{ unique: true, sparse: true }`).
- **Recommended Correction:** Switch both indexes to `partialFilterExpression: { <field>: { $type: 'string' } }` (matching `studentProfile.enrollmentNumber` at lines 296-304).

#### `AUD-C08` — `EmailService` Is a Complete No-Op Stub (Zero Production Emails Sent)
- **Severity:** Critical
- **Affected Module & Route/API:** Email / Auth — `/api/v1/auth/otp/request`, `/otp/resend`, `/password-recovery/request`, `/admin/users/provision`, `/activation/resend`
- **File & Lines:** `src/lib/services/email.service.ts:45-89`, `package.json`
- **Reproduction Steps:** Configure `RESEND_API_KEY` or `SMTP_HOST` and request an OTP or password recovery email.
- **Expected Behavior:** Real email dispatched via Resend API/SDK or SMTP with delivery error handling.
- **Actual Behavior:** Logs `[EmailService] Dispatched ...` and returns `{ success: true }` without making any network/SMTP request (`resend`/`nodemailer` are not installed).
- **Evidence:** `email.service.ts:54-64`: `if (resendApiKey) { // Future integration with Resend SDK ... return { success: true, ... }; }`.
- **Recommended Correction:** Implement real Resend REST/SDK dispatch (with `EMAIL_FROM_ADDRESS`, timeout, and error propagation) and remove fake `{ success: true }` stub responses in production.

#### `AUD-C09` — Broken Attachment Uploads in Complaints (Fake URLs) & Service Requests (`blob:` URLs) + `OtpInput` Infinite Send Loop
- **Severity:** Critical
- **Affected Module & Route/API:** Complaints (`/student/complaints`), Service Requests (`/student/requests`), Activation/Recovery (`OtpInput`)
- **File & Lines:** `src/components/complaints/complaint-compose-form.tsx:80-102`, `src/components/requests/student-request-compose-modal.tsx:148-158`, `src/components/auth/otp-input.tsx:61-108`
- **Reproduction Steps:**
  1. Attach a file in Student Complaint Compose -> submits non-existent `https://storage.axislinkup.internal/evidence/...` URL.
  2. Attach a file in Student Service Request Compose -> submits ephemeral `blob:http://...` URL (fails after reload and for admins).
  3. Open `/activate` (`autoSendOnMount={true}`) -> wait 60s or observe initial failure -> `useEffect` repeatedly triggers `handleRequestOtp` because `[isSending, cooldown]` are in `useCallback` deps.
- **Expected Behavior:** Attachments must upload via signed Cloudinary endpoints before ticket creation; `OtpInput` must auto-send at most once on mount via a `hasSentRef` guard.
- **Actual Behavior:** Evidence attachments are permanently broken/unreadable; `/activate` spams OTP requests until HTTP 429.
- **Recommended Correction:** Wire `FileUploader` (after fixing `AUD-H14`) into Complaints and Service Requests; guard `OtpInput` mount effect with a `useRef(false)` sentinel.

#### `AUD-C10` — Database/Concurrency Integrity Blockers (5-Min OTP TTL Killing 15-Min Proof, Facility TOCTOU Double-Booking, Audit Chain Fork, 100-User Broadcast Truncation, 60-Min Unrevoked Chat Tokens)
- **Severity:** Critical
- **Affected Modules & Routes:** Auth Recovery, Facility Bookings, Security Audit Logs, Notification Broadcasts, Real-Time Chat
- **Files & Lines:**
  - `src/lib/db/models/otp.model.ts:93` + `src/lib/services/otp.service.ts:36,253,286` (5-min TTL deletes 15-min proof token early)
  - `src/lib/services/facility.service.ts:306-384,394-466` (TOCTOU double-booking race with no transaction/lock)
  - `src/lib/services/audit.service.ts:156-210` (concurrent `recordEvent` forks `previousHash`, breaking chain verification; non-ObjectId `actorId` hash mismatch)
  - `src/lib/services/notification.service.ts:372-382` (`all_users`/`by_role` silently truncated at 100 users)
  - `src/app/api/v1/chat/token/route.ts:54-68` + `src/lib/services/chat.service.ts:404-417` (removed members / suspended users keep live Ably access for up to 60 min with no token revocation)
- **Recommended Correction:** Extend `otpDoc.expiresAt` by 15 min in `setVerificationProof`; wrap facility approvals in MongoDB transactions + status predicate; serialize audit chain writes via distributed lock/atomic counter + unique `previousHash` retry; paginate/cursor all recipients + batch insert via `createMany` in `broadcastAlert`; shorten Ably token TTL (e.g., 5–10 min) and invoke `rest.auth.revokeTokens` on member removal/suspension.

---

### HIGH-PRIORITY DEFECTS (18)

| ID | Module & Route/API | File & Lines | Defect Summary (Observed vs Expected) | Recommended Correction |
| :--- | :--- | :--- | :--- | :--- |
| `AUD-H01` | Grievances (`GET /api/v1/complaints/[id]`, `POST .../responses`) | `complaint.model.ts:373-397`, `complaint.service.ts:211-250,293` | `isInternal: true` tribunal notes are returned to student complainants; students can also post `isInternal: true`. | Filter out `isInternal === true` responses for `student` role and force `isInternal: false` on student submissions. |
| `AUD-H02` | Notices (`DELETE`, `POST /archive`, `GET /receipts`, `PATCH`, `POST /publish`) | `notice.service.ts:349,411,449,486,651` | Any HOD can archive, delete, or view receipts of ANY notice campus-wide (missing dept check); `update`/`publish` compare ObjectId vs `departmentCode` (always `false`). | Enforce target department match against `callerSession.departmentId` consistently across all HOD notice operations. |
| `AUD-H03` | Polls (`POST /close`, `/archive`, `DELETE`, `GET /results`, `POST /vote`) | `poll.service.ts:40,358,520,554,591,605-650`, `poll.repository.ts:177,222,231` | Any HOD can close/archive/delete polls campus-wide; `getPollResults` omits audience & draft checks; `recordVote` omits `status:'active'`/`expiresAt` guard, masks all Mongo errors as duplicate votes, fails to deduplicate `optionIds`, and uses hardcoded HMAC fallback. | Add dept scope checks for HODs, enforce `matchesPollAudience` on `getPollResults`, add status/expiry predicates to `recordVote`, deduplicate `optionIds`, and require env HMAC secret. |
| `AUD-H04` | Profiles (`GET /api/v1/users/[id]/profile`, `PATCH /admin/users/[id]/academic-profile`) | `profile.service.ts:91,345,511-512` | Checks `role === 'super_admin' \|\| adminSubRole === 'sys_admin'`, allowing Executive Director to read private faculty phones, view `AdminProfileDTO`, and mutate student/faculty academic profiles. | Replace with `isSysAdmin(callerSession)` in all three locations. |
| `AUD-H05` | Chat (`POST /conversations/[id]/members`, `PATCH /conversations/[id]`, `DELETE .../messages/[id]`) | `chat.service.ts:181,354-402,574-610`, `chat.repository.ts:203-224,412-428` | `super_admin` can add self to any private group without membership; `softDeleteMessage` omits participant check, retains `attachments` & `lastMessage` plaintext; `addMembersToGroup` duplicates `members` subdocs. | Restrict group management/deletion to active group members; clear `attachments` & update `lastMessage` on delete; prevent duplicate member subdocs via `$elemMatch` guard. |
| `AUD-H06` | Facilities (`/api/v1/facilities/**`) | `facility.service.ts:60-81,94,134,399,513,584` | `canApproveSpaces` passes `scopeDept` as both resource & user dept (always `true`), removing all departmental isolation for `admin` across CRUD, queue listing, approval, and cancellation. | Resolve actual facility/booking department and pass it as `context.departmentId`; fail closed if `admin` lacks `departmentId`. |
| `AUD-H07` | Skill Passport (`/api/v1/passport`, `/[id]`, `/[id]/verify`, `/export`) | `passport.service.ts:352-366,419-429,524-532` | Faculty completely bypasses department isolation on `GET /[id]` and `POST /[id]/verify`; `admin` without `departmentId` fails open to global access across queue, verification, and NAAC/NIRF export. | Enforce fail-closed department matching for both `faculty` and `admin` across all read/verify/export methods. |
| `AUD-H08` | Notifications (`POST /api/v1/notifications/broadcast`) | `notification.service.ts:74,328-360` | `faculty`/`admin` using `targetScope: 'specific_users'` can push unmutable `category: 'emergency'` / `priority: 'urgent'` alerts to up to 200 arbitrary users across any department. | Validate `recipientUserIds` belong to caller's department for non-`super_admin` and restrict `category: 'emergency'` / `priority: 'urgent'` to `super_admin`. |
| `AUD-H09` | Service Requests (`GET /api/v1/requests/stats`, `/requests/**`) | `service-request.service.ts:194,266,298,384-399` | `GET /requests/stats` never blocks `faculty` (returns global counts); `admin` without `departmentId` fails open to global read/approve/reject access. | Reject `faculty` with 403 in `getRequestStats`; fail closed (403) whenever `admin` lacks a resolvable `departmentId`. |
| `AUD-H10` | Assignments (`GET /api/v1/assignments`, `POST /api/v1/assignments`, `POST .../evaluate`) | `assignment.service.ts:157,587-608,636-637,941` | Student query params `?semester=&section=` overwrite cohort isolation; empty `assignedCourses: []` lets faculty create assignments for any course; `sys_admin` allowed to grade coursework. | Ignore caller `semester`/`section` overrides for students; enforce explicit course assignment; remove `sys_admin` from grading rights. |
| `AUD-H11` | Auth Public Endpoints (`/api/v1/auth/**`, `/users/search`, `/chat/users`, `/upload-signature`, `/chat/token`) | `password-recovery.service.ts:68-105`, `otp.service.ts:74-91,280,316`, `activation.service.ts:86-121`, `rate-limiter.ts:120-127` | Username recovery leaks full unmasked `email` & account status; OTP/activation leak existence/status; 9 high-risk endpoints have zero rate limiting; in-memory XFF limiter bypassable; hardcoded OTP HMAC fallback secret. | Unify public auth responses without email/status leaks; add distributed rate limiting (Upstash/Redis) on all public auth, search, and token/upload routes; require env HMAC secret. |
| `AUD-H12` | Auth Lifecycle & Layouts (`middleware.ts`, `server.ts`, all 5 layouts) | `middleware.ts:135-188`, `server.ts:101-118`, `(student\|faculty\|admin\|super-admin\|shared)/layout.tsx` | Suspending/demoting users never revokes Clerk sessions (`SessionService.revokeAllUserSessions` is dead code); all 5 layouts omit `deactivated`/`archived`/`graduated`/`invited`; `requireAuth()` permits `graduated`/`invited`; middleware sends 307 HTML redirects to `/api/*` for non-active statuses. | Revoke Clerk sessions on suspend/deactivate/role-change; check `status !== 'active'` uniformly across middleware (JSON 403 for `/api/*`), `requireAuth()`, and all 5 layouts. |
| `AUD-H13` | Cloudinary Uploads (`/api/v1/assignments/upload-signature`) | `assignment.service.ts:997-1035`, `upload-signature/route.ts` | Signature signs only `folder` + `timestamp` — zero `allowed_formats`, zero `max_file_size`, zero per-user folder isolation, zero rate limiting. | Sign strict upload preset / `allowed_formats`, `max_file_size`, user-scoped folder (`.../${session.userId}`), and rate-limit endpoint. |
| `AUD-H14` | File Uploader UI & Multi-File Loss | `src/components/assignments/file-uploader.tsx:204,226-252` | Stale `attachments` closure drops all but last file in multi-file selection; advertised drag-and-drop has zero `onDragOver`/`onDrop` handlers. | Accumulate uploaded items locally and pass full array to `onAttachmentsChange`; implement `onDragOver`/`onDrop` handlers. |
| `AUD-H15` | Database Connection & Reliability (`mongodb.ts`, 4 repos, `logger.ts`, `api-error-handler.ts`, `patch-ably.js`) | `mongodb.ts:53-95`, `chat/department/otp/user.repository.ts`, `logger.ts:38-41`, `api-error-handler.ts:63-97`, `scripts/patch-ably.js` | `cached.promise` never cleared on disconnect; 4 repos omit `connectToDatabase()` with `bufferCommands: false`; `logger.ts` crashes with circular-JSON `TypeError`; `api-error-handler` leaks Mongoose field paths/`keyPattern`; fragile `patch-ably.js` spoofs SDK agent; 6 non-atomic code generators race `E11000`. | Clear `cached.promise` on disconnect; add `connectToDatabase()` to all 4 repos; use `WeakSet` cycle detection in `logger.ts`; sanitize `E11000`/validation messages; replace sequential code generators with atomic MongoDB counters + retry. |
| `AUD-H16` | Dashboard Mock Data, Dead Buttons & Broken 404 Links | `hod-grievance-desk.tsx:114-129`, `director-appeal-desk.tsx:109-120`, `teaching-modules.tsx:141`, `src/app/page.tsx:68`, `navigation.ts:241-250`, `notice-management.tsx:354`, `poll-management.tsx:237` | Admin grievance/appeal buttons have no `onClick` handlers; Faculty "Manage Roster" links to 404 `/faculty/classes`; Public landing links to 404 `/ui-preview` in prod; `admin` sidebar `/faculty/assignments` redirects back to dashboard; Admin notices/polls hardcode `currentUserRole="super_admin"`; live widgets mixed with hardcoded mock courses/mentors/KPIs & stale disabled `"Phase 5"` quick actions. | Replace dashboard mocks with live API fetches or links to live pages; remove `/faculty/classes`, prod `/ui-preview` header link, and duplicate `admin` `/faculty/assignments` nav item; pass real `session.role` & `departmentId` to Admin notices/polls. |
| `AUD-H17` | Broken Interactive UIs (Notices Drafts/Filter, Chat Loop & Silent Failures) | `notice-detail-dialog.tsx`, `notice-feed.tsx:165-173`, `chat-layout.tsx:70-110,295-319,428`, `chat-conversation-view.tsx:396-416` | Draft notices cannot be published/edited/archived in UI; student notice filter (`event`/`general`) mismatches creation (`event_cultural`/`fee_accounts`); `ChatLayout` `messagesMap` dep triggers read-receipt loop and silently swallows send/delete failures; dead attach/emoji buttons; hidden mobile info panel. | Wire Publish/Edit/Archive buttons in `NoticeDetailDialog`; align category enum values; fix `ChatLayout` effect deps & error rollback; wire or hide unimplemented composer icons; render mobile info drawer. |
| `AUD-H18` | Production Dependency Vulnerabilities (`npm audit --omit=dev`) | `package.json:25,30` (`shadcn`, `next`) | `shadcn@^4.23.0` is in `dependencies` (9 High + 2 Moderate vulns); `next@15.5.29` bundles vulnerable `postcss<=8.5.22` (total 9 High, 3 Moderate in prod). | Move `shadcn` out of `dependencies` (CLI/dev only); remove unused `cn` package; plan controlled Next.js upgrade to patch bundled `postcss`. |

---

## 16. Medium and Low-Priority Defects

### MEDIUM DEFECTS (18)

| ID | Module / Route | File & Lines | Defect & Recommended Correction |
| :--- | :--- | :--- | :--- |
| `AUD-M01` | Attachment & Avatar Schemas (6 modules) | `assignment/chat/complaint/notice/service-request/user.schema.ts` | `z.string().url()` accepts `javascript:` and `data:` schemes (stored XSS risk). **Fix:** Enforce `https:` URL validator (and trusted Cloudinary host allowlist for uploads). |
| `AUD-M02` | Search Endpoints (Complaints, Polls, Requests) | `complaint.repository.ts:375`, `poll.service.ts:442`, `service-request.service.ts:147,213` | Unescaped user `search` strings passed to `new RegExp()`/`$regex` (ReDoS & 500 crashes). **Fix:** Apply `escapeRegex()`. |
| `AUD-M03` | Malformed JSON Handling | `api-error-handler.ts:27-106`, `assignments/**/route.ts`, `admin/users/[id]/route.ts:76`, `profile/me/route.ts:34`, `admin/users/provision/route.ts:39` | Uncaught `req.json()` returns 500 on assignments; `null` crashes `body.role` -> 500; `PATCH users/[id]` & `profile/me` swallow invalid JSON and return 200. **Fix:** Handle `SyntaxError` in `api-error-handler` as HTTP 400 and validate non-null objects consistently. |
| `AUD-M04` | Admin User Patch & Lockout Risk | `src/app/api/v1/admin/users/[id]/route.ts:76-118` | No Zod validation on `PATCH` body; root `admin01` protection only blocks `deactivated`/`suspended` (allowing `archived` or `pending_verification` lockout). **Fix:** Validate with strict Zod schema and block all non-`active` states for root admin/self. |
| `AUD-M05` | Student & Facility PII Leakage | `user.repository.ts:686-703`, `facility.service.ts:258,563` | `/api/v1/users/search` & `/chat/users` expose student `email`/`rollNumber` to all students; `/facilities/[id]` & `/bookings` expose faculty `email`, `employeeId`, `reviewRemarks` to students. **Fix:** Mask PII per role in directory search and return minimal availability DTO for students. |
| `AUD-M06` | Emergency Acks PII & Unscoped Acknowledge | `emergency.service.ts:316-389,435-507`, `emergency-acknowledgment.model.ts:100` | `admin` (HOD) sees campus-wide acks with raw `ipAddress`/`userAgent`/`email`; `acknowledgeAlert` ignores `targetDepartments`. **Fix:** Scope `admin` to own dept, mask IP/UA for non-`super_admin`, verify dept eligibility on acknowledge. |
| `AUD-M07` | Chat Group Dept Isolation & Token Route Fallback | `chat.service.ts:230-260,419-435`, `api/v1/chat/token/route.ts:22,59-69` | Faculty/HOD can create groups for foreign departments and enroll any user campus-wide; `/chat/token` catch block returns HTTP 200 with unsigned params & leaks `keyName`, and caps at 100 conversations. **Fix:** Validate dept scope; return HTTP 502/503 on token failure without `keyName`. |
| `AUD-M08` | Password Reset Replay & Timing Comparison | `password-recovery.service.ts:147,193,240`, `activation.service.ts:119`, `otp.service.ts:239` | Proof consumed *after* Clerk reset (TOCTOU replay); `!==` instead of `crypto.timingSafeEqual`; `verifyOtp` fails to set `isEmailVerified` when `authProviderId` is null. **Fix:** Atomically consume proof before Clerk call; use `timingSafeEqual`; update verification by `user._id`. |
| `AUD-M09` | Residual Academic Calendar Artifacts | `student/dashboard/components/academic-calendar.tsx`, `faculty/dashboard/components/academic-calendar.tsx`, `faculty/dashboard/components/quick-actions.tsx:88`, `src/app/page.tsx:208`, `role-selector.tsx:36` | Live Academic Calendar placeholder widgets still mounted on Student & Faculty dashboards; landing page & role selector still advertise timetables. **Fix:** Remove obsolete calendar components, quick action, and marketing copy. |
| `AUD-M10` | `NaN` Pagination & Broken Cursor Pagination | `api/v1/admin/users/route.ts:40-42`, `api/v1/notices/[id]/receipts/route.ts:32`, `notice.repository.ts:90-98,204-214` | Non-numeric `page`/`limit` produces `NaN` in Mongoose `.skip()`/`.limit()`; Notice cursor filters by `_id` while sorting by `isPinned`/`publishedAt`/`readAt`. **Fix:** Use Zod numeric coercion and compound keyset cursors. |
| `AUD-M11` | Mongoose 9 `{ new: true }` Deprecations & Index Hygiene | 16 repositories (38 sites), 9 models (duplicate indexes), `audit-log.model.ts:180`, `user.model.ts:46` | Deprecated `{ new: true }` warnings; duplicate index declarations; missing `runValidators: true` in `user.repository.ts`; `pre('deleteOne')` missing `{ document: true }`; `currentSemester` max 8 vs 12 mismatch. **Fix:** Migrate to `{ returnDocument: 'after', runValidators: true }`, deduplicate indexes, align semester cap. |
| `AUD-M12` | Portal Switching Loop & Dead Session Engine | `role-mismatch/page.tsx:38-47,107`, `verify-role/page.tsx:103,176`, `src/lib/auth/session.ts`, `middleware.ts:198-203` | `/role-mismatch` trusts query params and loops via `/sign-in`; `verify-role` calls `cookieStore.delete()` in a Server Component (silently fails); `session.ts` 30-min admin idle timeout is unused dead code; `/api/auth/logout` blocked for suspended users; `x-user-admin-sub-role` not stripped. **Fix:** Clear cookie in Route Handler, whitelist `/api/auth/logout`, strip spoofable `x-user-*` headers, enforce session idle timeout. |
| `AUD-M13` | Student Complaint SLA Breach Bypass & Resolved SLA Display | `complaint.service.ts:412-430`, `student-complaints-view.tsx:296`, `authority-complaints-view.tsx:364` | Students can escalate immediately without SLA breach; UI marks resolved/closed complaints as "SLA Breached". **Fix:** Enforce `sla.isBreached` in `escalateComplaint` and exclude resolved/closed statuses in UI. |
| `AUD-M14` | SSR/Client Hydration Mismatches (9 Components) | `welcome-banner.tsx` (x3), `academic-calendar.tsx` (x2), `student-assignment-view.tsx`, `notification-center-view.tsx`, `faculty-spaces-view.tsx`, `booking-create-modal.tsx` | Calls `Date.now()` / `new Date()` / `toLocaleDateString()` during render on SSR-preloaded data. **Fix:** Defer relative/locale time formatting to `useEffect` or pass server timestamp. |
| `AUD-M15` | Missing UI Pagination, Stale Form State & Silent Mutation Failures | `audit-logs-view.tsx`, `iam-governance-view.tsx`, `notice-form-dialog.tsx`, `poll-create-dialog.tsx`, `student-request-compose-modal.tsx`, `profile-edit-dialog.tsx`, `department-roster-view.tsx`, `notification-center-view.tsx`, `student-passport-view.tsx`, `admin-spaces-view.tsx` | 100-row UI ceilings without pagination; forms don't reset on close/submit; `department-roster-view` searches only current 15-row page; multiple views swallow `!res.ok` errors silently; `FacultySpacesView` omits `scope=mine` on refresh; `FacultyAssignmentView` over-increments `gradedCount` on re-grade; `StudentPassportView` Withdraw deletes without confirmation. **Fix:** Add pagination, form resets, visible error banners, and confirmation dialogs. |
| `AUD-M16` | Ably Multi-Client & Listener/Timer Leaks | `use-ably-chat.ts:87-194,218,270`, `topbar-notifications.tsx:321`, `emergency-global-banner.tsx:97`, `otp-input.tsx:89,199`, `student-passport-view.tsx:127`, `profile-edit-dialog.tsx:124` | Up to 3 Ably clients per tab; unremoved `channel.on('failed')` listeners; unguarded async connect; uncleaned `setTimeout`s. **Fix:** Consolidate into a shared Ably context/singleton with strict cleanup. |
| `AUD-M17` | Missing Route Error/Loading Boundaries & Uncaught Shared Page Awaits | `src/app/` (no `error.tsx`/`loading.tsx`), `shared/notifications/page.tsx:20`, `shared/profile/page.tsx:18` | Transient DB errors crash to unbranded Next.js error screen. **Fix:** Add `src/app/error.tsx`, `global-error.tsx`, and wrap server fetches safely. |
| `AUD-M18` | `verify:prod` CLI Env Loading & Local Dev UX | `scripts/verify-production-env.ts` | Checks `process.env` without loading `.env.local`/`.env`, causing false `[MISSING]` failures when run locally. **Fix:** Document shell export requirement or add optional `--load-env-local` flag for non-CI checks. |

### LOW DEFECTS (7)

| ID | Module / Route | File & Lines | Defect & Recommended Correction |
| :--- | :--- | :--- | :--- |
| `AUD-L01` | Permissions & Dead Auth Code | `permissions.ts:64-66`, `lib/auth/client.ts:73`, `invitation.service.ts`, `server.ts:20-28` | Residual `CALENDAR_VIEW`/`CALENDAR_EDIT` permissions & dead `/student/calendar` nav link; unused `InvitationService` with zero RBAC; `__setTestSession` exported in prod bundle without `NODE_ENV === 'test'` guard. |
| `AUD-L02` | Webhook Hardcoded Admin Staff ID & 403 Retry Storm | `src/app/api/webhooks/clerk/route.ts:24,58,115-149` | Hardcodes `'admin01'` / `'SA-ADMIN01'` (breaks >1 super_admin); returns 403 on unprovisioned `user.created` causing Svix retries; returns 400 instead of 401 on unauthorized webhook. |
| `AUD-L03` | Non-Standard Health Envelopes & Unvalidated `sortBy` | `api/health/route.ts`, `api/health/db/route.ts`, `complaint.schema.ts:178`, `service-request.schema.ts:192` | Health endpoints deviate from standard `ApiResponse`; `sortBy` accepts unvalidated strings instead of `z.enum([...])`. |
| `AUD-L04` | Activation Portal Routing & Verified Badge | `src/app/(auth)/activate/page.tsx:181,214,358` | Activated `admin` users routed to `/sign-in?portal=student`; success screen displays `"Email Status: Verified"` even when user skipped OTP verification. |
| `AUD-L05` | Notice Markdown & Dynamic Tailwind Class | `notice-detail-dialog.tsx:231`, `poll-card.tsx:254`, `mobile-drawer.tsx:207`, `topbar.tsx:115` | Markdown rendered as plain text; dynamic `rounded-${...}` risks Tailwind JIT purge; hardcoded `v0.1.0` in drawer; disabled `"Search campus..."` placeholder in Topbar. |
| `AUD-L06` | Accessibility Polish | `poll-card.tsx:226`, `student-assignment-view.tsx:200`, `emergency-global-banner.tsx:225`, `super-admin/dashboard/page.tsx:62`, `chat-conversation-view.tsx:361` | Clickable cards/divs lack keyboard/ARIA semantics; Emergency modal lacks `Escape`/focus trap; `focus:outline-none` without ring; hover-only message delete button. |
| `AUD-L07` | Logging Redaction & Wrong Arg Order | `logger.ts:22-33`, `ably-broker.ts:94`, `chat.service.ts:215`, `password-recovery.service.ts:82`, `complaint.service.ts:542` | `logger.ts` omits `otp`/`email`/`phone` from redaction while `/uri/i` over-redacts `security`/`during`; `ably-broker.ts:94` passes context in error slot; raw emails logged in chat/recovery; `ComplaintService.getStats` constructs random ObjectId when `deptId` is undefined. |

---

## 17. Missing Configuration and Manual Actions Required

1. **Provision Missing External Services (Currently Unconfigured Locally):**
   - **Cloudinary:** Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and configure strict signed upload presets (25 MB cap, allowed formats).
   - **Resend / Email:** Install real email SDK / implement HTTP dispatch in `EmailService`, verify `axiscolleges.in` SPF/DKIM/DMARC records, and set `RESEND_API_KEY` + `EMAIL_FROM_ADDRESS`.
   - **Canonical URL:** Set `NEXT_PUBLIC_APP_URL` to the production HTTPS origin (`https://linkup.axiscolleges.in`).
2. **Clerk Production Cutover:**
   - Replace local `pk_test_*` / `sk_test_*` keys with Clerk Live Production keys (`pk_live_*` / `sk_live_*`).
   - Disable public registration in Clerk Dashboard; rotate root Super Admin password and enforce MFA.
3. **MongoDB Atlas Index Migration (Before Launch):**
   - After fixing `ConversationSchema` and `UserSchema` partial indexes in code, drop the legacy sparse indexes (`directKey_1_type_1`, `username_1`, `authProviderId_1`) in Atlas so Mongoose recreates them with `partialFilterExpression`.
4. **Decide Pending Module Scope:**
   - Confirm whether **MOD-12 (Notes & Study Materials)** and **MOD-18 (Departmental Analytics & Reports)** are deferred to Phase 7+ (if so, document explicitly; if needed for v1, schedule implementation).
5. **Execute Manual Live-Browser & Responsive QA:**
   - Run full walkthroughs across Student, Faculty, HOD, Director, and System Admin accounts at 360px, 390px, 768px, 1366px, and 1440px viewports plus Lighthouse accessibility/performance audits.

---

## 18. Regression Risks

- **Modifying `ComplaintRepository.queryWithFilters` / `ComplaintService`:** Existing complaint unit tests may construct regular-faculty sessions expecting HOD access; verify and update RBAC assertions carefully so legitimate inquiry-officer assignments keep working.
- **Fixing `getCurrentSession()` Fail-Closed Behavior:** Unit tests relying on `__setTestSession` are unaffected, but live Clerk onboarding must ensure every user exists in MongoDB (or is provisioned before first sign-in) prior to removing the fallback.
- **Replacing Sparse Indexes with `partialFilterExpression`:** Existing MongoDB collections retain old index specs until explicitly dropped; deploying schema changes without dropping old indexes will continue throwing `E11000`.
- **Removing Residual Calendar Permissions:** `tests/unit/rbac.test.ts:64,77` explicitly asserts `PERMISSIONS.CALENDAR_VIEW` and `PERMISSIONS.CALENDAR_EDIT` — keep those constants or update `rbac.test.ts` intentionally in the same PR.
- **Migrating `shadcn` Out of `dependencies` & Upgrading `next`:** Verify `npm ci` + `npm run build` + `scripts/patch-ably.js` cleanly after any `package.json` update.

---

## 19. Recommended Fix Priority

### P0 — Immediate Release Blockers (Fix Before Any Staging/Production Cutover)
1. Fix all **Critical RBAC & Auth Bypass** flaws (`AUD-C01` Grievance filter overwrite, `AUD-C02` Regular faculty HOD grievance access, `AUD-C03` SysAdmin Director/redaction leak, `AUD-C04` Unprovisioned `getCurrentSession()` bypass, `AUD-C05` Hardcoded Gmail/`admin01` super_admin bootstrap).
2. Fix **Production-Breaking DB Indexes & TTL** (`AUD-C06` `Conversation` 2nd group chat `E11000`, `AUD-C07` `User` `default: null` unique sparse indexes, `AUD-C10` 5-min OTP TTL vs 15-min proof token).
3. Replace **Stubbed `EmailService`** with real Resend/SMTP delivery (`AUD-C08`) and fix **`OtpInput` infinite auto-send loop** (`AUD-C09`).
4. Replace **Fake/Blob Attachments** in Complaints & Service Requests (`AUD-C09`), fix `FileUploader` multi-file overwrite (`AUD-H14`), and harden Cloudinary signed upload restrictions (`AUD-H13`).

### P1 — High-Priority Security, Concurrency & Role-Boundary Fixes (Before Beta/Pilot)
5. Close all **High RBAC/IDOR** gaps: `AUD-H01` (`isInternal` leak), `AUD-H02` (Notice HOD cross-dept IDOR & broken update/publish), `AUD-H03` (Poll HOD IDOR & `getPollResults`), `AUD-H04` (Director `ProfileService` escalation), `AUD-H05` (Chat `super_admin` self-add & deleted attachments), `AUD-H06` (Facility tautological `DEPT` bypass), `AUD-H07` (Passport faculty cross-dept IDOR), `AUD-H08` (Notification `specific_users` emergency abuse), `AUD-H09` (Request stats/admin fail-open), `AUD-H10` (Assignment student cohort overwrite).
6. Fix **Concurrency & Reliability**: Facility TOCTOU approval transaction, Audit hash-chain serialization, `NotificationService.broadcastAlert` pagination (>100 users), Ably token revocation / shorter TTL, `mongodb.ts` reconnect & 4 missing `connectToDatabase()` calls, `logger.ts` cycle guard, and atomic sequential code generators (`AUD-C10`, `AUD-H15`).
7. Fix **Auth Enumeration, Session Revocation & Rate Limiting** (`AUD-H11`, `AUD-H12`) and remove `shadcn` from prod `dependencies` (`AUD-H18`).

### P2 — Functional UI Polish, Dashboard Cleanup & Medium Security Hardening
8. Replace dashboard mock widgets, dead buttons, broken `/faculty/classes` & `/ui-preview` links, stale `"Phase 5"` badges, and residual Academic Calendar components (`AUD-H16`, `AUD-M09`).
9. Fix Notice draft Publish/Edit/Archive UI & category filter mismatch, Chat read-receipt loop & silent errors (`AUD-H17`), URL scheme `https:` validation (`AUD-M01`), regex escaping (`AUD-M02`), JSON error handling (`AUD-M03`), PII masking (`AUD-M05`, `AUD-M06`), hydration mismatches (`AUD-M14`), and UI pagination (`AUD-M15`).

### P3 — Post-Launch Polish & Planned Modules
10. Clean up Mongoose 9 `{ new: true }` warnings & duplicate indexes (`AUD-M11`), accessibility polish (`AUD-L06`), dead auth code (`AUD-L01`), and schedule **MOD-12 (Notes)**, **MOD-18 (Analytics)**, and Playwright E2E test coverage.

---

## 20. Final Readiness Assessment & Scorecard

### Readiness Verdict: **NOT READY FOR PRODUCTION LAUNCH (HOLD — REMEDIATE P0/P1 FIRST)**

Although the codebase demonstrates strong architectural organization, clean TypeScript/ESLint hygiene, and 837 passing mocked tests, **10 Critical and 18 High-Priority defects**—including cross-department/Director grievance IDORs, unprovisioned registration bypass, hardcoded `super_admin` auto-bootstrap, a MongoDB index bug that breaks the 2nd group chat, a complete no-op `EmailService`, broken Complaint/Service Request attachments, and zero live browser/E2E verification—must be resolved and re-verified before institutional production cutover.

### Final Audit Scorecard

| Area | Status | Evidence |
| :--- | :---: | :--- |
| **Frontend/UI** | **FAIL** | Dedicated feature pages build cleanly, but all 4 dashboards contain hardcoded mock widgets, dead buttons (`hod-grievance-desk`, `director-appeal-desk`), broken 404 links (`/faculty/classes`, prod `/ui-preview`, admin `/faculty/assignments`), residual live Academic Calendar widgets, `OtpInput` infinite loop, fake/blob attachments, `FileUploader` multi-file loss, Notice draft/filter bugs, and 9 SSR hydration risks. Live browser/responsive viewports were **NOT TESTED**. |
| **Backend** | **PARTIAL** | Clean layered architecture (services/repos/Zod), but contains critical concurrency races (Facility TOCTOU, Audit hash-chain fork, 6 non-atomic code generators), 100-user broadcast truncation, stubbed `EmailService`, and `logger.ts` circular-JSON crash. |
| **APIs** | **FAIL** | All 99 route files (121 handlers) inventoried; multiple Critical/High IDORs (`GET /api/v1/complaints`, `GET /api/v1/assignments`, Notices/Polls/Facilities/Passport/Requests/Notifications), unmasked email leak in password recovery, missing rate limits on 9 sensitive endpoints, and inconsistent JSON/NaN error handling. |
| **Authentication** | **FAIL** | Closed `/sign-up` redirect exists, but `getCurrentSession()` synthesizes active student sessions for unprovisioned Clerk users; hardcoded personal Gmail/`admin01` auto-bootstraps `super_admin`; 5-min OTP TTL kills 15-min recovery proof; `EmailService` is a stub; sessions are never revoked on suspend/demote; `session.ts` expiry engine is dead code. |
| **RBAC** | **FAIL** | Severe role-boundary breaches across all 5 personas: regular faculty granted HOD grievance access; HODs can overwrite grievance dept/Director filters and manage notices/polls/facilities campus-wide; `sys_admin` vs `director` conflated across Complaints, Profiles, Chat, Audit, and Assignments; fail-open checks when `departmentId` is unset. |
| **Database** | **FAIL** | `ConversationSchema` compound sparse unique index breaks 2nd group chat (`E11000`); `User` `default: null` breaks unique sparse `username`/`authProviderId`; `mongodb.ts` stale `cached.promise` prevents reconnect; 4 repos omit `connectToDatabase()`; 38 deprecated Mongoose 9 `{ new: true }` calls; 9 duplicate index declarations. |
| **Feature Workflows** | **PARTIAL** | Mocked unit/integration flows pass sequentially, but real-world workflows fail on Grievances (fake attachments + RBAC), Chat (2nd group chat `E11000` + loop + unrevoked Ably), Service Requests (`blob:` attachments), Notices (trapped drafts + broken filter), Notifications (100-user cap), and MOD-12/MOD-18 are not implemented. |
| **Realtime** | **PARTIAL** | Zero-trust per-channel Ably capability minting works in unit tests (no wildcards), but removed members keep 60-min unrevoked access, 3 Ably clients spin up per browser tab, `useAblyChat` leaks listeners/sockets, `patch-ably.js` mutates `node_modules`, and live WebSocket delivery was **NOT TESTED**. |
| **File Uploads** | **FAIL** | Cloudinary credentials missing locally; signed upload lacks MIME/size/user-folder/rate-limit enforcement; `FileUploader` drops multi-selected files & lacks drag-and-drop; Complaints save fake URLs; Service Requests save ephemeral `blob:` URLs; 6 schemas allow `javascript:` URLs. |
| **Notifications** | **PARTIAL** | MOD-17 inbox, 90-day TTL, 60s dedupe, and locked Emergency preferences work cleanly, but `broadcastAlert` truncates at 100 users and allows cross-dept `emergency` blasts via `specific_users`; FCM is not implemented; `EmailService` is a stub. |
| **Security** | **FAIL** | 6 HTTP security headers & zero git-tracked secrets pass, **but** Critical IDORs, closed-registration bypass, hardcoded `super_admin` email, unthrottled public auth/search routes, `javascript:` attachment URLs, unescaped `$regex`, and 9 High + 3 Moderate `npm audit` production vulnerabilities require remediation. |
| **Performance** | **PARTIAL** | Fast build (`14.5s`) and lean shared bundle (`103 kB`), but N+1 loops in Chat/Polls/Broadcasts, unbounded receipt queries, 3 concurrent Ably clients/tab, missing UI pagination beyond 50–100 rows, and Chat read-receipt storm degrade production scalability. Lighthouse was **NOT TESTED**. |
| **Automated Tests** | **PASS** | **837 / 837** automated tests pass (832 unit + 5 integration), `tsc --noEmit` 0 errors, `eslint` 0 errors/0 warnings. *(Caveat: tests rely entirely on mocked repositories/SSR; zero Playwright/live E2E tests exist.)* |
| **Production Build** | **PASS** | `npm run build` succeeds cleanly in `14.5s` across all 39 static pages, dynamic portal routes, 99 API routes, and middleware (`93.5 kB`). |
