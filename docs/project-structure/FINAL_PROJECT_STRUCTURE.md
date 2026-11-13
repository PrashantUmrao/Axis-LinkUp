# Master Project Directory Architecture

> **Document ID:** DOC-STRUC-001  
> **Status:** Approved Baseline (Phase 1, Part 1.5)  
> **Institution:** Axis Institute of Technology & Management  
> **Framework:** Next.js 15+ (App Router) with TypeScript Strict Mode  
> **Architectural Pattern:** Modular Monolith with Feature-Based Grouping  
> **Last Updated:** November 2026  

---

## 1. High-Level Directory Overview

The root repository layout for **Axis LinkUp** is organized into clean, single-responsibility top-level directories:

```
axis-linkup/
├── .github/                        # CI/CD workflows, issue templates, PR checks
├── docs/                           # Authoritative architectural & technical documentation
│   ├── requirements/               # Phase 1.1: Functional & Non-Functional Requirements
│   ├── architecture/               # Phase 1.2: System, Auth, Real-Time & Deployment Architecture
│   ├── technology/                 # Phase 1.3: Stack Finalization, Compatibility & Standards
│   ├── database/                   # Phase 1.4: Collections, Schemas, Indexing & Retention
│   └── project-structure/          # Phase 1.5: Folder Design & Coding Conventions
├── public/                         # Static web assets, PWA manifest, service workers
├── scripts/                        # Administrative scripts, seed data, DB verification tools
├── src/                            # Application source code (App Router, features, core lib)
│   ├── app/                        # Next.js App Router (Routes, Layouts, Server Actions, API)
│   ├── components/                 # Shared UI primitives, composite widgets, layouts
│   ├── features/                   # Independent domain feature modules (Components, hooks, services)
│   ├── hooks/                      # Global, cross-cutting React hooks
│   ├── lib/                        # Infrastructure, database clients, auth guards, utils
│   └── types/                      # Global TypeScript definitions, enums, API envelopes
├── tests/                          # Test fixtures, Playwright E2E suites, integration helpers
├── .env.example                    # Template for environment configuration
├── .gitignore                      # Git exclusion rules
├── .prettierrc                     # Prettier code formatting configuration
├── components.json                 # shadcn/ui component configuration
├── eslint.config.mjs               # ESLint 9+ flat configuration
├── next.config.ts                  # Next.js compiler and security headers configuration
├── package.json                    # Project manifest, scripts, and production dependencies
├── playwright.config.ts            # Playwright end-to-end testing configuration
├── postcss.config.mjs              # PostCSS plugins configuration (Tailwind, Autoprefixer)
├── tailwind.config.ts              # Tailwind CSS design tokens, brand colors, dark mode
├── tsconfig.json                   # Strict TypeScript compiler options and path aliases
└── vitest.config.ts                # Vitest unit and integration test configuration
```

---

## 2. Directory Responsibilities & Boundary Definitions

### 2.1 `src/` (Application Source Root)
All production TypeScript code resides inside `src/`. Subdirectories maintain a strict separation of concerns:
- **`src/app/`**: Route definitions, layouts, loading skeletons, error boundaries, Server Actions, and Route Handlers. Contains minimal presentation code; delegates immediately to feature components and domain services.
- **`src/features/`**: Domain-driven feature packages (e.g., `notices`, `requests`, `chat`, `assignments`). Each feature encapsulates its own internal components, hooks, services, validation schemas, and types.
- **`src/components/`**: Reusable, domain-agnostic UI elements (`ui/` primitives based on shadcn/ui, `shared/` composite widgets like banners and data tables, and `layouts/` role-specific dashboard shells).
- **`src/lib/`**: Cross-cutting foundation code: cached Mongoose client, repository abstractions, Clerk auth guards, Cloudinary helpers, Ably client, and utility functions.
- **`src/types/`**: Global TypeScript interfaces, DTOs, API envelopes, and institutional enums.

### 2.2 `public/` (Static Web Assets)
Static files served directly from the root domain:
- `public/favicon.ico`, `public/logo.svg`, `public/emblem.png`: Official Axis Institute branding.
- `public/manifest.json`: Progressive Web App (PWA) manifest.
- `public/icons/`: PWA app icons for mobile home-screen installation (`icon-192x192.png`, `icon-512x512.png`).
- `public/firebase-messaging-sw.js`: Firebase Cloud Messaging Web Push service worker (Phase 2).

### 2.3 `docs/` (Authoritative Documentation Hub)
The single source of truth for the system's design and evolution:
- `requirements/`: Project overview, IEEE 830 SRS, user roles, feature specifications, roadmap.
- `architecture/`: C4 diagrams, high-level, frontend, backend, auth, real-time, storage, and deployment specs.
- `technology/`: Stack evaluation, dependency matrix, engineering standards, environment variables.
- `database/`: 25 collection schemas, indexing rules, validation, data security, lifecycle.
- `project-structure/`: Directory architecture, naming conventions, import boundaries.

### 2.4 `scripts/` (DevOps & Database Utilities)
Automation and administrative scripts executed from the terminal:
- `scripts/seed-database.ts`: Seeds initial institutional records (Departments: CSE, ECE, ME; Default Request Categories; Academic Terms).
- `scripts/verify-indexes.ts`: Connects to MongoDB Atlas and validates that all 25 collections possess the approved compound and TTL indexes.
- `scripts/create-super-admin.ts`: CLI utility to provision the initial Super Admin account via Clerk Backend SDK.

### 2.5 `tests/` (Testing Harness & E2E Suites)
Dedicated testing directories decoupled from production builds:
- `tests/e2e/`: Playwright multi-role browser test suites (Student submission flow, Admin request approval, Emergency mode takeover).
- `tests/fixtures/`: Mock datasets (sample student rosters, fake assignment PDFs, mock Clerk tokens).
- `tests/helpers/`: Database test cleanup routines and mock authentication wrappers.

---

## 3. Configuration & Root File Inventory

| File Name | Responsibility |
| :--- | :--- |
| `next.config.ts` | Configures image domains (`res.cloudinary.com`), security headers (CSP, HSTS, X-Frame-Options), and experimental server action optimizations. |
| `tsconfig.json` | Enforces `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, and maps `@/*` to `./src/*`. |
| `tailwind.config.ts` | Declares Axis Institute primary/secondary color palettes, custom animations (emergency alert pulse), and dark mode variants. |
| `components.json` | Configuration metadata for shadcn/ui CLI tooling (`rsc: true`, `tsx: true`, alias mapping). |
| `eslint.config.mjs` | ESLint 9+ flat configuration enforcing TypeScript standards, React hooks rules, and architectural boundary protections. |
| `.prettierrc` | Enforces code formatting: 2 spaces, single quotes, trailing commas, 100 character line limit, and Tailwind class sorting. |
| `vitest.config.ts` | Configures Vitest for native TypeScript and ESM execution with happy-dom environment for component testing. |
| `playwright.config.ts` | Configures Playwright multi-browser test runners (Chromium, Firefox, WebKit) targeting local and preview URLs. |
| `.env.example` | Template documenting all mandatory public and private environment variables without storing real credentials. |

