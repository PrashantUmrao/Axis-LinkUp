# Axis LinkUp — Project Structure Implementation Report

> **Document ID:** DOC-SETUP-005  
> **Status:** Implementation Complete (Phase 2, Part 2.5)  
> **Institution:** Axis Institute of Technology & Management  
> **Architectural Pattern:** Modular Monolith on Next.js 15+ App Router  
> **Design Framework:** Feature-Driven Architecture (Vertical Slices) & Layered Service-Repository  
> **Verification Date:** November 2026  
> **Verification Status:** **100% PASS** (Types, Linting, Formatting, Production Build)  

---

## 1. Executive Summary

Phase 2, Part 2.5 established the full production directory architecture for **Axis LinkUp**, transforming the initialized baseline into an enterprise-grade modular monolith. 

All existing working code (Next.js 15 App Router configuration, 11 shadcn/ui components in `src/components/ui/`, custom Geist font bindings, and the `/ui-preview` development tool) was preserved with zero regressions.

---

## 2. Directory Inventory & Implementation Audit

### 2.1 Existing Directories Preserved
- `docs/` — 71 authoritative requirements, architecture, database, engineering, and setup specifications.
- `public/` — Static brand icons, SVG assets, and favicon.
- `src/app/` — Root layout, homepage, global CSS, and `ui-preview/`.
- `src/components/ui/` — 11 Tier-1 shadcn/ui primitives (`button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, etc.).
- `src/lib/` — Existing `utils.ts` (`cn` helper).

### 2.2 Directories Created

#### App Router Route Groups (`src/app/`):
- `src/app/(auth)/` — Public authentication flows (Sign-in, sign-up, password reset).
- `src/app/(student)/` — Mobile-first student workspace with bottom dock and emergency alert rail.
- `src/app/(faculty)/` — Faculty evaluation cockpit with collapsible sidebar.
- `src/app/(admin)/` — High-density departmental admin console with SLA queue counters.
- `src/app/(super-admin)/` — Executive leadership console, RBAC matrix, and emergency trigger dock.
- `src/app/(shared)/` — Universal cross-role pages (Profile settings, public emergency broadcast view).
- `src/app/api/` — Route Handlers for external webhooks and stateless token generation.
- `src/app/actions/` — Server Actions for validated, authenticated server-side mutations.

#### Shared Component Directories (`src/components/`):
- `src/components/layouts/` — Role-specific layout shells (Student, Faculty, Admin, Super Admin).
- `src/components/navigation/` — Universal top bars, collapsible sidebars, bottom nav bars.
- `src/components/shared/` — Domain-agnostic composite widgets (Generic data tables, upload dropzones, emergency banners, status badges).

#### Feature Modules (`src/features/`):
- `src/features/auth/` — Session verification, role claims, password recovery.
- `src/features/users/` — Campus user roster, profile management, bulk CSV provisioning.
- `src/features/communication/` — Real-time chat, direct messaging, course channels.
- `src/features/notices/` — Official collegiate bulletins, targeted departmental announcements, read receipts.
- `src/features/academics/` — Daily student agenda, lecture timetables, academic calendar events.
- `src/features/assignments/` — Coursework distribution, deadline countdowns, submission dropzones, grading.
- `src/features/resources/` — Lecture presentations, notes repository, syllabus downloads.
- `src/features/polls/` — Campus democratic voting, student polls, real-time ballot aggregation.
- `src/features/requests/` — Student requisition tracking (bonafide, leave, hostel passes) with SLA tracking.
- `src/features/campus/` — Room and lab finder, space availability inspection, reservation queues.
- `src/features/notifications/` — In-app notification center, unread counters, push preferences.
- `src/features/safety/` — Campus emergency broadcast takeover, siren triggers, acknowledgment auditing.
- `src/features/audit/` — Security audit ledger, administrative action tracking, compliance logs.

#### Core Backend Infrastructure (`src/lib/`):
- `src/lib/auth/` — Session extraction, role guards (`requireAuth`, `requireRole`), RBAC engine.
- `src/lib/auth/policies/` — Attribute-Based Access Control (ABAC) policies.
- `src/lib/db/` — Data Access Layer root.
- `src/lib/db/models/` — Mongoose schemas and model definitions (25 collections).
- `src/lib/db/repositories/` — Domain repositories enforcing the ESR indexing rule.
- `src/lib/integrations/` — Managed cloud SDK clients (Clerk, Ably, Cloudinary, Resend).
- `src/lib/services/` — Pure domain business logic orchestration.
- `src/lib/validations/` — Global Zod validation schemas (forms, mutations, environment).
- `src/lib/utils/` — General utility functions (date formatting, sanitization).

#### Shared System Directories:
- `src/hooks/` — Global cross-cutting React hooks (theme, network, viewport).
- `src/types/` — Global TypeScript definitions, enums, DTOs, API envelopes.
- `src/config/` — Static site configuration, institutional metadata, navigation items.
- `tests/unit/` — Fast algorithmic unit tests (Vitest).
- `tests/integration/` — Database pipeline and service integration tests (Vitest).
- `tests/e2e/` — Multi-browser user journey automation (Playwright).
- `scripts/` — Administrative utilities, seed data generators, index verification scripts.

---

## 3. Final Repository Directory Tree

```text
axis-linkup/
├── docs/                           # 71 Architecture, requirements, database, & setup specifications
├── public/                         # Static icons & brand assets
├── scripts/                        # Administrative scripts & DB seeds
│   └── README.md
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (admin)/                # Department Administrator workspace
│   │   ├── (auth)/                 # Public authentication flows
│   │   ├── (faculty)/              # Faculty Evaluation cockpit
│   │   ├── (shared)/               # Cross-role profile & emergency view
│   │   ├── (student)/              # Mobile-first student workspace
│   │   ├── (super-admin)/          # Executive & IT security console
│   │   ├── actions/                # Next.js Server Actions
│   │   ├── api/                    # Route Handlers (Webhooks & token endpoints)
│   │   ├── ui-preview/             # Isolated design system preview
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── README.md
│   │
│   ├── components/                 # Presentation components
│   │   ├── layouts/                # Role layout shells (dock, sidebar, console)
│   │   ├── navigation/             # Top app bar, bottom nav, breadcrumbs
│   │   ├── shared/                 # Composite widgets (data-table, dropzone)
│   │   ├── ui/                     # 11 Tier-1 shadcn/ui primitives
│   │   └── README.md
│   │
│   ├── config/                     # Institutional site configuration
│   │
│   ├── features/                   # 13 Independent domain feature slices
│   │   ├── academics/
│   │   ├── assignments/
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── campus/
│   │   ├── communication/
│   │   ├── notices/
│   │   ├── notifications/
│   │   ├── polls/
│   │   ├── requests/
│   │   ├── resources/
│   │   ├── safety/
│   │   ├── users/
│   │   └── README.md
│   │
│   ├── hooks/                      # Global cross-cutting React hooks
│   │
│   ├── lib/                        # Core backend & infrastructure
│   │   ├── auth/
│   │   │   └── policies/           # ABAC security policies
│   │   ├── db/
│   │   │   ├── models/             # Mongoose schemas (25 collections)
│   │   │   └── repositories/       # Data Access Layer
│   │   ├── integrations/           # Clerk, Ably, Cloudinary, Resend
│   │   ├── services/               # Pure domain business logic
│   │   ├── utils/                  # Formatting, sanitization
│   │   ├── validations/            # Zod input schemas
│   │   ├── utils.ts                # cn utility
│   │   └── README.md
│   │
│   └── types/                      # Global TypeScript definitions
│       └── README.md
│
├── tests/                          # Automated testing suites
│   ├── e2e/                        # Playwright browser journeys
│   ├── integration/                # Vitest database integration
│   ├── unit/                       # Vitest unit tests
│   └── README.md
│
├── .editorconfig
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── README.md
└── tsconfig.json
```

---

## 4. Architectural Boundaries & Import Governance

All developers and AI coding agents must respect the **Strict Unidirectional Flow of Dependencies**:

1. **PROHIB-01 (Zero Direct Database Access in Presentation):** React components in `src/components/` and `src/app/**/page.tsx` must **never** import Mongoose models or call repository queries directly. All mutations pass through Server Actions (`src/app/actions/`), and all data fetching uses domain services.
2. **PROHIB-02 (Server Isolation):** Modules in `src/lib/db/`, `src/lib/auth/guards.ts`, and `src/lib/integrations/` run exclusively on the server and must **never** be imported into client components (`'use client'`).
3. **PROHIB-03 (Public API Contract):** Feature cross-dependencies must strictly import through `@/features/{domain}` (`index.ts`). Deep imports into private feature internals (e.g., `@/features/notices/services/private-helper`) are strictly forbidden.

---

## 5. Verification Results

All quality routines were executed to confirm that the new folder structure did not introduce regressions:

| Verification Routine | Terminal Command | Result | Verification Notes |
| :--- | :--- | :---: | :--- |
| **Strict Type Checking** | `npm run typecheck` (`tsc --noEmit`) | **PASS** | 0 errors. `@/*` alias mapping confirmed across all paths. |
| **ESLint Analysis** | `npm run lint` (`eslint`) | **PASS** | 0 warnings, 0 errors. Flat config passed cleanly. |
| **Prettier Formatting** | `npm run format:check` | **PASS** | All new README files and directory structures formatted. |
| **Next.js Production Build** | `npm run build` (`next build`) | **PASS** | Compiled in 6.6s. 6 static pages prerendered cleanly. |

---

## 6. Deviations from Approved Documentation

- **Zero Deviations.** The implemented structure matches the blueprint defined in `docs/project-structure/` 100%.

