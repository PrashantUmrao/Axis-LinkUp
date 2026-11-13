# Architecture Decision Record (ADR)
## ADR-008: Deployment & Hosting Infrastructure — Vercel & Managed Cloud Services

> **Status:** Proposed / Under Review (Recommendation)  
> **Date:** November 2026  
> **Deciders:** Senior Full-Stack Architect, DevOps Lead  
> **Target System:** Axis LinkUp Production Infrastructure & CI/CD Pipeline  

---

## 1. Context & Problem Statement

Axis LinkUp requires an infrastructure and hosting architecture that supports:
- Automatic zero-downtime deployments.
- Sub-second edge delivery across mobile and desktop devices.
- Continuous automated integration testing (CI/CD).
- Strict adherence to the Indian Digital Personal Data Protection (DPDP) Act, 2023, requiring Indian cloud data residency for student and institutional data.
- Low operational maintenance burden for the campus IT staff.

---

## 2. Decision Drivers

- **Zero DevOps Maintenance:** The institution lacks a 24/7 dedicated site reliability engineering (SRE) team; self-managing Kubernetes clusters introduces severe operational vulnerability.
- **Data Residency Compliance:** Database must physically reside within Indian territory (AWS Mumbai `ap-south-1`).
- **Edge Routing & Next.js Synergy:** Vercel provides native edge middleware execution for sub-10ms JWT authentication and role redirection.
- **Budget Predictability:** Generous free and developer tiers allow cost-effective MVP validation before scaling to institutional production tiers.

---

## 3. Options Considered

### Option 1: Self-Hosted Infrastructure on Campus Physical Servers
- Deploy Docker containers on physical servers in the college server room.
- **Pros:** 100% on-premise data residency; zero recurring cloud subscription fees.
- **Cons:** High vulnerability to campus power outages, hardware failure, and cooling issues; requires manual UPS management; complex public DNS, static IP, and SSL renewal management; zero multi-region redundancy.

### Option 2: Traditional Cloud Virtual Machines (Single AWS EC2 / DigitalOcean Droplet)
- Single monolithic VM running Node.js, MongoDB, and Nginx.
- **Pros:** Simple setup; fixed monthly VPS cost.
- **Cons:** Single point of failure; requires manual OS security patching; manual SSL renewal; vertical scaling limits; requires manual backup scripting.

### Option 3: Modern Managed Cloud Ecosystem (Vercel + Atlas + Managed PaaS - Recommended)
- Application compute on Vercel; database on MongoDB Atlas (AWS Mumbai); identity on Clerk; media on Cloudinary; real-time on Ably.
- **Pros:**
  - Automated previews on every Git branch/PR.
  - Zero-downtime atomic production deployments on merge to `main`.
  - Guaranteed 99.9%+ availability with automated backups and disaster recovery.
  - Satisfies DPDP Act data residency via dedicated AWS Mumbai cluster.
  - Offloads security, patching, and scaling to certified enterprise cloud providers.
- **Cons:** Multi-vendor management requires coordinating accounts and monitoring vendor status dashboards.

---

## 4. Proposed Decision

**Adopt Option 3: Modern Managed Cloud Ecosystem featuring Vercel for application compute, MongoDB Atlas (Mumbai) for persistence, and specialized PaaS providers for identity, real-time, and media storage.**

---

## 5. Advantages & Positive Consequences

1. **Sub-Second Global Edge Delivery:** Vercel Edge Network caches static assets and executes edge middleware in `<10ms`.
2. **Ironclad Legal Compliance:** MongoDB Atlas cluster hosted in AWS Mumbai (`ap-south-1`) guarantees all student records, grades, and logs reside on Indian soil.
3. **Automated CI/CD:** GitHub Actions executes linting, TypeScript compilation, and Vitest/Playwright tests on every PR prior to deployment.
4. **Resilience to Campus Outages:** Even if the college campus loses power or internet connectivity, the cloud-hosted platform remains 100% accessible to students studying from home.

---

## 6. Disadvantages & Negative Consequences

1. **Vendor Coordination:** Requires managing billing and API keys across five managed cloud platforms (Vercel, Atlas, Clerk, Ably, Cloudinary).

---

## 7. Mitigation Strategies & Future Considerations

- **Unified Billing & Enterprise Accounts:** Institutional accounts will be registered under an institutional IT email (`it-admin@axiscolleges.in`) with centralized corporate payment methods.
- **Fallback Architecture:** Every external service is accessed via an internal abstraction service class (`lib/services/*`), ensuring that if any vendor needs to be swapped in future years, application code remains completely protected.

