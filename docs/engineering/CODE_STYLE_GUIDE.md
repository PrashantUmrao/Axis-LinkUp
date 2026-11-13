# Code Style & Quality Standards Guide

> **Document ID:** DOC-ENG-002  
> **Status:** Approved Baseline (Phase 1, Part 1.6)  
> **Institution:** Axis Institute of Technology & Management  
> **Languages & Tools:** TypeScript 5+, React 19, ESLint 9+, Prettier 3+  
> **Last Updated:** November 2026  

---

## 1. TypeScript Standards & Compiler Integrity

### 1.1 Strict Compiler Configuration
All code written for Axis LinkUp must compile cleanly with zero errors under the strictest TypeScript compiler settings:

- `"strict": true`: Activates all strict type checking flags.
- `"noImplicitAny": true`: Every variable, parameter, and return value must have an explicit or safely inferred type.
- `"strictNullChecks": true`: Prevents runtime `null` and `undefined` dereferencing.
- `"noUncheckedIndexedAccess": true`: Array lookups or dynamic dictionary accesses automatically include `undefined` in their union type, forcing defensive boundary checks.

### 1.2 Strict Prohibition of `any`
> [!CAUTION]
> The use of the `any` type is strictly forbidden in production code. Any pull request introducing `any` without an explicit architect-approved waiver will fail CI checks.

- **Handling Unknown External Input:** When parsing untrusted external data (such as HTTP request bodies, external webhooks, or CSV imports), use `unknown` combined with Zod runtime schema parsing:

```typescript
// BAD: Unsafe, bypasses compiler
export async function handlePayload(rawInput: any) {
  return rawInput.title.toUpperCase(); // Runtime crash if title is undefined!
}

// GOOD: Safe, type-checked at boundary
import { z } from 'zod';

const payloadSchema = z.object({
  title: z.string().min(5),
});

export async function handlePayload(rawInput: unknown): Promise<string> {
  const validated = payloadSchema.parse(rawInput); // Throws ValidationError if malformed
  return validated.title.toUpperCase(); // 100% type-safe
}
```

### 1.3 Single Source of Truth for Types
To prevent drift between validation rules, database models, and presentation types, always derive types from the source schema:

```typescript
// 1. Zod Schema defines validation rules
export const createNoticeSchema = z.object({
  title: z.string().min(5).max(150),
  priority: z.enum(['normal', 'important', 'urgent']),
});

// 2. TypeScript type is inferred automatically
export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
```

### 1.4 Proper Use of Const Assertions vs. Enums
- Prefer TypeScript `const` assertions with union types over numeric enums to ensure clean JavaScript compilation and literal string compatibility:

```typescript
// Preferred: Const assertion object + union type
export const NoticePriority = {
  NORMAL: 'normal',
  IMPORTANT: 'important',
  URGENT: 'urgent',
} as const;

export type NoticePriority = (typeof NoticePriority)[keyof typeof NoticePriority];
```

### 1.5 Null vs. Undefined Handling
- **`undefined`:** Represents the absence of a value (e.g., an optional function argument or missing form field).
- **`null`:** Represents an intentional empty or unassigned state in database records (e.g., `assignedAdminId: null` indicates an unassigned ticket; `readAt: null` indicates an unread alert).
- Always use optional chaining (`?.`) and nullish coalescing (`??`) instead of loose falsy checks (`||`), which accidentally discard valid values like `0` or `""`:

```typescript
// BAD: If currentSemester is 0 (pre-term), fallback is incorrectly triggered
const semester = student.currentSemester || 1;

// GOOD: Strictly checks for null or undefined
const semester = student.currentSemester ?? 1;
```

---

## 2. Code Formatting & Clean Code Standards

### 2.1 Prettier Configuration Rules
All code must be formatted according to `.prettierrc`:
- Indentation: **2 spaces** (no tabs).
- Quotes: **Single quotes** (`'`), except in JSON and JSX attributes (`"`).
- Semicolons: **Always required** (`semi: true`).
- Print Width: **100 characters**.
- Trailing Commas: **ES5** compatible (objects, arrays).
- Tailwind Class Sorting: Enforced automatically via `prettier-plugin-tailwindcss`.

### 2.2 Import Ordering & Grouping
Imports must follow a strict 5-tier order, separated by a single blank line:

```typescript
// 1. External Third-Party Packages (Node, React, Next.js, libraries)
import React, { useState } from 'react';
import { z } from 'zod';

// 2. Core Lib Infrastructure & Auth Guards
import { requireAuth } from '@/lib/auth/guards';
import { cn } from '@/lib/utils/cn';

// 3. UI Primitives & Shared Components
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';

// 4. Feature Modules (Public API Contracts Only)
import { NoticeFeed } from '@/features/notices';

// 5. Explicit Type Imports
import type { NoticeDTO } from '@/features/notices';
import type { ApiResponse } from '@/types/api';
```

