# Final Technology Stack Specification

> **Document ID:** DOC-TECH-001  
> **Status:** Proposed & Evaluated (Phase 1, Part 1.3)  
> **Institution:** Axis Institute of Technology & Management  
> **Architecture Alignment:** Modular Monolith on Next.js  
> **Last Updated:** November 2026  

---

## 1. Executive Summary & Stack Philosophy

The technology stack for **Axis LinkUp** has been selected to deliver an enterprise-grade, high-performance, and secure digital platform for Axis Institute of Technology & Management. 

The stack strictly aligns with the **Modular Monolith** architecture documented in Phase 1, Part 1.2. It emphasizes:
- **TypeScript End-to-End:** Shared data types, interfaces, and validation schemas from database models to frontend UI components.
- **Serverless-First Operations:** Zero server patching, automated elastic scaling, and managed infrastructure.
- **Data Residency Compliance:** Strict hosting in India (AWS Mumbai `ap-south-1`) to comply with the Indian Digital Personal Data Protection (DPDP) Act, 2023.
- **Lean Dependency Footprint:** Rejection of redundant libraries, ensuring fast build times and minimal runtime bundle overhead.

---

## 2. Technology Classification & Lifecycle Status

Each evaluated technology is classified into one of four governance states:

1. **Approved for MVP:** Essential for the Phase 1 MVP release; verified for integration compatibility and security.
2. **Approved for Later Phases:** Confirmed as the chosen technology, but scheduled for activation in Version 2.0 (Phase 2) or Version 3.0 (Phase 3) to prevent premature complexity.
3. **Optional / Under Evaluation:** Usable if specific niche requirements emerge; not in the critical path.
4. **Rejected:** Evaluated and deliberately excluded due to architectural conflict, redundancy, or excessive operational overhead.

### 2.1 Master Technology Status Table

| Layer / Domain | Technology | Version / Target | Governance Classification | Primary Architectural Role |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Framework** | **Next.js** | `15.x+` (App Router) | **Approved for MVP** | Full-stack React framework (RSC, Server Actions, SSR, Routing). |
| **UI Library** | **React** | `19.x` | **Approved for MVP** | Core component runtime and concurrent rendering engine. |
| **Language** | **TypeScript** | `5.x` (Strict Mode) | **Approved for MVP** | Strict static typing, schema inference, and contract safety. |
| **Styling** | **Tailwind CSS** | `3.4.x` / `4.x` | **Approved for MVP** | Utility-first CSS engine, design token enforcement, dark mode. |
| **Component System** | **shadcn/ui** | Radix UI Primitives | **Approved for MVP** | Accessible, copy-in, unstyled headless UI component primitives. |
| **Client State / Cache**| **TanStack Query** | `v5.x` | **Approved for Later Phases (V2)** | Client-side cache for high-frequency polling/dashboards; MVP relies on RSC + Server Actions. |
| **Validation** | **Zod** | `3.23.x+` | **Approved for MVP** | Schema validation for forms, API payloads, and environment variables. |
| **Database Engine** | **MongoDB Atlas** | `7.0+` (AWS Mumbai) | **Approved for MVP** | Managed NoSQL document database (ACID replica set, DPDP compliance). |
| **Object Data Mapper** | **Mongoose** | `8.x` | **Approved for MVP** | Strict schema validation, connection pooling, and repository DAL. |
| **Identity & Auth** | **Clerk** | `@clerk/nextjs` | **Approved for MVP** | Managed authentication, session cookies, TOTP MFA, edge middleware. |
| **Real-Time Broker** | **Ably Realtime** | `ably` v2.x | **Approved for MVP (Basic)** | Stateful WebSocket broker for live notices, chat, and emergency alerts. |
| **Binary File Storage** | **Cloudinary** | `cloudinary` v2.x | **Approved for MVP** | Direct-to-cloud signed uploads for avatars, PDFs, assignments. |
| **Transactional Email** | **Resend** | `resend` v3.x | **Approved for MVP** | Transactional email delivery (invites, tickets, urgent bulletins). |
| **Background Push** | **Firebase Cloud Messaging**| `firebase-admin` | **Approved for Later Phases (V2)** | Background Web Push when application tabs are closed. |
| **Unit Testing** | **Vitest** | `1.x+` | **Approved for MVP** | Fast unit and integration testing engine. |
| **End-to-End Testing** | **Playwright** | `1.4x+` | **Approved for MVP** | Multi-role browser automation and security regression testing. |
| **Hosting & Ingress** | **Vercel** | Edge Network | **Approved for MVP** | Serverless Next.js hosting, Edge Middleware, SSL/TLS, CDN. |
| **Version Control** | **GitHub** | Enterprise / Team | **Approved for MVP** | Git source control, code reviews, automated CI/CD actions. |
| **Queue / Worker** | **Redis (Upstash) + BullMQ**| `bullmq` v5.x | **Approved for Later Phases (V2/V3)**| Heavy asynchronous background jobs (bulk email blast, PDF stamping). |
| **Alternative Auth** | **NextAuth / Auth.js**| — | **Rejected** | Rejected due to complex Mongoose serverless adapters and lack of turnkey MFA. |
| **Self-Hosted WS** | **Socket.io + Redis VM**| — | **Rejected for MVP** | Rejected due to serverless incompatibility and high VM maintenance overhead. |

