# Next.js App Router Architecture (`src/app/`)

This directory houses the route definitions, route groups, nested layouts, loading states, error boundaries, and API route handlers for **Axis LinkUp**.

## 1. Route Groups & Role Spaces

Route groups (folders wrapped in parentheses) isolate layouts and role-based middleware contexts without altering the public URL path:

| Route Group         | Role / Domain         | Layout Responsibility                                                       | Sample Public URL                              |
| :------------------ | :-------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------- |
| **`(auth)`**        | Public Authentication | Minimal centered card layout with institutional branding                    | `/sign-in`, `/sign-up`                         |
| **`(student)`**     | Students              | Mobile-first shell: fixed bottom nav, mobile header, emergency alert banner | `/student/dashboard`, `/student/notices`       |
| **`(faculty)`**     | Faculty Members       | Evaluation cockpit: collapsible left sidebar, course switcher               | `/faculty/dashboard`, `/faculty/classes`       |
| **`(admin)`**       | Department Admins     | High-density desktop sidebar with ticket queues & SLA counters              | `/admin/dashboard`, `/admin/requests`          |
| **`(super-admin)`** | Executive / IT Leads  | High-security system console, RBAC matrix, and emergency trigger dock       | `/super-admin/dashboard`, `/super-admin/users` |
| **`(shared)`**      | Cross-Role Utilities  | Universal views: user profile, settings, public emergency broadcast         | `/profile`, `/emergency/view`                  |

## 2. Ingress & Handlers

- **`actions/`**: Next.js Server Actions (`'use server'`). Handles mutations, verifies session claims via `requireAuth`/`requireRole`, validates inputs against Zod schemas, and delegates to domain services.
- **`api/`**: Next.js Route Handlers (`route.ts`). Strictly reserved for external webhooks (Clerk, Cloudinary) and stateless capability endpoints (Ably token minting, Cloudinary upload signatures).
- **`ui-preview/`**: Isolated development playground to visually inspect design tokens and shadcn primitives. (Decommission before production release).

## 3. Strict Boundary Rules

1. **Zero Raw Queries:** `page.tsx` files and Route Handlers must never import Mongoose models or execute direct database queries. Always delegate to domain services or repositories.
2. **Thin Presentation:** Page components should act solely as data loaders and layout containers, rendering UI components from `src/features/*` and `src/components/*`.
