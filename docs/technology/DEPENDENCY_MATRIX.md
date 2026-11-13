# Dependency Matrix & Integration Compatibility Specification

> **Document ID:** DOC-TECH-003  
> **Status:** Evaluated & Verified (Phase 1, Part 1.3)  
> **Institution:** Axis Institute of Technology & Management  
> **Target Framework:** Next.js 15+ with React 19  
> **Last Updated:** November 2026  

---

## 1. Production & Development Package Manifest

The dependency matrix below details all approved packages for **Axis LinkUp Phase 1 (MVP)**, their license, bundle impact, and architectural purpose. Redundant or unapproved dependencies are excluded.

### 1.1 Core Production Dependencies (`dependencies`)

| Package Name | Proposed Version | License | Bundle Impact | Classification | Architectural Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `next` | `^15.0.0` | MIT | Framework Core | **Approved for MVP** | Full-stack React framework (SSR, RSC, Server Actions, Middleware). |
| `react` | `^19.0.0` | MIT | Framework Core | **Approved for MVP** | Modern UI rendering runtime with concurrent Actions support. |
| `react-dom` | `^19.0.0` | MIT | Framework Core | **Approved for MVP** | DOM bindings for React 19. |
| `@clerk/nextjs` | `^6.0.0` | MIT | Moderate (Client components) | **Approved for MVP** | Turnkey authentication, session cookies, TOTP MFA, Edge Middleware. |
| `mongoose` | `^8.8.0` | MIT | Server Only (0 KB Client) | **Approved for MVP** | MongoDB Object Data Modeling, schema validation, connection pooling. |
| `zod` | `^3.23.8` | MIT | Light (~12 KB) | **Approved for MVP** | Runtime input validation for forms, APIs, and environment variables. |
| `ably` | `^2.4.0` | Apache-2.0 | Light (~25 KB) | **Approved for MVP** | Managed WebSocket real-time pub/sub, presence, and emergency broadcast. |
| `cloudinary` | `^2.5.0` | MIT | Server Only (0 KB Client) | **Approved for MVP** | Server-side signature generation and private asset URL creation. |
| `resend` | `^4.0.0` | MIT | Server Only (0 KB Client) | **Approved for MVP** | Transactional email delivery API client. |
| `@react-email/components` | `^0.0.28` | MIT | Server Only (0 KB Client) | **Approved for MVP** | Type-safe React email template authoring. |
| `lucide-react` | `^0.460.0` | ISC | Tree-shakable (Light) | **Approved for MVP** | Comprehensive, accessible SVG icons for navigation and dashboards. |
| `clsx` | `^2.1.1` | MIT | Negligible (<1 KB) | **Approved for MVP** | Conditional CSS class constructor. |
| `tailwind-merge` | `^2.5.4` | MIT | Light (~5 KB) | **Approved for MVP** | Merges Tailwind classes without style conflicts in component overrides. |
| `@radix-ui/react-dialog` | `^1.1.2` | MIT | Light (~10 KB) | **Approved for MVP** | Accessible modal dialog primitive (shadcn/ui base). |
| `@radix-ui/react-dropdown-menu` | `^2.1.2` | MIT | Light (~12 KB) | **Approved for MVP** | Accessible menu and navigation popover primitive. |
| `@radix-ui/react-tabs` | `^1.1.1` | MIT | Light (~6 KB) | **Approved for MVP** | Accessible tabbed interface primitive. |
| `@radix-ui/react-toast` | `^1.2.2` | MIT | Light (~8 KB) | **Approved for MVP** | Accessible notification toast primitive. |
| `react-hook-form` | `^7.53.2` | MIT | Light (~9 KB) | **Approved for MVP** | Performant, un-opinionated form state management. |
| `@hookform/resolvers` | `^3.9.1` | MIT | Light (~3 KB) | **Approved for MVP** | Bridges Zod validation schemas into React Hook Form. |
| `svix` | `^1.40.0` | Apache-2.0 | Server Only (0 KB Client) | **Approved for MVP** | Cryptographic webhook signature verification (Clerk webhooks). |
| `date-fns` | `^4.1.0` | MIT | Tree-shakable (Light) | **Approved for MVP** | Immutable date formatting and manipulation for timetables and deadlines. |