---

## 3. Layer-by-Layer Stack Specifications

### 3.1 Presentation & Frontend Layer
- **Core Runtime:** Next.js App Router with React 19.
- **Rendering Strategy:** Server Components (RSC) by default for fast initial page loads and direct database access; Client Components (`"use client"`) strictly reserved for interactive leaves (chat feeds, form inputs, dialogs).
- **Styling Architecture:** Tailwind CSS paired with `tailwind-merge` and `clsx` for dynamic styling. Design tokens define Axis Institute brand colors, typography, and dark mode contrasts.
- **Component Primitives:** `shadcn/ui` based on Radix UI primitives. Components reside directly in `src/components/ui/`, giving the engineering team 100% ownership of accessibility, markup, and styling without heavy node_modules dependencies.
- **Icons:** `lucide-react` (comprehensive, accessible SVG icon set).

### 3.2 Application & Business Logic Layer
- **Ingress Handlers:**
  - Next.js **Server Actions** for all authenticated mutations (ticket creation, notice publishing, assignment submission, voting).
  - Next.js **Route Handlers (`/api/*`)** for external integration webhooks (Clerk user sync, Cloudinary upload signatures, Ably token requests).
- **Validation Engine:** `zod` for parsing and verifying all data entering the system. Types are inferred directly from schemas (`z.infer<typeof Schema>`).
- **Domain Services:** Plain TypeScript classes in `src/lib/services/` that enforce business rules, invariants, and authorization policies without dependency on the HTTP transport layer.

### 3.3 Data & Persistence Layer
- **Primary Database:** MongoDB Atlas (M10+ Dedicated Cluster, 3-node replica set hosted in AWS Mumbai `ap-south-1`).
- **Data Access Layer:** Mongoose 8+ implementing the Repository Pattern. All queries pass through centralized repository classes (`UserRepository`, `NoticeRepository`, `RequestRepository`).
- **Connection Management:** Global singleton connection caching pattern to ensure safe connection reuse across serverless lambda invocations.

### 3.4 Identity & Access Control Layer
- **Provider:** Clerk Identity Platform (`@clerk/nextjs`).
- **Session Model:** Cryptographically signed, `HttpOnly`, `SameSite=Strict`, `Secure` session cookies.
- **Role Assignment:** Roles (`student`, `faculty`, `admin`, `super_admin`) stored in Clerk's server-only `publicMetadata` for sub-10ms Edge Middleware route protection and mirrored in MongoDB `users` collection.
- **MFA:** Enforced TOTP Multi-Factor Authentication for Admin and Super Admin accounts.

### 3.5 Real-Time Communication Layer
- **Broker:** Ably Realtime.
- **Protocol:** Stateful WebSockets with automatic fallback to HTTP Long-Polling.
- **Auth Pattern:** Ephemeral token request minting via `/api/realtime/token`. Capabilities restrict students to their enrolled course channels and personal notification streams.
- **Emergency Integration:** Dedicated `broadcast:global:emergency` channel capable of commanding active browser screens in sub-100ms.

### 3.6 Media & File Storage Layer
- **Provider:** Cloudinary.
- **Upload Flow:** Direct client-to-Cloudinary upload using server-minted HMAC-SHA256 signed presets, bypassing Vercel's 4.5MB serverless payload limit.
- **Security & Privacy:** Public CDN delivery for avatars; **Private delivery via 15-minute time-limited HMAC signed URLs** for student submissions, medical proofs, and confidential administrative records.

### 3.7 Messaging & Notification Layer
- **Email Delivery:** Resend (`resend` SDK) for transactional notifications (account activation, ticket status updates, critical bulletins).
- **Push Alerts (Phase 2):** Firebase Cloud Messaging (FCM) using Web Push API and service worker (`firebase-messaging-sw.js`) for notifications when the web app is closed.

### 3.8 Quality Assurance & Testing Layer
- **Unit & Integration:** Vitest (runs natively with ESM and TypeScript, executing tests in milliseconds).
- **End-to-End (E2E):** Playwright testing real browser interactions across Student, Faculty, and Admin personas.
- **Code Quality:** ESLint (`@typescript-eslint`), Prettier, and Husky Git pre-commit hooks.

