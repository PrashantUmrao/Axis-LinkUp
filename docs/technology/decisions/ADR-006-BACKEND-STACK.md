# Architecture Decision Record (ADR)
## ADR-006: Backend & Data Access Stack — Next.js Server Actions, Zod & Mongoose

> **Status:** Proposed / Under Review (Recommendation)  
> **Date:** November 2026  
> **Deciders:** Senior Full-Stack Architect, Backend Lead  
> **Target System:** Axis LinkUp Backend & Application Core  

---

## 1. Context & Problem Statement

Axis LinkUp requires an application backend that handles:
- Ingress from interactive forms across 19 modules (service requests, notices, assignments, votes).
- External webhooks from identity (Clerk), file storage (Cloudinary), and real-time providers (Ably).
- Strict runtime input validation to prevent SQL/NoSQL injection and cross-site scripting (XSS).
- Reliable database interaction with MongoDB Atlas within a serverless compute environment.

We must decide whether to deploy a separate standalone backend service (e.g., NestJS/Express) or utilize Next.js Server Actions and Route Handlers directly.

---

## 2. Decision Drivers

- **End-to-End Type Safety:** Eliminate manual API contract synchronization between frontend forms and backend handlers.
- **Serverless Performance:** Minimize cold-start overhead and prevent database connection pool exhaustion.
- **Architectural Simplicity:** Single deployment pipeline on Vercel without maintaining multiple cloud servers, CORS configurations, or separate repository branches.
- **Validation Rigor (NFR-SEC-04):** Guarantee that no unvalidated payload ever reaches business services or database queries.

---

## 3. Options Considered

### Option 1: Standalone Express / NestJS API Server
- Separate backend service hosted on AWS EC2 or DigitalOcean Droplets.
- **Pros:** Long-lived memory space; easy to run background workers and persistent WebSocket connections.
- **Cons:** High infrastructure maintenance overhead; requires configuring CORS, manual JWT verification middleware, separate CI/CD pipelines, and duplicated TypeScript types across repos.

### Option 2: GraphQL API (Apollo Server / Nexus)
- Single GraphQL endpoint for all queries and mutations.
- **Pros:** Precise field fetching; flexible client queries.
- **Cons:** Excessive complexity for an institutional platform; high setup overhead; complex caching in serverless environments; redundant when Server Components can query the database directly.

### Option 3: Next.js Server Actions & Route Handlers + Zod + Mongoose (Recommended)
- Unified backend running inside Next.js. Server Actions handle all form mutations; Route Handlers handle external webhooks; Zod validates inputs; Mongoose encapsulates MongoDB access.
- **Pros:**
  - Zero CORS configuration required.
  - Form mutations are type-safe RPC calls with built-in CSRF protection.
  - Server Components fetch directly from Mongoose repositories, eliminating internal HTTP latency.
  - Zod schemas generate both runtime validators and static TypeScript types simultaneously.
- **Cons:** Serverless execution limit requires careful connection pooling and prevents running continuous in-memory background cron jobs.

---

## 4. Proposed Decision

**Adopt Option 3: Next.js Server Actions and Route Handlers paired with Zod for validation and Mongoose for MongoDB data access.**

TanStack Query is **deferred to Phase 2** to avoid unnecessary client-side caching abstraction while Server Components handle MVP data fetching.

---

## 5. Advantages & Positive Consequences

1. **Massive Velocity Gain:** Full-stack developers can implement a complete feature (e.g., Student Bonafide Request) in a single unified TypeScript workflow.
2. **Deterministic Security:** Every Server Action validates payloads against Zod schemas and enforces role guards prior to invoking service logic.
3. **Optimized Serverless Database Access:** Mongoose singleton caching ensures database connections persist across warm serverless function executions.

---

## 6. Disadvantages & Negative Consequences

1. **Serverless Execution Window:** Long-running tasks (>15 seconds) cannot execute synchronously inside a Server Action and must be broken down into chunked operations or deferred to Phase 3 background workers.

---

## 7. Mitigation Strategies & Future Considerations

- **Strict Service Layer Decoupling:** Business logic is encapsulated in pure service classes (`src/lib/services/`). If a future requirement demands extracting a standalone microservice, the domain services can be relocated into a NestJS container with zero business logic rewrites.

