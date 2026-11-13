# Final Technology Stack & Dependency Governance

> **Document ID:** DOC-APPR-003  
> **Status:** Final Approval Baseline (Phase 1, Part 1.7)  
> **Institution:** Axis Institute of Technology & Management  
> **Target Framework:** Next.js 15+ with React 19  
> **Last Updated:** November 2026  

---

## 1. Master Technology Governance Table

Every technology evaluated throughout Phase 1 is classified into one of four definitive states:
- **APPROVED FOR MVP:** Finalized and verified for Phase 1 implementation.
- **PROPOSED FOR LATER PHASES:** Architecturally approved, scheduled for Phase 2 or Phase 3.
- **PENDING APPROVAL:** Requires institutional IT sign-off or credential provisioning before activation.
- **REJECTED:** Evaluated and deliberately excluded with explicit architectural justification.

| Layer / Domain | Technology | Status | Specific Architectural Purpose |
| :--- | :--- | :---: | :--- |
| **Frontend Framework** | **Next.js 15+ (App Router)** | **APPROVED FOR MVP** | Core full-stack framework (SSR, RSC, Server Actions, Edge Middleware). |
| **UI Library** | **React 19** | **APPROVED FOR MVP** | Modern component runtime supporting concurrent Actions and Server Components. |
| **Language** | **TypeScript 5+ (Strict)** | **APPROVED FOR MVP** | Static type checking, zero `any`, full-stack contract inference. |
| **CSS Framework** | **Tailwind CSS 3.4+ / 4** | **APPROVED FOR MVP** | Design token implementation, mobile responsiveness, zero CSS runtime. |
| **Component Primitives**| **shadcn/ui (Radix UI)** | **APPROVED FOR MVP** | Copy-in, headless accessible UI components (dialogs, menus, tables). |
| **Icons** | **Lucide React** | **APPROVED FOR MVP** | Accessible, lightweight SVG icon system. |
| **Form State** | **React Hook Form + Resolvers**| **APPROVED FOR MVP** | Performant, un-opinionated form state management. |
| **Runtime Validation** | **Zod 3.23+** | **APPROVED FOR MVP** | Single source of truth for runtime input parsing and static type inference. |
| **Database Engine** | **MongoDB Atlas (AWS Mumbai)** | **PENDING IT PROVISION** | Managed document database replica set; DPDP Act Indian data residency. |
| **ODM / DAL** | **Mongoose 8+** | **APPROVED FOR MVP** | Schema validation, compound index definitions, repository query DAL. |
| **Identity & Auth** | **Clerk (`@clerk/nextjs`)** | **PENDING IT PROVISION** | Managed auth, TOTP MFA for admins, session cookies, edge verification. |
| **Real-Time Broker** | **Ably Realtime** | **PENDING IT PROVISION** | External WebSocket broker decoupling stateful connections from serverless. |
| **File Storage & CDN** | **Cloudinary** | **PENDING IT PROVISION** | Direct client-to-cloud signed uploads; 15-minute private signed URLs. |
| **Transactional Email** | **Resend** | **PENDING DNS SETUP** | Transactional emails (invites, tickets, urgent bulletins) via React Email. |
| **Unit Testing** | **Vitest** | **APPROVED FOR MVP** | Native ESM/TypeScript unit and integration test runner. |
| **E2E Testing** | **Playwright** | **APPROVED FOR MVP** | Multi-browser cross-role user journey automation (Chromium, Firefox, WebKit). |
| **Hosting & Ingress** | **Vercel Pro** | **PENDING IT PROVISION** | Edge Network, Edge Middleware, serverless compute, atomic deployments. |
| **Version Control** | **GitHub Enterprise / Team** | **APPROVED FOR MVP** | Git source control, peer reviews, automated CI/CD quality gates. |
| **Client Cache** | **TanStack Query v5** | **PROPOSED (PHASE 2)** | Client-side caching and polling deferred until advanced interactive dashboards. |
| **Background Push** | **Firebase Cloud Messaging** | **PROPOSED (PHASE 2)** | Web Push background alerts when application tabs are closed. |
| **Background Queues** | **Upstash Redis + BullMQ** | **PROPOSED (PHASE 3)** | Heavy asynchronous background worker jobs (bulk CSV imports, PDF generation). |
| **Alternative Auth** | **NextAuth / Auth.js** | **REJECTED** | Lacks turnkey TOTP MFA; complex Mongoose serverless adapter issues. |
| **Self-Hosted Realtime**| **Socket.io + Redis VM** | **REJECTED** | Incompatible with serverless Vercel; high VM clustering and DevOps burden. |
| **Relational Database** | **PostgreSQL + Prisma** | **REJECTED** | Rigid schema migrations; poor fit for polymorphic request forms (`service_requests`). |

---

## 2. Production Package Manifest Summary

```json
{
  "name": "axis-linkup",
  "version": "1.0.0-mvp",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "^15.0.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@clerk/nextjs": "^6.3.0",
    "mongoose": "^8.8.1",
    "zod": "^3.23.8",
    "ably": "^2.4.0",
    "cloudinary": "^2.5.1",
    "resend": "^4.0.1",
    "@react-email/components": "^0.0.28",
    "lucide-react": "^0.460.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.2",
    "react-hook-form": "^7.53.2",
    "@hookform/resolvers": "^3.9.1",
    "svix": "^1.40.0",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^3.4.15",
    "postcss": "^8.4.49",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.14.0",
    "eslint-config-next": "^15.0.3",
    "prettier": "^3.3.3",
    "prettier-plugin-tailwindcss": "^0.6.8",
    "vitest": "^2.1.5",
    "@playwright/test": "^1.48.2"
  }
}
```

---

## 3. Justification for Rejected Technologies

1. **PostgreSQL & Prisma:** While initially considered in Phase 1.1 requirements, PostgreSQL was rejected during Phase 1.2 and 1.4 architectural design. The Student Request Tracker (MOD-13) requires handling disparate, dynamic form structures across multiple administrative desks (Bonafide, Leave slips, Lab access, Fee dues) without complex relational schema migrations. MongoDB’s document model accommodates dynamic form schemas effortlessly while supporting multi-document ACID transactions.
2. **NextAuth / Auth.js:** Rejected because it lacks turnkey TOTP Multi-Factor Authentication (mandatory for Admin/Super Admin roles), requires complex custom adapter code to maintain Mongoose connections across serverless cold starts, and introduces high maintenance overhead compared to Clerk.
3. **Self-Hosted Socket.io on Virtual Machines:** Rejected because Vercel serverless compute cannot maintain long-lived stateful WebSocket connections. Running a dedicated VM cluster for Socket.io introduces a single point of failure and high DevOps maintenance for the college IT staff. Ably manages WebSocket persistence with a guaranteed 99.999% SLA.

