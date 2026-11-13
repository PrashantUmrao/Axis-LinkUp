# Codebase Naming Conventions & Style Guide

> **Document ID:** DOC-STRUC-007  
> **Status:** Approved Baseline (Phase 1, Part 1.5)  
> **Institution:** Axis Institute of Technology & Management  
> **Language Standards:** TypeScript 5+ & React 19 Standards  
> **Last Updated:** November 2026  

---

## 1. File & Directory Naming Conventions

Consistency across filenames eliminates casing issues across operating systems (e.g., Windows vs. Linux CI servers):

| Element | Case Style | Example | Rules |
| :--- | :--- | :--- | :--- |
| **Directories** | `kebab-case` | `src/features/student-requests/` | Lowercase letters separated by hyphens. |
| **Route Folders** | `kebab-case` / `(group)` | `src/app/(student)/timetable/` | Parentheses for route groups; brackets for dynamic routes `[id]`. |
| **React Component Files** | `kebab-case.tsx` | `notice-card.tsx`, `data-table.tsx` | Hyphenated lowercase matching component purpose. |
| **React Hooks** | `use-*.ts` | `use-notice-feed.ts`, `use-auth.ts` | Always starts with `use-` prefix. |
| **Domain Services** | `*.service.ts` | `notice.service.ts`, `request.service.ts` | Singular domain noun followed by `.service.ts`. |
| **Mongoose Models** | `*.model.ts` | `user.model.ts`, `service-request.model.ts`| Singular domain noun followed by `.model.ts`. |
| **Repositories** | `*.repository.ts` | `notice.repository.ts`, `user.repository.ts`| Singular domain noun followed by `.repository.ts`. |
| **Zod Schemas** | `*.schema.ts` | `notice.schema.ts`, `login.schema.ts` | Domain noun followed by `.schema.ts`. |
| **Type Definitions** | `*.types.ts` | `notice.types.ts`, `auth.types.ts` | Domain noun followed by `.types.ts`. |
| **Server Actions** | `*.actions.ts` | `notices.actions.ts`, `requests.actions.ts`| Plural domain noun followed by `.actions.ts`. |
| **Route Handlers** | `route.ts` | `src/app/api/webhooks/clerk/route.ts` | Standard Next.js route handler naming. |
| **Test Files** | `*.test.ts` / `*.spec.ts` | `notice.service.test.ts` | Matches tested file with `.test.ts` suffix. |

---

## 2. Code Identifier Conventions

### 2.1 React Components
- **Casing:** `PascalCase`
- **Rule:** Descriptive nouns matching the UI role. Never include generic names like `Component` or `View`.
- **Examples:**
  - `NoticeCard`
  - `RequestKanbanBoard`
  - `EmergencyTakeoverModal`
  - `DailyAgendaView`

### 2.2 React Hooks
- **Casing:** `camelCase` with mandatory `use` prefix.
- **Rule:** Must describe the stateful behavior or subscription provided.
- **Examples:**
  - `useNoticeFeed()`
  - `useAblyChatChannel(channelId)`
  - `useCurrentUserRole()`
  - `useUnreadNotificationsCount()`

### 2.3 Functions & Methods
- **Casing:** `camelCase`
- **Rule:** Verb-first phrasing describing the action performed.
- **Examples:**
  - `getNoticeById(id: string)`
  - `createServiceRequest(data: CreateRequestDTO)`
  - `validateUserSession(cookie: string)`
  - `calculateSlaDeadline(hours: number)`

### 2.4 Server Actions
- **Casing:** `camelCase` with mandatory `Action` suffix.
- **Rule:** Clearly distinguishes Server Actions from pure client event handlers.
- **Examples:**
  - `createNoticeAction(formData: FormData)`
  - `approveRequestAction(requestId: string)`
  - `triggerEmergencyBroadcastAction(payload: EmergencyDTO)`

### 2.5 Variables & Constants
- **Local & Instance Variables:** `camelCase` (e.g., `activeChannelId`, `studentRoster`, `isLoading`).
- **Global Constants & Enums:** `UPPER_SNAKE_CASE` (e.g., `MAX_UPLOAD_SIZE_BYTES`, `DEFAULT_PAGE_SIZE`, `ALLOWED_FILE_TYPES`).
- **Boolean Flags:** Prefix with `is`, `has`, `can`, or `should` (e.g., `isPinned`, `hasMore`, `canApprove`, `shouldNotify`).

---

## 3. Types, Interfaces & Database Models

### 3.1 TypeScript Types & Interfaces
- **Casing:** `PascalCase`
- **Rule:** Descriptive nouns. The Hungarian notation `I` prefix (e.g., `INotice`) is **strictly prohibited**.
- **Suffix Guidelines:**
  - `*DTO`: Data Transfer Objects transferred over the network (e.g., `NoticeDTO`, `ServiceRequestDTO`).
  - `*Input`: Form or API payload input types (e.g., `CreateNoticeInput`, `LoginInput`).
  - `*Document`: Mongoose hydrated document types (e.g., `NoticeDocument`, `UserDocument`).
  - `*Entity`: Plain JavaScript lean objects (e.g., `NoticeEntity`, `UserEntity`).

### 3.2 Mongoose Models & MongoDB Collections
- **Mongoose Models:** `PascalCase` singular noun followed by `Model` (e.g., `UserModel`, `NoticeModel`, `ServiceRequestModel`).
- **MongoDB Collections:** `snake_case` plural nouns matching physical storage tables (e.g., `users`, `notices`, `service_requests`, `timetable_slots`).

---

## 4. API Endpoints & Environment Variables

### 4.1 REST API Routes
- **Casing:** `kebab-case` pluralized resources.
- **Rule:** Follows RESTful URL hierarchy.
- **Examples:**
  - `/api/realtime/token`
  - `/api/storage/signature`
  - `/api/webhooks/clerk`
  - `/api/webhooks/cloudinary`

### 4.2 Environment Variables
- **Casing:** `UPPER_SNAKE_CASE`
- **Public Client Variables:** Mandatory `NEXT_PUBLIC_` prefix (e.g., `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- **Server Secrets:** Unprefixed (e.g., `CLERK_SECRET_KEY`, `MONGODB_URI`, `ABLY_API_KEY`).