### 2.3 Component Organization & Structure
React components must follow a consistent top-to-bottom layout:

```typescript
// 1. Imports
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// 2. Props Interface Definition (Named ComponentNameProps)
interface NoticeCardProps {
  title: string;
  isUrgent?: boolean;
  onAcknowledge: (id: string) => Promise<void>;
}

// 3. Main Component Function (PascalCase)
export function NoticeCard({ title, isUrgent = false, onAcknowledge }: NoticeCardProps) {
  // 3a. React Hooks & Local State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 3b. Event Handlers & Helper Functions
  const handleAction = async () => {
    setIsSubmitting(true);
    try {
      await onAcknowledge('notice_id');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3c. Early Return (Guard Clauses)
  if (!title) return null;

  // 3d. JSX Return
  return (
    <article className="rounded-lg border p-4 shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      <Button onClick={handleAction} disabled={isSubmitting}>
        {isSubmitting ? 'Confirming...' : 'Acknowledge'}
      </Button>
    </article>
  );
}
```

### 2.4 Function Size & Readability Guidelines
- **Function Length:** Individual functions should ideally remain under **40 lines of code**. If a function exceeds 50 lines, extract helper functions or break down business logic into service methods.
- **Cyclomatic Complexity:** Functions must maintain a cyclomatic complexity of **< 10**. Avoid deeply nested `if/else` ladders; use **early returns (guard clauses)**:

```typescript
// BAD: Deeply nested pyramid of doom
function processTicket(user, ticket) {
  if (user) {
    if (user.role === 'admin') {
      if (ticket.status === 'submitted') {
        // execute logic
      } else {
        throw new Error('Not submitted');
      }
    } else {
      throw new Error('Not admin');
    }
  } else {
    throw new Error('Not logged in');
  }
}

// GOOD: Flat, readable early returns
function processTicket(user: UserSession, ticket: ServiceRequestDTO) {
  if (!user) throw new UnauthorizedError();
  if (user.role !== 'admin') throw new ForbiddenError();
  if (ticket.status !== 'submitted') throw new BusinessRuleError('Ticket must be submitted.');

  // Execute clean business logic here
}
```

---

## 3. Comprehensive Naming Conventions

| Category | Casing Style | Pattern / Prefix / Suffix | Practical Examples |
| :--- | :--- | :--- | :--- |
| **Files (General)** | `kebab-case` | Descriptive nouns | `notice-card.tsx`, `use-notice-feed.ts` |
| **Domain Services** | `kebab-case` | `*.service.ts` | `notice.service.ts`, `request.service.ts` |
| **Repositories** | `kebab-case` | `*.repository.ts` | `notice.repository.ts`, `user.repository.ts` |
| **Zod Schemas** | `kebab-case` | `*.schema.ts` | `notice.schema.ts`, `assignment.schema.ts` |
| **Server Actions** | `kebab-case` | `*.actions.ts` | `notices.actions.ts`, `requests.actions.ts` |
| **React Components** | `PascalCase` | Descriptive noun | `NoticeCard`, `RequestKanbanBoard`, `EmergencyModal` |
| **React Hooks** | `camelCase` | `use` prefix | `useNoticeFeed`, `useAblyChat`, `useCurrentUser` |
| **Server Actions Functions** | `camelCase` | `Action` suffix | `createNoticeAction`, `approveRequestAction` |
| **Domain Service Methods** | `camelCase` | `verbNoun` phrasing | `getNoticeById`, `verifyStudentClaim`, `calculateSla` |
| **Local Variables** | `camelCase` | Descriptive noun | `activeChannelId`, `studentRoster`, `isLoading` |
| **Global Constants** | `UPPER_SNAKE_CASE` | Uppercase letters | `MAX_FILE_SIZE_BYTES`, `DEFAULT_PAGE_SIZE` |
| **Boolean Flags** | `camelCase` | `is*`, `has*`, `can*`, `should*` | `isPinned`, `hasReadReceipt`, `canGrade` |
| **TypeScript Interfaces** | `PascalCase` | No Hungarian `I` prefix | `NoticeDTO`, `UserSession`, `ServiceRequest` |
| **Mongoose Models** | `PascalCase` | `Model` suffix | `UserModel`, `NoticeModel`, `ServiceRequestModel` |
| **MongoDB Collections** | `snake_case` | Plural noun | `users`, `notices`, `service_requests`, `rooms` |
| **REST API Routes** | `kebab-case` | Pluralized resources | `/api/realtime/token`, `/api/webhooks/clerk` |
| **Environment Variables** | `UPPER_SNAKE_CASE` | `NEXT_PUBLIC_*` for browser | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `MONGODB_URI` |