### 1.2 Development & Tooling Dependencies (`devDependencies`)

| Package Name | Proposed Version | License | Classification | Tooling Role |
| :--- | :--- | :--- | :--- | :--- |
| `typescript` | `^5.6.3` | Apache-2.0 | **Approved for MVP** | Strict static type checking across client and server. |
| `@types/node` | `^22.9.0` | MIT | **Approved for MVP** | Node.js runtime type declarations. |
| `@types/react` | `^19.0.0` | MIT | **Approved for MVP** | React 19 type declarations. |
| `@types/react-dom` | `^19.0.0` | MIT | **Approved for MVP** | React DOM type declarations. |
| `tailwindcss` | `^3.4.15` | MIT | **Approved for MVP** | Utility CSS build engine and JIT compiler. |
| `postcss` | `^8.4.49` | MIT | **Approved for MVP** | CSS post-processing pipeline. |
| `autoprefixer` | `^10.4.20` | MIT | **Approved for MVP** | Vendor prefix injection for cross-browser CSS compatibility. |
| `eslint` | `^9.14.0` | MIT | **Approved for MVP** | Static JavaScript/TypeScript code linter. |
| `eslint-config-next` | `^15.0.0` | MIT | **Approved for MVP** | Next.js recommended ESLint rule set. |
| `prettier` | `^3.3.3` | MIT | **Approved for MVP** | Code formatting enforcement. |
| `prettier-plugin-tailwindcss` | `^0.6.8` | MIT | **Approved for MVP** | Automatic class sorting for Tailwind CSS. |
| `vitest` | `^2.1.5` | MIT | **Approved for MVP** | Native ESM/TypeScript unit and integration test runner. |
| `@playwright/test` | `^1.48.2` | Apache-2.0 | **Approved for MVP** | Multi-browser end-to-end integration and security test runner. |

### 1.3 Scheduled for Phase 2 / Later Phases (Excluded from Initial `package.json`)

| Package / Technology | Targeted Phase | Rationale for Deferral |
| :--- | :--- | :--- |
| `@tanstack/react-query` | Phase 2 (Version 2.0) | MVP relies on React Server Components and Server Actions; avoiding duplicate client caches. |
| `firebase-admin` / `firebase` | Phase 2 (Version 2.0) | Background Web Push deferred until after core in-app and email notifications are stable. |
| `bullmq` / `ioredis` | Phase 3 (Advanced) | Heavy asynchronous queue deferred; MVP operations fit within serverless execution bounds. |

---

## 2. Integration Compatibility Matrix

### 2.1 Next.js 15 & React 19 Compatibility
- **Status:** **Fully Compatible.**
- **Evaluation:** Next.js 15 natively supports React 19 (Server Components, Actions, `useActionState`, asset loading).
- **Watchpoint:** Ensure all third-party UI dependencies explicitly support React 19 peer dependencies. Radix UI primitives and Lucide icons have verified React 19 compatibility.

### 2.2 Next.js & Clerk (`@clerk/nextjs`)
- **Status:** **Fully Compatible.**
- **Evaluation:** Clerk provides first-class support for Next.js App Router and Edge Middleware via `clerkMiddleware()`. Session tokens (`__session`) are decrypted at the edge without database calls.
- **Watchpoint:** Role assignments must be stored strictly in `publicMetadata` to allow edge reading while preventing client-side tampering.

### 2.3 Next.js Serverless Runtime & Mongoose
- **Status:** **Compatible with Required Architectural Pattern.**
- **Evaluation:** In a serverless environment (Vercel), functions spin down after execution. Creating new Mongoose connections on every invocation causes connection pool exhaustion on MongoDB Atlas.
- **Mandatory Pattern:** Mongoose connection caching via a global singleton (`global.mongooseCache`) with `bufferCommands: false` and `maxPoolSize: 10`. Verified in `BACKEND_ARCHITECTURE.md`.

