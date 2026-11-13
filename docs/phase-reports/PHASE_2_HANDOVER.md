# Phase 2 — Engineering Handover Documentation

> **Document ID:** DOC-PHASE2-HAND-001  
> **Status:** Official Handover (Phase 2 to Phase 3)  
> **Institution:** Axis Institute of Technology & Management  
> **Project:** Axis LinkUp Platform  
> **Handover Date:** November 2026  

---

## 1. Executive Handover Summary

Phase 2 (Foundation & Setup) is **100% complete, verified, and audited**. The repository possesses a working Next.js 15+ App Router architecture, full TypeScript strict typing, Tailwind CSS v4 design system, shadcn/ui accessible primitives, verified MongoDB Atlas connectivity, centralized environment validation, comprehensive shared infrastructure, and a passing test suite.

The project is certified **READY** to begin **Phase 3: Database Models & Authentication Architecture**.

---

## 2. Key Implemented Modules & Directory Map

```
c:\Users\prash\Desktop\Axis LinkUp/
├── .env.example                       # Canonical environment template (committed)
├── .env                               # Local secrets file with live Atlas URI (untracked)
├── .gitignore                         # Strict exclusion of .env, .env.*, node_modules, .next
├── components.json                    # shadcn/ui configuration (Radix Nova preset)
├── eslint.config.mjs                  # ESLint 9 Flat Config (0 warnings allowed)
├── next.config.ts                     # Next.js compiler settings
├── tsconfig.json                      # TypeScript strict compiler configuration
│
├── src/
│   ├── app/
│   │   ├── (auth)/                    # Authentication route group (Phase 3)
│   │   ├── (student)/                 # Student workspace route group (Phase 4)
│   │   ├── (faculty)/                 # Faculty workspace route group (Phase 4)
│   │   ├── (admin)/                   # Admin workspace route group (Phase 5)
│   │   ├── (super-admin)/             # Super admin workspace route group (Phase 5)
│   │   ├── (shared)/                  # Cross-cutting public routes
│   │   ├── actions/                   # Global Server Actions
│   │   ├── api/health/db/route.ts     # Live MongoDB Atlas health-check endpoint
│   │   ├── ui-preview/page.tsx        # Interactive UI component test showcase
│   │   ├── globals.css                # Tailwind CSS v4 design tokens (Navy/Gold/Slate)
│   │   └── layout.tsx                 # Root application layout
│   │
│   ├── components/
│   │   ├── ui/                        # 11 Tier-1 shadcn/ui primitives (Button, Dialog, etc.)
│   │   ├── shared/                    # Composite shared components (Phase 3)
│   │   └── layouts/                   # Role-specific dashboard layouts (Phase 4)
│   │
│   ├── features/                      # 13 Domain feature packages (assignments, notices, etc.)
│   │
│   ├── lib/
│   │   ├── api/                       # Standard ApiResponse helpers and error handlers
│   │   ├── errors/                    # AppError hierarchy and standard error codes
│   │   ├── logging/                   # Structured logger with automated secret redaction
│   │   ├── utils/                     # Formatting utilities (date, number, file size, cn)
│   │   ├── validations/               # Reusable Zod schemas (ObjectId, pagination, roll numbers)
│   │   └── db/
│   │       ├── client.ts              # Exported Mongoose client
│   │       ├── mongodb.ts             # Cached singleton connection utility
│   │       ├── models/                # Mongoose models directory (Phase 3 target)
│   │       └── repositories/          # DAL repository directory (Phase 3 target)
│   │
│   ├── config/
│   │   ├── constants.ts               # Shared HTTP status codes, pagination, limits
│   │   └── env.ts                     # Zod validated environment variables & security proxy
│   │
│   └── types/
│       ├── api.ts                     # Master API response envelope contracts
│       ├── common.ts                  # Shared TypeScript utility types
│       └── index.ts                   # Unified type exports
│
├── tests/
│   └── unit/infrastructure.test.ts    # 16-test unit suite for core infrastructure
│
└── docs/
    ├── setup/                         # Phase 2 setup guides and architecture specs
    ├── ui/                            # Design tokens and UI foundation docs
    ├── engineering/                   # Playbook, API standards, code style guides
    ├── database/                      # Phase 1 database design (25 collection specs)
    └── phase-reports/                 # Phase 2 audit and verification reports
```

---

## 3. Available NPM Scripts

| Command | Action Performed | Expected Exit Code |
| :--- | :--- | :---: |
| `npm run dev` | Starts local Next.js development server on `http://localhost:3000` | Running process |
| `npm run build` | Compiles production-optimized bundles and pre-renders static pages | `0` |
| `npm run start` | Boots compiled production build locally | Running process |
| `npm run typecheck` | Executes `tsc --noEmit` under strict TypeScript compiler rules | `0` |
| `npm run lint` | Runs ESLint 9 Flat Config against all `.ts` and `.tsx` source files | `0` |
| `npm run format:check` | Verifies that all files conform to Prettier formatting | `0` |
| `npm run format` | Automatically writes Prettier formatting across the repository | `0` |
| `npm test` | Runs the 16-test unit test suite using `npx tsx --test` | `0` |

---

## 4. How to Start & Verify the Project

### 4.1 Running the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser. You should see the Axis LinkUp welcome homepage.

### 4.2 Verifying UI Primitives
Navigate to:
```
http://localhost:3000/ui-preview
```
This showcases interactive buttons, modals, dropdowns, inputs, badges, and avatars.

### 4.3 Verifying MongoDB Atlas Connectivity
Send a `GET` request to:
```
http://localhost:3000/api/health/db
```
Or execute in PowerShell:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/health/db -Method GET | ConvertTo-Json
```
**Expected Response:**
```json
{
  "success": true,
  "message": "Database connected successfully",
  "database": "connected"
}
```

---

## 5. Known Issues & Operational Notes

- **Third-Party Keys Deferred:** Clerk, Cloudinary, Ably, and Resend credentials in `.env.example` are placeholders. The application builds cleanly without them because `src/config/env.ts` marks them optional until their respective feature phases.
- **Port Availability:** Next.js defaults to port 3000. If port 3000 is occupied, it automatically increments to port 3001.

---

## 6. Instructions for Starting Phase 3

Phase 3 transitions from infrastructural foundation to **Database Models & Authentication Architecture**.

### Exact Immediate Next Steps:
1. **Phase 3, Part 3.1: Core Academic Mongoose Models & Schemas**
   - Implement the first batch of authoritative Mongoose schemas in `src/lib/db/models/` based on Phase 1 specs:
     - `User` (`users` collection)
     - `Department` (`departments` collection)
     - `Course` (`courses` collection)
     - `AcademicTerm` (`academic_terms` collection)
     - `CourseEnrollment` (`course_enrollments` collection)
2. **Phase 3, Part 3.2: Compound & TTL Index Definitions**
   - Enforce Equality-Sort-Range (ESR) compound indexes on all models.
3. **Phase 3, Part 3.3: Data Access Layer (DAL) Repositories**
   - Scaffold tenant-isolated repositories in `src/lib/db/repositories/`.
4. **Phase 3, Part 3.4: Clerk Authentication & Webhook Ingress**
   - Integrate Clerk session middleware and Svix webhook sync.

