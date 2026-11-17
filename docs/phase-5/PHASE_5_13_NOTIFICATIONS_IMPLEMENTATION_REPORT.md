# Phase 5.13 — Unified In-App Notification Center, Live Bell & Preferences (MOD-17)

**Status:** Completed & Verified  
**Module:** MOD-17 (Unified Notification Center & Preference Engine)  
**Scope:** All four institutional personas (`student`, `faculty`, `admin`, `super_admin`)

---

## 1. Executive Summary

Phase 5.13 delivers a persistent, real-time in-app notification center across Axis LinkUp. Previously, the Topbar notification bell only polled `/api/v1/notices/unread-count`. The platform now provides a unified inbox (`Notification` + `NotificationPreference` Mongoose models), 60-second deduplication, automatic 90-day MongoDB TTL expiration, user-controlled category preferences with an immutable `emergency` safety override, live Ably Realtime push delivery on `user:<userId>:notifications`, RBAC-scoped targeted ad-hoc broadcasts (`PERMISSIONS.ALERTS_DISPATCH`), and a dedicated `/shared/notifications` workspace.

### Non-Negotiable Safeguards Verified
- **Academic Calendar (MOD-10) Strictly Excluded:** Zero calendar categories, models, schemas, or routes were introduced (`NOTIFICATION_CATEGORIES` strictly contains 10 non-calendar institutional categories).
- **Zero Regressions:** All **803 existing tests** plus **14 new Phase 5.13 tests** (**817 / 817** total) pass with 0 failures.
- **Legacy Notice Unread Count Preserved:** `/api/v1/notices/unread-count` remains untouched and serves as a safe fallback for the Topbar bell.
- **No Database Resets:** Existing seed identities, Clerk configuration, and unrelated modules remain untouched.

---

## 2. Backend Architecture & Data Models

### 2.1 Domain Types & Validation
- `src/types/notification.ts` (exported via `src/types/index.ts`):
  - `NOTIFICATION_CATEGORIES` (10 categories): `assignment`, `service_request`, `facility_booking`, `passport`, `complaint`, `notice`, `poll`, `chat`, `emergency`, `system`.
  - `MUTABLE_NOTIFICATION_CATEGORIES` (9 categories): all except `emergency`.
  - DTOs: `NotificationDTO`, `NotificationPreferenceDTO`, `NotificationUnreadSummaryDTO`, `PaginatedNotificationsDTO`, `NotificationBroadcastResultDTO`.
