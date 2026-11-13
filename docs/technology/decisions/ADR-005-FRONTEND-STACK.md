# Architecture Decision Record (ADR)
## ADR-005: Frontend Technology Stack — Next.js App Router, React 19, Tailwind CSS & shadcn/ui

> **Status:** Proposed / Under Review (Recommendation)  
> **Date:** November 2026  
> **Deciders:** Senior Full-Stack Architect, Frontend Lead  
> **Target System:** Axis LinkUp Frontend Core  

---

## 1. Context & Problem Statement

Axis LinkUp serves four distinct user roles with fundamentally divergent UX requirements:
- **Students:** Mobile-first, fast-loading, low-bandwidth consumption on campus Wi-Fi, responsive bottom-nav interface.
- **Faculty:** Balanced tablet and desktop views for grading queues and course management.
- **Administrators & Super Admins:** High-density desktop data tables, multi-filter ticket queues, and persistent status docks.

We must select a frontend stack that delivers sub-second page loads (NFR-PERF-01), accessible UI controls (WCAG 2.1 AA / NFR-ACC-01), zero bundle bloat, and rapid development velocity.

---

## 2. Decision Drivers

- **First Contentful Paint (FCP) Performance:** Sub-1.8s page load on 4G mobile devices requires server-rendered initial HTML markup.
- **Accessibility Standards:** Full keyboard navigation, ARIA tagging, and high-contrast color ratios across all interactive dialogs, menus, and forms.
- **Responsive Layout Velocity:** Unified styling system capable of adapting from 360px smartphones to 1440px+ administrative desktops.
- **Maintainability & Bundle Size:** Avoid heavy, opinionated component libraries that ship megabytes of unused JavaScript to mobile clients.

---

## 3. Options Considered

### Option 1: Client-Side Single Page Application (Vite + React SPA)
- Standard client-rendered SPA.
- **Pros:** Simple mental model, client-only build.
- **Cons:** Empty initial HTML payload requires multi-second JavaScript download before rendering (violates FCP targets on mobile); lacks edge middleware for instantaneous role routing; requires separate backend API endpoints for everything.

### Option 2: Next.js App Router + React 19 + Tailwind CSS + shadcn/ui (Recommended)
- Hybrid full-stack framework with React Server Components (RSC), utility-first Tailwind CSS, and headless Radix UI primitives.
- **Pros:**
  - Server Components stream rendered HTML instantly to mobile browsers with zero client-side JavaScript for static content.
  - Server Actions handle form mutations with end-to-end type safety.
  - `shadcn/ui` components are copied directly into the codebase, giving full control over markup, styles, and accessibility without heavy `node_modules` dependencies.
  - Tailwind CSS Purge/JIT engine ships only the exact utility classes used.
- **Cons:** Learning curve for developers transitioning to React 19 Server/Client component boundaries.

### Option 3: Next.js + Material UI (MUI)
- Next.js paired with Google Material Design components.
- **Pros:** Pre-built complex enterprise components.
- **Cons:** Heavy runtime CSS-in-JS emotion engine; incompatible with React Server Components without `"use client"` wrappers on every page; high bundle weight; rigid aesthetic difficult to customize.

---

## 4. Proposed Decision

**Adopt Option 2: Next.js 15+ (App Router) with React 19, Tailwind CSS, and shadcn/ui (Radix UI primitives).**

The frontend will default to Server Components for all data displays and layouts, using Client Components strictly for interactive leaves (forms, modals, chat subscribers).

---

## 5. Advantages & Positive Consequences

1. **Sub-Second Mobile FCP:** Server-rendered markup streams immediately over campus mobile networks.
2. **Accessible by Default:** Radix primitives satisfy all WCAG 2.1 AA keyboard and screen reader mandates.
3. **Zero Styling Runtime Overhead:** Tailwind compiles down to pure static CSS with zero runtime style calculations.
4. **Complete Code Ownership:** `shadcn/ui` files live in `src/components/ui/`, allowing custom institutional styling modifications without breaking upstream dependencies.

---

## 6. Disadvantages & Negative Consequences

1. **Component Boundary Vigilance:** Developers must maintain discipline regarding `"use client"` directives to prevent accidental hydration of heavy server libraries into client bundles.

---

## 7. Mitigation Strategies & Future Considerations

- **ESLint Boundary Rules:** Configure ESLint to prevent importing server modules inside client components.
- **Design Token System:** Lock down Axis Institute brand colors and typography in `tailwind.config.ts` to ensure visual harmony across Student, Faculty, and Admin layouts.

