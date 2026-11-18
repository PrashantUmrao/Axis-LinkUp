# Axis LinkUp — P2 Remediation Batch 1 Report (Final Code Sprint)

**Date:** 2026-11-18
**Status:** COMPLETE & VERIFIED
**Scope Targeted:** `AUD-H16` (Broken 404 Links, Dead Buttons, Hardcoded Roles, Stale Quick Actions & Residual Calendar Removal), `AUD-H17` (Interactive UI Bugs across Notices, Chat & Emergency Dialogs), Next.js Error Boundaries, and SSR/Client Hydration Safety.

---

## 1. Executive Summary

All targeted UI/UX defects, residual Academic Calendar dashboard mounts, broken route links, dead buttons, hardcoded role props, and client-clock hydration risks have been resolved without introducing any new npm dependencies or weakening any P0/P1 backend security controls.

| Verification Gate | Result | Details |
| :--- | :---: | :--- |
| `npm run typecheck` | PASS | `tsc --noEmit` — 0 errors |
| `npm run lint` | PASS | `eslint` — 0 errors, 0 warnings |
| `npm run test:all` | PASS | **910 / 910** unit tests + **5 / 5** integration workflows (**915 / 915** total, 0 failures) |
| `npm run build` | PASS | Next.js 15.5.29 production build compiled cleanly in **26.5s** (39/39 static pages) |

---

## 2. Detailed Remediation Summary

### A. Navigation, Landing Page & Portal Shell Cleanup (`AUD-H16`)
1. **Sidebar Assignment Route Isolation (`src/config/navigation.ts`):** Restricted `faculty-grading` (`/faculty/assignments`) to `roles: ['faculty']` only, eliminating the broken redirect for `admin` users and removing duplicate assignment links for `super_admin` (which uses `/admin/assignments`).
2. **Public Landing Page Hardening (`src/app/page.tsx`):**
   - Gated the `/ui-preview` ("UI Showcase") navigation link to `process.env.NODE_ENV !== 'production'`.
   - Replaced the excluded Academic Calendar / Timetable capability card with implemented **Service Requests & Facility Bookings**.
   - Switched footer copyright year to deterministic `new Date().getUTCFullYear()`.
3. **Topbar Stale Placeholder Removal (`src/components/navigation/topbar.tsx`):** Removed the permanently disabled `"Search campus..."` `"planned for Phase 5 implementation"` placeholder tooltip and unused imports.
4. **Super Admin Executive Console (`src/app/(super-admin)/super-admin/dashboard/page.tsx`):** Replaced outdated `"all 15 Next.js server components"` copy with `"all institutional portals and API handlers"` and upgraded card links to accessible `focus-visible:ring-2 focus-visible:ring-primary/60` focus indicators.

### B. Residual Academic Calendar Removal & Dashboard Cleanup (`AUD-H16`)
1. **Student & Faculty Dashboards (`src/app/(student)/student/dashboard/page.tsx`, `src/app/(faculty)/faculty/dashboard/page.tsx`):** Permanently unmounted `<StudentAcademicCalendar />` and `<FacultyAcademicCalendar />` from both dashboards in compliance with MOD-10 exclusion.
2. **Faculty Teaching Allocations (`src/app/(faculty)/faculty/dashboard/components/teaching-modules.tsx`):** Replaced broken `/faculty/classes` 404 links with live `/faculty/assignments` links.
3. **Faculty & Admin Quick Actions (`src/app/(faculty)/faculty/dashboard/components/quick-actions.tsx`, `src/app/(admin)/admin/dashboard/components/quick-actions.tsx`):**
   - Activated all live portals (`/faculty/notices`, `/faculty/assignments`, `/faculty/spaces`, `/admin/notices`, `/admin/requests`, `/admin/spaces`).
   - Replaced the dead `/faculty/calendar` quick action with live `/faculty/spaces`.
   - Removed all stale `"Phase 5"` disabled badges and tooltips.
