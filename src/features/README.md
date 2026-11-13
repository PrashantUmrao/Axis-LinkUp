# Feature-Driven Architecture (`src/features/`)

Axis LinkUp employs **Vertical Slicing** (Feature-Driven Architecture) to encapsulate domain logic, preventing cross-module spaghetti dependencies.

## 1. Feature Module Catalog

| Feature Module       | Core Responsibility & Scope                                                       |
| :------------------- | :-------------------------------------------------------------------------------- |
| **`auth/`**          | Session verification, role claims, password recovery, MFA                         |
| **`users/`**         | Campus user roster, profile management, bulk CSV provisioning                     |
| **`communication/`** | Real-time chat channels, direct messaging, group conversations                    |
| **`notices/`**       | Official collegiate bulletins, targeted departmental announcements, read receipts |
| **`academics/`**     | Daily student agenda, lecture timetables, academic calendar events                |
| **`assignments/`**   | Coursework distribution, deadline countdowns, submission dropzones, grading       |
| **`resources/`**     | Lecture presentations, notes repository, syllabus downloads                       |
| **`polls/`**         | Campus democratic voting, student polls, real-time ballot aggregation             |
| **`requests/`**      | Student requisition tracking (bonafide, leave, hostel passes) with SLA tracking   |
| **`campus/`**        | Room and lab finder, space availability inspection, reservation queues            |
| **`notifications/`** | In-app notification center, unread counters, push preferences                     |
| **`safety/`**        | Campus emergency broadcast takeover, siren triggers, acknowledgment auditing      |
| **`audit/`**         | Security audit ledger, administrative action tracking, compliance logs            |

## 2. Standard Feature Directory Anatomy

Every feature encapsulates its own internal assets:

```text
src/features/{domain}/
├── components/         # Feature-specific UI components & modals
├── hooks/              # Domain-specific React hooks & Ably listeners
├── services/           # Feature business logic & orchestration
├── schemas/            # Zod validation schemas for forms and mutations
├── types/              # Feature-scoped TypeScript DTOs & interfaces
└── index.ts            # Public API Contract (Only exported symbols are public)
```

## 3. Strict Architectural Rules

1. **Public API Contract:** External code (App Router routes or other features) must **only** import from `@/features/{domain}` (`index.ts`).
2. **No Deep Imports:** Direct deep imports into private feature internals (e.g., `@/features/notices/services/private-helper`) are strictly forbidden.
3. **No Direct Database Access in UI:** Feature components must never query Mongoose models or repositories directly.