- `src/lib/validations/notification.schema.ts` (exported via `src/lib/validations/index.ts`):
  - `isSafeInternalLinkUrl` / `safeInternalLinkSchema`: strictly enforces relative paths beginning with `/` while blocking protocol-relative (`//`), external (`https://`), backslash (`\`), and `javascript:` URLs (open-redirect defense).
  - `updateNotificationPreferencesSchema`: explicitly rejects `categories.emergency === false` with HTTP `400`.
  - `broadcastNotificationSchema`: validates targeting scope (`all_users`, `by_role`, `by_department`, `specific_users`) with contextual refinements.

### 2.2 Mongoose Models & Indexing
- `src/lib/db/models/notification.model.ts`:
  - Compound inbox index: `{ userId: 1, isArchived: 1, isRead: 1, createdAt: -1 }`.
  - Deduplication lookup index: `{ userId: 1, dedupeKey: 1, createdAt: -1 }`.
  - Automatic 90-day TTL index: `{ expiresAt: 1 }` with `{ expireAfterSeconds: 0 }`.
- `src/lib/db/models/notification-preference.model.ts`:
  - Unique `userId` index.
  - `toNotificationPreferenceDTO()` always enforces `categories.emergency: true`.

### 2.3 Repositories & Domain Service
- `src/lib/db/repositories/notification.repository.ts` & `notification-preference.repository.ts`: MongoDB query/mutation layers guarded safely with `if (process.env.MONGODB_URI) await connectToDatabase();`.
- `src/lib/services/notification.service.ts`:
  - **`dispatch()`**: Validates `linkUrl`, enforces user channel & category preferences (bypassing mutes unconditionally when `category === 'emergency'`), applies 60-second `dedupeKey` suppression (`debounced_duplicate`), persists with 90-day `expiresAt`, and publishes `notification.created` to `user:<userId>:notifications` via `AblyBroker` (non-blocking).
  - **`safeDispatchCrossModule()`**: Fire-and-forget wrapper that safely skips when `MONGODB_URI` is absent in isolated unit test suites.
  - **`broadcastAlert()`**: Enforces `PERMISSIONS.ALERTS_DISPATCH` (`student` → `403`, `faculty`/`admin` → own department or specific recipients only, `super_admin` → all scopes) and records an immutable `AuditService.recordEvent` entry.

### 2.4 Cross-Module Notification Hooks
Non-blocking `NotificationService.safeDispatchCrossModule(...)` triggers were wired into:
- `src/lib/services/service-request.service.ts` — notifies students when administrators approve/reject/fulfill service requests.
- `src/lib/services/facility.service.ts` — notifies faculty when administrators approve/reject space reservations.
- `src/lib/services/passport.service.ts` — notifies students when faculty/HODs verify or reject Skill Passport achievement claims.

---

## 3. REST API Contracts (`/api/v1/notifications/*`)

| Endpoint | Method | Auth / RBAC | Behavior |
| :--- | :--- | :--- | :--- |
| `/api/v1/notifications` | `GET` | `requireAuth()` | Paginated personal inbox (`category`, `isRead`, `priority`, `page`, `limit`). |
| `/api/v1/notifications/unread-summary` | `GET` | `requireAuth()` | Fast Topbar bell summary: total unread count, per-category counts, latest 5 unread items. |
| `/api/v1/notifications/[id]/read` | `PATCH` | `requireAuth()` | Marks a single notification read; returns `403` on cross-user access, `404` if missing. |
| `/api/v1/notifications/read-all` | `POST` | `requireAuth()` | Bulk marks all unread notifications (or a specific category) as read. |
| `/api/v1/notifications/[id]` | `DELETE` | `requireAuth()` | Archives/dismisses a single notification; strictly owner-isolated (`403` cross-user). |
| `/api/v1/notifications/preferences` | `GET`, `PATCH` | `requireAuth()` | Reads/updates personal channel & category preferences; blocks muting `emergency` (`400`). |
| `/api/v1/notifications/broadcast` | `POST` | `requireRole(['faculty', 'admin', 'super_admin'])` | Dispatches RBAC-scoped targeted alerts with audit trail logging. |

---

## 4. Frontend, Topbar Live Bell & Navigation

- **Upgraded Live Bell (`src/components/navigation/topbar-notifications.tsx`):**
  - Connects to `/api/v1/notifications/unread-summary` (with 60s HTTP fail-safe polling and `/api/v1/notices/unread-count` fallback) plus Ably Realtime (`user:<userId>:notifications`) via `/api/v1/chat/token` for instant live badge increments.
  - Displays unread count badge (capped at `99+`), top 5 recent items with category icons, relative timestamps, unread dot, click-to-mark-read deep links, **Mark all read** action, and direct link to `/shared/notifications`.
- **Notification Center Workspace (`src/components/notifications/` & `src/app/(shared)/shared/notifications/page.tsx`):**
  - **Inbox Tab:** All/Unread toggle, category filter pills, priority badges, deep-link `Open` action, individual Mark Read & Archive buttons, pagination, and empty state.
  - **Preferences Tab:** Global toggles (`inAppEnabled`, `emailEnabled`, `soundEnabled`), 9 mutable category checkboxes, and a permanently locked **Emergency Alerts — Always On** row.
  - **Targeted Alert Broadcast Modal (`NotificationBroadcastModal`):** Rendered strictly for `faculty`, `admin`, and `super_admin` (`Send Alert` hidden from students), locking non-super-admins to own department or specific user targets.
- **Navigation (`src/config/navigation.ts`):** Registered `shared-notifications` (`/shared/notifications`) under the `account` group for all four personas, added `/notifications` breadcrumb resolution, and registered the route in `tests/unit/navigation.test.ts`.

---

## 5. Verification Results

| Gate | Command | Result |
| :--- | :--- | :--- |
| TypeScript Strict Check | `npx tsc --noEmit` | **PASS** (0 errors) |
| ESLint | `npm run lint` | **PASS** (0 errors, 0 warnings) |
| Phase 5.13 New Tests | `tests/unit/notifications-backend.test.ts` (8 tests) + `tests/unit/notifications-frontend-integration.test.ts` (6 tests) | **14 / 14 PASS** |
| Full Regression Suite | `npm test` | **817 / 817 PASS** across 242 suites (0 failures) |
| Production Build | `npm run build` | **PASS** (Compiled cleanly in 18.1s; 40/40 static pages; `/shared/notifications` + all 7 API routes built) |
