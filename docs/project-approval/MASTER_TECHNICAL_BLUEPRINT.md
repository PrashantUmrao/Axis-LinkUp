# Master Technical Blueprint & System Architecture

> **Document ID:** DOC-APPR-002  
> **Status:** Authoritative Baseline (Phase 1, Part 1.7)  
> **Institution:** Axis Institute of Technology & Management  
> **Target Release:** Axis LinkUp Version 1.0 (MVP) through Version 3.0  
> **Last Updated:** November 2026  

---

## 1. System Topology & Architecture Overview

Axis LinkUp is engineered as a **Modular Monolith** deployed on **Vercel Serverless & Edge Infrastructure**, backed by **MongoDB Atlas (AWS Mumbai `ap-south-1`)** and managed specialized Platform-as-a-Service (PaaS) providers for identity, real-time messaging, file storage, and transactional notifications.

```mermaid
graph TD
    subgraph ClientLayer [Client Applications]
        StudentMobile["Student Mobile PWA (iOS / Android)"]
        FacultyTablet["Faculty Tablet / Desktop Workspace"]
        AdminDesktop["Admin & Super Admin High-Density Console"]
    end

    subgraph EdgeLayer [Vercel Global Edge Network]
        EdgeCDN["Anycast DNS & TLS 1.3 Termination"]
        EdgeMiddleware["Next.js Edge Middleware (Clerk Session & RBAC Guard)"]
    end

    subgraph AppLayer [Next.js Modular Monolith Core]
        subgraph IngressTier [Ingress Tier]
            AppRouter["Next.js 15 App Router (RSC & RCC)"]
            ServerActions["Server Actions (Form Mutations)"]
            RouteHandlers["Route Handlers (Webhooks & Token Minting)"]
        end

        subgraph BusinessTier [Domain Services Layer (Pure TypeScript)]
            AuthService["Auth & User Service"]
            NoticeService["Notice & Bulletin Service"]
            AcademicService["Timetable & Course Service"]
            RequestService["Student Request Tracker Service"]
            EmergencyService["Emergency Override Service"]
            AuditService["Security & Audit Log Service"]
        end

        subgraph DataAccessTier [Repository Layer (DAL)]
            Repositories["Domain Repositories (Tenant Scoped Queries)"]
            MongooseModels["Mongoose 8+ Models (25 Collections)"]
            MongooseClient["Cached Singleton Client (maxPoolSize: 10)"]
        end
    end

    subgraph PersistenceLayer [Persistence & Cloud Providers]
        MongoDB[("MongoDB Atlas M10+ (AWS Mumbai ap-south-1)")]
        Clerk["Clerk (Identity, Auth & TOTP MFA)"]
        Ably["Ably (Real-Time WebSockets & Presence)"]
        Cloudinary["Cloudinary (Private File Storage & CDN)"]
        Resend["Resend (Transactional Email API)"]
    end

    ClientLayer --> EdgeCDN
    EdgeCDN --> EdgeMiddleware
    EdgeMiddleware --> IngressTier
    IngressTier --> BusinessTier
    BusinessTier --> DataAccessTier
    DataAccessTier --> PersistenceLayer

    BusinessTier -.-> Clerk
    BusinessTier -.-> Ably
    BusinessTier -.-> Cloudinary
    BusinessTier -.-> Resend
    ClientLayer -.-> Ably
    ClientLayer -.-> Cloudinary
```

---

## 2. Frontend Architecture Blueprint

- **Framework:** Next.js 15+ App Router with React 19.
- **Route Groups & Workspaces:**
  - `(auth)`: Public sign-in, invitation onboarding, password recovery.
  - `(student)`: Mobile-first navigation with fixed bottom nav bar (`h-16`), timetable, notice feed, service requests, and course chat.
  - `(faculty)`: Productivity layout with collapsible left sidebar and active course section switcher.
  - `(admin)`: Operations layout with high-density tabular queues and SLA tracking banners.
  - `(super-admin)`: Security console with system health telemetry and persistent Emergency Override dock.
- **Rendering & Component Strategy:**
  - **Server Components (RSC):** Default for all page layouts, static headers, and initial data queries (zero client JS overhead).
  - **Client Components (`"use client"`):** Strictly applied at the leaves for interactive elements (dropzones, chat feeds, modals).
- **Design System:** Tailwind CSS utility styling + shadcn/ui (Radix UI accessible primitives). Full WCAG 2.1 AA accessibility compliance and responsive touch targets (`>= 48px`).

---

## 3. Backend Architecture Blueprint

