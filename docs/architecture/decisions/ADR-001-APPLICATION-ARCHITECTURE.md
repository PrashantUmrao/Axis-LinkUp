# Architecture Decision Record (ADR)
## ADR-001: Application Architecture — Modular Monolith on Next.js

> **Status:** Proposed / Under Review (Recommendation)  
> **Date:** November 2026  
> **Deciders:** Senior Software Architect, Engineering Lead  
> **Target System:** Axis LinkUp Platform Core  

---

## 1. Context & Problem Statement

Axis LinkUp serves Axis Institute of Technology & Management across four distinct roles (Student, Faculty, Admin, Super Admin) and 19 functional modules spanning communication, academics, administration, and campus facilities. The projected user base is 3,000 to 5,000 active users, with burst events during exam timetable releases, assignment deadlines, and emergency alerts.

We must select an overall system architecture that balances development velocity, deployment simplicity, system performance, operational maintenance overhead, and future scalability.

---

## 2. Decision Drivers

- **Team Sizing & Operational Simplicity:** The project team requires rapid feature delivery without the high overhead of managing distributed microservice infrastructure (Kubernetes, service meshes, distributed tracing).
- **Sub-Second Performance (NFR-PERF-01, NFR-PERF-02):** Eliminate inter-service network hops and serialized JSON marshaling between services.
- **Transactional Integrity:** Operations like service request resolution and emergency mode activation require atomic updates across audit logs and notifications.
- **Maintainability & Strong Typing (NFR-MAINT-01):** End-to-end TypeScript sharing from database models to frontend components.

---

## 3. Options Considered

### Option 1: Microservices Architecture
- Separate independently deployable services: Auth Service, Academics Service, Notices Service, Request Service, Chat Service.
- **Pros:** Independent service scaling, isolated failure domains.
- **Cons:** Extreme operational complexity, distributed data consistency issues (2PC / Saga patterns), latency between microservice network hops, high cloud hosting costs for 3,000–5,000 campus users.

### Option 2: Traditional Unstructured Monolith
- Single monolithic Express/Node.js or Django app with tight cross-module coupling.
- **Pros:** Fast initial prototype.
- **Cons:** Rapidly degrades into "spaghetti code", high risk of circular dependencies, difficult to test or partition work across developers.

### Option 3: Modular Monolith on Next.js App Router (Recommended)
- Single repository and deployment unit, organized strictly into isolated domain modules (`lib/services/*`, `lib/db/repositories/*`, route groups) communicating through well-defined internal interfaces.
- **Pros:** Zero network latency between domains, unified CI/CD, shared TypeScript types, simple local setup, and clear domain boundaries that allow future microservice extraction if needed.
- **Cons:** Entire application is deployed together; a build break in one module can temporarily block deployment of others.

---

## 4. Proposed Decision

**Adopt Option 3: Modular Monolith on Next.js App Router.**

The application will be deployed as a unified Next.js application, utilizing React Server Components for performance, Server Actions for mutations, and domain services strictly isolated into discrete modules with zero cross-domain private leakage.

---

## 5. Advantages & Positive Consequences

1. **Maximum Velocity:** Engineers work within a single codebase with shared domain types, unified testing harnesses, and immediate feedback.
2. **Zero Inter-Service Latency:** Domain service calls are in-process function executions, easily meeting the `<200ms` API response target.
3. **Atomic Deployments:** Schema migrations and code deployments occur in lockstep, eliminating backward-compatibility version skew.
4. **Lowest Operational Cost:** Eliminates multi-cluster Kubernetes infrastructure, service discovery tools, and API gateway licensing fees.

---

## 6. Disadvantages & Negative Consequences

1. **Coupled Deployment Lifecycle:** A critical bug blocking the main build pipeline prevents deploying updates to other modules until resolved.
2. **Discipline Required:** Requires strict code reviews and linting boundaries to prevent engineers from bypassing domain service contracts or importing private repository queries across modules.

---

## 7. Mitigation Strategies & Future Considerations

- **Boundary Enforcement:** Enforce ESLint import boundary rules (`eslint-plugin-boundaries`) to mechanically prevent Module A from importing internal components of Module B.
- **Future Extraction Path:** Because each module encapsulates its own data access layer and service contracts, high-throughput modules (e.g., Real-Time Chat or File Transcoding) can be decoupled into standalone microservices in Phase 3 without rewriting business logic.