### 2.4 Next.js & Ably Realtime
- **Status:** **Fully Compatible via External Broker Pattern.**
- **Evaluation:** Next.js serverless functions cannot maintain persistent WebSockets. Ably solves this:
  - *Browser Client:* Connects to Ably's global edge via persistent WebSocket.
  - *Next.js Serverless:* Interacts statelessly via Ably REST API (`ably.rest`) to publish events and mint ephemeral token capabilities.
- **Watchpoint:** Never instantiate the stateful `ably.realtime` client inside Next.js Server Actions or Route Handlers; always use `ably.rest` on the server.

### 2.5 Next.js & Cloudinary
- **Status:** **Fully Compatible via Direct Upload Pattern.**
- **Evaluation:** Vercel serverless functions have a 4.5MB request body limit. Routing 25MB assignment PDFs or 50MB lecture slides through Next.js API routes will fail.
- **Mandatory Pattern:** Next.js Server mints HMAC-SHA256 signed upload presets via `/api/storage/signature`. The client browser uploads binary data directly to Cloudinary edge nodes. The server only receives the resulting metadata (`public_id`, URL, file size).

### 2.6 Firebase Cloud Messaging (FCM) & Browser Applications
- **Status:** **Compatible with Browser Limitations (Phase 2).**
- **Evaluation:** FCM requires a service worker registered at the root (`/firebase-messaging-sw.js`) and a valid VAPID key pair.
- **Deployment Limitations:**
  - *Desktop Chrome/Edge/Firefox & Android:* Full background push support.
  - *Apple iOS / Safari:* Web Push requires iOS 16.4+ and mandates that the user has explicitly added the Axis LinkUp PWA to their home screen. For MVP, transactional emails (Resend) and in-app alerts ensure 100% receipt across all iOS users.

### 2.7 Next.js & Resend
- **Status:** **Fully Compatible.**
- **Evaluation:** Resend provides a lightweight REST API client designed specifically for serverless and Edge runtimes. Paired with `@react-email/components`, email templates are authored as type-safe React components.
- **Watchpoint:** Production delivery requires verified SPF, DKIM, and DMARC DNS records configured on the institutional domain (`axiscolleges.in`).

### 2.8 Vercel Serverless & Real-Time Infrastructure
- **Status:** **Architecturally Harmonized.**
- **Evaluation:** Vercel is optimized for stateless request-response compute and static edge caching. Real-time state is fully offloaded to Ably, completely bypassing serverless execution limits.

---

## 3. Deployment-Specific Limitations & Mitigations

| Platform Limitation | Impact on Axis LinkUp | Architectural Mitigation |
| :--- | :--- | :--- |
| **Vercel 4.5MB Serverless Payload Limit** | Students cannot upload large assignment PDFs (up to 25MB) through standard API routes. | **Direct-to-Cloudinary Upload:** Client uploads directly to Cloudinary using server-signed presets; server never processes raw binary streams. |
| **Vercel Serverless Function Timeout (10s–15s)** | Long-running queries or bulk operations could time out. | **Lean Queries & Background Deferral:** Optimize MongoDB queries with compound indexes (`<50ms`); defer heavy bulk imports to chunked operations or Phase 3 queues. |
| **MongoDB Atlas Connection Pool Limits** | Serverless cold starts could spawn hundreds of concurrent unpooled database connections. | **Mongoose Singleton Pattern:** Cache connection globally across warm lambdas; cap `maxPoolSize: 10` per lambda instance. |
| **Campus Proxy / Firewall WebSocket Blocking** | Restrictive college network firewalls might block `wss://` connections. | **Ably Automatic Protocol Fallback:** Ably automatically degrades to HTTP long-polling if WebSockets fail, maintaining message delivery. |
| **Apple iOS Web Push Restrictions** | iOS users who haven't saved PWA to home screen cannot receive native background push. | **Dual-Channel MVP Delivery:** In-app notification bell (MOD-17) + high-priority transactional emails (Resend) guarantee delivery. |