4. **Admin Dashboard Live Metrics & Role Propagation:**
   - `src/app/(admin)/admin/dashboard/page.tsx`: Wired live `ServiceRequestService.getRequestStats(session)` to compute `pendingRequests` (`submitted + underReview + actionRequired`) instead of hardcoded `0`, and passed `user={userDTO}` to `<AdminWorkspaceView />`.
   - `src/app/(admin)/admin/dashboard/components/request-tracking.tsx`: Displays live pending requisition count and review CTA when `pendingRequests > 0`.
   - `src/app/(admin)/admin/dashboard/components/admin-workspace-view.tsx`, `notice-management.tsx`, `poll-management.tsx`: Eliminated hardcoded `currentUserRole="super_admin"`; propagated real `user.role`, `user.id`, and `user.departmentId` to `NoticeDetailDialog`, `NoticeFormDialog`, `PollCard`, and `PollCreateDialog`.
   - `src/app/(admin)/admin/dashboard/components/welcome-banner.tsx`: Removed hardcoded fallback staff ID `'ADM-010482'` in favor of `user.adminProfile?.adminStaffId || 'Verified Staff'`.
   - `src/app/(admin)/admin/dashboard/components/hod-grievance-desk.tsx` & `director-appeal-desk.tsx`: Replaced hardcoded mock grievances/appeals and dead buttons with live `/api/v1/complaints` fetching and working `<Link href="/admin/complaints">` navigation controls.

### C. Interactive UI Fixes (`AUD-H17`)
1. **Notice Detail Lifecycle & Read Receipts (`src/components/notices/notice-detail-dialog.tsx`):**
   - Added working **Publish Draft** (`POST /api/v1/notices/[id]/publish`) and **Archive** (`POST /api/v1/notices/[id]/archive`) buttons for authorized authors, HODs, and SysAdmins with loading states, error feedback, and parent state synchronization (`onNoticeUpdated`).
   - Added deduplicated non-blocking read-receipt recording (`GET /api/v1/notices/[id]`) when opening published notices.
2. **Student Notice Feed Categories & Debounced Search (`src/app/(student)/student/dashboard/components/notice-feed.tsx`):**
   - Aligned category filter values strictly with canonical `noticeCategorySchema` (`academic`, `examination`, `fee_accounts`, `event_cultural`, `placement`, `administrative`, `emergency`), eliminating `event` and `general` mismatches.
   - Added 300ms debounced search (`debouncedSearch`) before dispatching `/api/v1/notices` requests.
3. **Chat Reliability, Deduplication & Mobile Info Panel (`src/components/chat/chat-layout.tsx`, `src/components/chat/chat-conversation-view.tsx`):**
   - Fixed the read-receipt `useEffect` loop by tracking `loadedConversationsRef` and `lastMarkedMessageByConvRef` (only posting `/read` when the latest message ID for a conversation changes).
   - Replaced silent `catch {}` blocks on send/delete failures with rollback and a dismissible inline error banner (`role="alert"`).
   - Removed dead Paperclip and Smile buttons from `ChatConversationView`.
   - Enabled `ChatInfoPanel` as a responsive slide-over drawer on mobile instead of permanently hiding it (`hidden md:block`).
4. **Emergency Directive Accessibility (`src/components/emergency/emergency-global-banner.tsx`):**
   - Added `Escape` key dismissal for non-mandatory (`yellow`, `amber`, or already-acknowledged) dialogs while preserving mandatory takeover blocking on unacknowledged `red` alerts.
   - Added automatic container focus management (`modalContainerRef`) when the alertdialog opens.

### D. Error Boundaries & Hydration Safety
1. **Next.js Error Boundaries (`src/app/error.tsx`, `src/app/global-error.tsx`):** Added branded Glassmorphism client error boundaries offering **Try Again** (`reset()`) and **Return to Dashboard** (`/auth/verify-role`) with opaque `error.digest` reference IDs and zero stack-trace exposure in production.
2. **Hydration-Safe Clocks & Deterministic Formatting:** Guarded render-time `new Date()` / `Date.now()` calculations behind post-mount `useEffect` state and deterministic `Asia/Kolkata` `Intl.DateTimeFormat` calls across:
   - `src/app/(student)/student/dashboard/components/welcome-banner.tsx`
   - `src/app/(faculty)/faculty/dashboard/components/welcome-banner.tsx`
   - `src/app/(admin)/admin/dashboard/components/welcome-banner.tsx`
   - `src/components/notifications/notification-center-view.tsx` & `src/components/navigation/topbar-notifications.tsx`
   - `src/components/assignments/student-assignment-view.tsx`
   - `src/components/facilities/faculty-spaces-view.tsx`

---

## 3. Regression Coverage Added

Created **`tests/unit/p2-batch1-ui-cleanup.test.ts`** (16 new automated regression tests across 5 suites), increasing the automated suite from **899** to **915 passing tests** with zero regressions.