- **Architecture:** Layered Service-Repository Pattern.
- **Ingress Handlers:**
  - **Server Actions:** Co-located in `src/features/<module>/actions.ts`. Enforce CSRF protection and type-safe RPC form mutations.
  - **Route Handlers (`/api/*`):** Reserved for Svix-verified webhooks (Clerk, Cloudinary) and ephemeral token minting (Ably).
- **Domain Services:** Plain TypeScript classes in `src/lib/services/` decoupled from HTTP headers. Enforce business invariants and orchestrate side effects.
- **Repositories (DAL):** Encapsulate all Mongoose queries and inject mandatory tenant and departmental scoping filters (`{ departmentId: session.departmentId }`).
- **Response Envelope:** Every mutation and API route returns the standard `ApiResponse<T>` envelope:
  `{ success: boolean, data: T | null, error: { code: string, message: string, details?: unknown } | null, timestamp: string }`.

---

## 4. Database Architecture Blueprint

- **Primary Database:** MongoDB Atlas (M10+ Dedicated Replica Set hosted in AWS Mumbai `ap-south-1`).
- **Data Collections:** 25 approved collections (15 MVP + 10 Later Releases).
- **Indexing Strategy:** All compound indexes strictly follow the **ESR Rule (Equality, Sort, Range)**, guaranteeing sub-50ms query execution with total index storage under 45MB.
- **Atomic Concurrency Controls:**
  - Weekly lecture timetable and room booking clashes prevented via compound unique indexes (`{ roomId: 1, termId: 1, dayOfWeek: 1, startTime: 1 }`).
  - Anonymous voting enforces single-vote integrity via `{ pollId: 1, voterHash: 1 }` unique constraint.
  - Multi-document operations (ticket approvals, audit logging) executed in Mongoose ACID transactions.

---

## 5. Authentication & Authorization Blueprint

- **Identity Provider:** Clerk (`@clerk/nextjs`).
- **Session Integrity:** Cryptographically signed, `HttpOnly`, `SameSite=Strict`, `Secure` session cookies.
- **Role Escalation Protection:** User roles (`student`, `faculty`, `admin`, `super_admin`) are stored exclusively in Clerk's server-only `publicMetadata` (write-only via `CLERK_SECRET_KEY`) and mirrored in MongoDB `users.role`. Frontend clients are physically incapable of altering their own privileges.
- **Multi-Factor Authentication:** Enforced TOTP authenticator app verification for all Admin and Super Admin accounts.

---

## 6. Real-Time Messaging & Broadcast Blueprint

- **Real-Time Broker:** Ably Realtime.
- **Architecture:** Decouples persistent client WebSockets from stateless Vercel Serverless compute. Clients connect directly to Ably edge endpoints; Next.js publishes statelessly over the Ably REST API.
- **Ephemeral Capability Tokens:** Clients request short-lived tokens via `/api/realtime/token`. Capabilities restrict subscriptions strictly to enrolled course channels (`course:CS301:chat`) and private user streams (`user:101:notifications`).
- **Campus Emergency Mode:** Broadcasts to `broadcast:global:emergency` command active screens in sub-100ms, triggering persistent full-screen alert modals and sirens.

---

## 7. Binary File Storage & Document Protection Blueprint

- **Provider:** Cloudinary.
- **Direct Upload Flow:** Clients upload binaries directly to Cloudinary using HMAC-SHA256 signed presets minted by `/api/storage/signature`, completely bypassing Vercel's 4.5MB serverless payload limit.
- **Privacy & Document Security:**
  - Public CDN delivery for user profile avatars.
  - **Private Asset Storage:** Student assignment submissions, bonafide application proofs, and medical slips stored as `private` assets.
  - **Time-Limited Signed URLs:** Delivered exclusively via **15-minute HMAC-signed URLs** generated after server-side authorization checks.

---

## 8. Deployment, Infrastructure & DPDP Compliance Blueprint

- **Hosting Platform:** Vercel Pro (Edge Network & Serverless Node.js LTS).
- **Production Domain:** `linkup.axiscolleges.in` with automated Let's Encrypt TLS 1.3 certificates.
- **Data Residency Compliance:** Database instances, database backups, and student PII reside exclusively within Indian borders (AWS Mumbai) in strict compliance with the **Digital Personal Data Protection (DPDP) Act, 2023**.
- **CI/CD Pipeline:** GitHub Actions automates TypeScript strict compilation, ESLint boundary checks, Vitest unit tests, and Playwright E2E suites before zero-downtime production deployment.

