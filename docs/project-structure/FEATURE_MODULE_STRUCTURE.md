# Feature-Based Architecture Specification

> **Document ID:** DOC-STRUC-003  
> **Status:** Approved Baseline (Phase 1, Part 1.5)  
> **Institution:** Axis Institute of Technology & Management  
> **Architectural Pattern:** Vertical Slice / Feature-Driven Development  
> **Location:** `src/features/`  
> **Last Updated:** November 2026  

---

## 1. Feature-Driven Architecture Philosophy

Axis LinkUp implements a **Feature-Driven Architecture** (Vertical Slicing) inside `src/features/`. 

Rather than scattering files across horizontal directories (putting all components in `components/`, all services in `services/`, and all types in `types/`), all domain-specific logic is co-located within isolated feature folders.

```mermaid
graph TD
    subgraph FeaturePackage [Independent Feature Module: src/features/{domain}/]
        PublicAPI["Public API (index.ts)"]
        Components["components/ (Domain UI & Modals)"]
        Hooks["hooks/ (Domain State & Ably Listeners)"]
        Services["services/ (Pure Business Logic)"]
        Schemas["schemas/ (Zod Validation Contracts)"]
        Types["types/ (Domain DTOs & Interfaces)"]
        Tests["__tests__/ (Feature Unit & Integration Tests)"]
        
        PublicAPI --> Components
        PublicAPI --> Hooks
        PublicAPI --> Services
        PublicAPI --> Schemas
        PublicAPI --> Types
        Components --> Hooks
        Components --> Schemas
        Services --> Schemas
        Tests --> Services
    end

    AppRoutes["Next.js App Router (src/app/)"] -->|Imports ONLY via| PublicAPI
    OtherFeatures["Other Features"] -->|Imports ONLY via| PublicAPI
```

### Core Rules for Feature Modules:
1. **Public API Contract (`index.ts`):** Every feature exports only its public components, action functions, and types via its root `index.ts`. Private internal helper functions are never exported.
2. **Zero Deep Coupling:** A feature module cannot import files from the private internals of another feature module (e.g., `import { x } from '@/features/notices/services/private-helper'` is strictly prohibited by ESLint).
3. **Cross-Feature Communication:** Handled either through shared domain services in `src/lib/services/` or by calling public service methods exposed via `src/features/*/index.ts`.

---

## 2. Feature Module Directory Catalog

Below is the complete structural layout of all 17 domain feature directories:

```
src/features/
├── auth/                               # Feature: Authentication & Session Verification
│   ├── components/                     # Sign-in form card, MFA prompt, password recovery card
│   ├── hooks/                          # useAuthSession, useCurrentUserRole
│   ├── schemas/                        # login.schema.ts, reset-password.schema.ts
│   ├── services/                       # auth.service.ts (session claims, role validation)
│   ├── types/                          # auth.types.ts (UserSession, AuthCredentialsDTO)
│   ├── __tests__/                      # auth.service.test.ts
│   └── index.ts                        # Public exports
│
├── users/                              # Feature: User Management & Roster Provisioning
│   ├── components/                     # UserTable, BulkImportWizard, RoleBadge, UserProfileForm
│   ├── hooks/                          # useUserDirectory, useUserProfile
│   ├── schemas/                        # user-profile.schema.ts, csv-import.schema.ts
│   ├── services/                       # user.service.ts (provisioning, role update, status toggles)
│   ├── types/                          # user.types.ts (UserDTO, StudentMetadata, FacultyMetadata)
│   ├── __tests__/                      # user.service.test.ts
│   └── index.ts
│
├── departments/                        # Feature: Academic Department Hierarchy
│   ├── components/                     # DepartmentCard, DepartmentSelectDropdown
│   ├── schemas/                        # department.schema.ts
│   ├── services/                       # department.service.ts
│   ├── types/                          # department.types.ts
│   ├── __tests__/                      # department.service.test.ts
│   └── index.ts
│
├── courses/                            # Feature: Academic Course Catalog & Sections
│   ├── components/                     # CourseCard, CourseSelectorDropdown, EnrollmentRosterTable
│   ├── schemas/                        # course.schema.ts, enrollment.schema.ts
│   ├── services/                       # course.service.ts
│   ├── types/                          # course.types.ts
│   ├── __tests__/                      # course.service.test.ts
│   └── index.ts
│
├── notices/                            # Feature: Official Bulletins & Targeted Notices (MOD-07)
│   ├── components/                     # NoticeCard, NoticeFeed, NoticeComposerModal, ReadReceiptProgress
│   ├── hooks/                          # useNoticeFeed, useNoticeAcknowledgment
│   ├── schemas/                        # notice-create.schema.ts, notice-filter.schema.ts
│   ├── services/                       # notice.service.ts (targeting, publication, receipt tracking)
│   ├── types/                          # notice.types.ts (NoticeDTO, TargetScopeDTO)
│   ├── __tests__/                      # notice.service.test.ts
│   └── index.ts
│
├── chat/                               # Feature: Real-Time Messaging & Direct Chat (MOD-08)
│   ├── components/                     # ChatThreadView, MessageBubble, MessageInputBox, ChannelList
│   ├── hooks/                          # useAblyChatChannel, useChannelPresence, useTypingIndicator
│   ├── schemas/                        # chat-message.schema.ts
│   ├── services/                       # chat.service.ts (message persistence, channel access checks)
│   ├── types/                          # chat.types.ts (ChatMessageDTO, ChatChannelDTO)
│   ├── __tests__/                      # chat.service.test.ts
│   └── index.ts
│
├── groups/                             # Feature: Course & Departmental Channel Memberships
│   ├── components/                     # GroupMemberList, AddMemberModal
│   ├── schemas/                        # group.schema.ts
│   ├── services/                       # group.service.ts
│   ├── types/                          # group.types.ts
│   └── index.ts
│
├── academics/                          # Feature: Academic Calendar & Timetables (MOD-10)
│   ├── components/                     # DailyAgendaView, WeeklyTimetableGrid, CalendarEventModal
│   ├── hooks/                          # useDailySchedule, useAcademicEvents
│   ├── schemas/                        # timetable.schema.ts, calendar-event.schema.ts
│   ├── services/                       # timetable.service.ts (schedule queries, clash detection)
│   ├── types/                          # timetable.types.ts (TimetableSlotDTO, CalendarEventDTO)
│   ├── __tests__/                      # timetable.service.test.ts
│   └── index.ts
│
├── requests/                           # Feature: Student Request Tracker (MOD-13)
│   ├── components/                     # RequestKanbanBoard, RequestTimeline, RequestFormBuilder
│   ├── hooks/                          # useRequestQueue, useRequestDetail
│   ├── schemas/                        # service-request.schema.ts, request-approval.schema.ts
│   ├── services/                       # request.service.ts (SLA calculation, status transition, certificate PDF)
│   ├── types/                          # request.types.ts (ServiceRequestDTO, RequestCategoryDTO)
│   ├── __tests__/                      # request.service.test.ts
│   └── index.ts
│
├── notifications/                      # Feature: In-App Notification Center (MOD-17)
│   ├── components/                     # NotificationBellDrawer, NotificationItem, BadgeCounter
│   ├── hooks/                          # useNotifications, useUnreadCount
│   ├── schemas/                        # notification.schema.ts
│   ├── services/                       # notification.service.ts (dispatch, mark read)
│   ├── types/                          # notification.types.ts (NotificationDTO)
│   ├── __tests__/                      # notification.service.test.ts
│   └── index.ts
│
├── audit/                              # Feature: Security & Compliance Audit Ledger (MOD-19)
│   ├── components/                     # AuditLogTable, AuditDiffViewer, SecurityAlertBadge
│   ├── hooks/                          # useAuditLogs
│   ├── schemas/                        # audit-query.schema.ts
│   ├── services/                       # audit.service.ts (immutable logging, query filters)
│   ├── types/                          # audit.types.ts (AuditLogDTO)
│   ├── __tests__/                      # audit.service.test.ts
│   └── index.ts
│
├── assignments/                        # Feature (Phase 2): Coursework & Submissions (MOD-11)
│   ├── components/                     # AssignmentList, SubmissionDropzone, GradingQueueTable
│   ├── hooks/                          # useAssignmentSubmissions
│   ├── schemas/                        # assignment.schema.ts, grade-submission.schema.ts
│   ├── services/                       # assignment.service.ts (deadline enforcement, evaluation)
│   ├── types/                          # assignment.types.ts (AssignmentDTO, SubmissionDTO)
│   └── index.ts
│
├── resources/                          # Feature (Phase 2): Notes & Study Materials (MOD-12)
│   ├── components/                     # StudyMaterialGrid, UploadNotesModal, DocumentViewer
│   ├── schemas/                        # study-material.schema.ts
│   ├── services/                       # resource.service.ts
│   ├── types/                          # resource.types.ts
│   └── index.ts
│
├── polls/                              # Feature (Phase 2): Polls & Democratic Voting (MOD-09)
│   ├── components/                     # PollCard, PollResultsChart, PollComposerModal
│   ├── schemas/                        # poll.schema.ts
│   ├── services/                       # poll.service.ts (anonymous vote recording, ballot counting)
│   ├── types/                          # poll.types.ts
│   └── index.ts
│
├── campus/                             # Feature (Phase 2): Room & Lab Finder (MOD-14)
│   ├── components/                     # RoomAvailabilityGrid, RoomBookingModal, SpaceSpecCard
│   ├── schemas/                        # room-booking.schema.ts
│   ├── services/                       # facility.service.ts (occupancy lookup, booking approval)
│   ├── types/                          # facility.types.ts
│   └── index.ts
│
├── growth/                             # Feature (Phase 3): Skill & Achievement Passport (MOD-15)
│   ├── components/                     # PassportProfileView, AddMilestoneModal, VerificationQueue
│   ├── schemas/                        # achievement.schema.ts
│   ├── services/                       # passport.service.ts (endorsement pipeline, verification badge)
│   ├── types/                          # passport.types.ts
│   └── index.ts
│
└── emergency/                          # Feature (Phase 3): Campus Emergency Broadcast (MOD-16)
    ├── components/                     # EmergencyTakeoverModal, EmergencyBanner, EmergencyDock
    ├── hooks/                          # useEmergencyAlert
    ├── schemas/                        # emergency-alert.schema.ts
    ├── services/                       # emergency.service.ts (master trigger, receipt acknowledgment)
    ├── types/                          # emergency.types.ts
    └── index.ts
```

---

## 3. Standard Feature Module Anatomy Example

Taking `src/features/notices/` as the architectural standard:

```typescript
// src/features/notices/index.ts (Public API Contract)
export { NoticeCard } from './components/notice-card';
export { NoticeFeed } from './components/notice-feed';
export { NoticeComposerModal } from './components/notice-composer-modal';
export { useNoticeFeed } from './hooks/use-notice-feed';
export { NoticeService } from './services/notice.service';
export { createNoticeSchema, noticeQuerySchema } from './schemas/notice.schema';
export type { NoticeDTO, CreateNoticeInput } from './types/notice.types';
```

Any component or route outside `notices` imports strictly from `@/features/notices`, ensuring that internal refactoring inside `src/features/notices/components/` never breaks external consumers.

