# Backend Architecture & Directory Specification

> **Document ID:** DOC-STRUC-004  
> **Status:** Approved Baseline (Phase 1, Part 1.5)  
> **Institution:** Axis Institute of Technology & Management  
> **Architectural Pattern:** Layered Service-Repository Pattern  
> **Runtime:** Node.js (Vercel Serverless Functions)  
> **Last Updated:** November 2026  

---

## 1. Architectural Ingress & Layering Overview

The backend is structured into distinct layers to guarantee that **zero business logic exists in React components or Route Handlers**.

```mermaid
graph TD
    subgraph IngressTier [1. Ingress & Controller Tier]
        ServerActions["Server Actions (src/app/actions/*)"]
        RouteHandlers["Route Handlers (src/app/api/*)"]
    end

    subgraph SecurityTier [2. Security & Policy Tier]
        AuthGuards["Auth & Session Guards (src/lib/auth/guards.ts)"]
        Policies["ABAC Authorization Policies (src/lib/auth/policies/*)"]
        ZodSchemas["Zod Validation Schemas (src/lib/validations/*)"]
    end

    subgraph ServiceTier [3. Pure Domain Business Logic Tier]
        DomainServices["Domain Services (src/lib/services/*)"]
    end

    subgraph DataAccessTier [4. Data Access Layer (DAL)]
        Repositories["Domain Repositories (src/lib/db/repositories/*)"]
        MongooseModels["Mongoose Schemas & Models (src/lib/db/models/*)"]
        MongooseClient["Cached Singleton Client (src/lib/db/client.ts)"]
    end

    subgraph IntegrationTier [5. External Integration Services]
        ClerkIntegration["Clerk Backend Client (src/lib/integrations/clerk.ts)"]
        AblyIntegration["Ably REST Client (src/lib/integrations/ably.ts)"]
        CloudinaryIntegration["Cloudinary SDK (src/lib/integrations/cloudinary.ts)"]
        ResendIntegration["Resend Email Client (src/lib/integrations/resend.ts)"]
    end

    IngressTier --> AuthGuards
    AuthGuards --> Policies
    Policies --> ZodSchemas
    ZodSchemas --> DomainServices
    DomainServices --> Repositories
    DomainServices --> IntegrationTier
    Repositories --> MongooseModels
    MongooseModels --> MongooseClient
```

---

## 2. Exhaustive Directory Layout (`src/lib/` & `src/app/actions/`)

```
src/
├── app/
│   ├── actions/                                # Next.js Server Actions (Mutations)
│   │   ├── auth.actions.ts                     # Password reset, profile update
│   │   ├── notices.actions.ts                  # Notice publish, pin, acknowledge
│   │   ├── requests.actions.ts                 # Submit ticket, approve, reject, comment
│   │   ├── chat.actions.ts                     # Send message, archive channel
│   │   ├── timetable.actions.ts                # Schedule slot, book room
│   │   ├── emergency.actions.ts                # Trigger emergency, confirm receipt
│   │   └── user.actions.ts                     # Update user role, toggle suspension
│   │
│   └── api/                                    # Route Handlers (Reserved for webhooks & integrations)
│       ├── health/route.ts                     # Health monitoring endpoint
│       ├── webhooks/
│       │   ├── clerk/route.ts                  # Clerk user sync webhook
│       │   └── cloudinary/route.ts             # Cloudinary upload status webhook
│       ├── realtime/
│       │   └── token/route.ts                  # Ably capability token minting endpoint
│       └── storage/
│           └── signature/route.ts              # Cloudinary signed upload signature generator
│
└── lib/
    ├── auth/                                   # Authentication & Authorization Architecture
    │   ├── session.ts                          # Current user session extraction from cookies
    │   ├── guards.ts                           # Higher-order action guards (requireAuth, requireRole)
    │   ├── rbac.ts                             # Role-to-permission mapping engine
    │   └── policies/                           # Attribute-Based Access Control (ABAC) policies
    │       ├── notice.policy.ts                # canEditNotice, canPublishNotice
    │       ├── request.policy.ts               # canViewRequest, canApproveRequest
    │       ├── assignment.policy.ts            # canGradeSubmission
    │       └── chat.policy.ts                  # canAccessChannel
    │
    ├── validations/                            # Global Zod Validation Schemas
    │   ├── notice.schema.ts                    # Create/Update notice validation
    │   ├── request.schema.ts                   # Service request validation
    │   ├── assignment.schema.ts                # Assignment submission validation
    │   ├── user.schema.ts                      # Profile & role modification schemas
    │   └── env.schema.ts                       # Environment variable boot validator
    │
    ├── services/                               # Pure Domain Business Logic Services
    │   ├── notice.service.ts                   # Notice targeting, priority, receipt aggregation
    │   ├── request.service.ts                  # Ticket lifecycle, SLA calculation, QR certificate
    │   ├── chat.service.ts                     # Message persistence, 1:1 channel isolation
    │   ├── timetable.service.ts                # Timetable slot scheduling, clash detection
    │   ├── emergency.service.ts                # Emergency broadcast, lock activation, receipt auditing
    │   ├── notification.service.ts             # In-app alert dispatch, badge counter updates
    │   ├── audit.service.ts                    # Immutable append-only audit logger
    │   └── user.service.ts                     # Bulk CSV roster parser, account state machine
    │
    ├── db/                                     # Data Access Layer & Mongoose
    │   ├── client.ts                           # Global singleton Mongoose connection pool
    │   ├── models/                             # Mongoose Schemas & Model Declarations
    │   │   ├── user.model.ts
    │   │   ├── department.model.ts
    │   │   ├── course.model.ts
    │   │   ├── academic-term.model.ts
    │   │   ├── course-enrollment.model.ts
    │   │   ├── notice.model.ts
    │   │   ├── notice-receipt.model.ts
    │   │   ├── chat-channel.model.ts
    │   │   ├── chat-message.model.ts
    │   │   ├── notification.model.ts
    │   │   ├── calendar-event.model.ts
    │   │   ├── timetable-slot.model.ts
    │   │   ├── request-category.model.ts
    │   │   ├── service-request.model.ts
    │   │   ├── audit-log.model.ts
    │   │   ├── assignment.model.ts             # Phase 2
    │   │   ├── submission.model.ts             # Phase 2
    │   │   ├── study-material.model.ts         # Phase 2
    │   │   ├── poll.model.ts                   # Phase 2
    │   │   ├── poll-vote.model.ts              # Phase 2
    │   │   ├── room.model.ts                   # Phase 2
    │   │   ├── room-reservation.model.ts       # Phase 2
    │   │   ├── student-achievement.model.ts    # Phase 3
    │   │   ├── emergency-alert.model.ts        # Phase 3
    │   │   └── emergency-acknowledgment.model.ts # Phase 3
    │   └── repositories/                       # Data Access Layer (DAL) Repositories
    │       ├── user.repository.ts
    │       ├── notice.repository.ts
    │       ├── request.repository.ts
    │       ├── chat.repository.ts
    │       ├── timetable.repository.ts
    │       └── audit.repository.ts
    │
    ├── integrations/                           # Third-Party Managed Cloud Integrations
    │   ├── clerk.ts                            # @clerk/backend SDK client initialization
    │   ├── ably.ts                             # Ably REST API client (stateless server publishing)
    │   ├── cloudinary.ts                       # Cloudinary SDK & HMAC private download URL generator
    │   └── resend.ts                           # Resend email client & email sender
    │
    ├── queue/                                  # Future Asynchronous Background Processing
    │   ├── queue.interface.ts                  # Background job contract
    │   └── worker.stub.ts                      # Placeholder for Phase 3 BullMQ / QStash worker
    │
    └── utils/                                  # General Helper Utilities
        ├── cn.ts                               # Tailwind merge and clsx helper
        ├── format-date.ts                      # Date-fns format wrappers
        └── sanitize.ts                         # DOMPurify HTML/Markdown sanitization
```

---

## 3. Layer Implementation Contracts

### 3.1 Server Action Pattern
```typescript
// Example: src/app/actions/requests.actions.ts
'use server';

import { requireStudent } from '@/lib/auth/guards';
import { createRequestSchema } from '@/lib/validations/request.schema';
import { RequestService } from '@/lib/services/request.service';
import type { ApiResponse } from '@/types/api';
import type { ServiceRequestDTO } from '@/features/requests/types';

export async function createServiceRequestAction(
  rawInput: unknown
): Promise<ApiResponse<ServiceRequestDTO>> {
  try {
    // 1. Enforce Authentication & Role
    const student = await requireStudent();

    // 2. Enforce Zod Validation
    const validatedData = createRequestSchema.parse(rawInput);

    // 3. Delegate to Domain Service
    const createdRequest = await RequestService.createRequest(validatedData, student);

    return {
      success: true,
      data: createdRequest,
      error: null,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      success: false,
      data: null,
      error: {
        code: error.errorCode || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred.',
        details: error.details,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
```

### 3.2 Domain Service Contract
```typescript
// Example: src/lib/services/request.service.ts
import { RequestRepository } from '@/lib/db/repositories/request.repository';
import { AuditService } from '@/lib/services/audit.service';
import { AblyService } from '@/lib/integrations/ably';
import { BusinessRuleError } from '@/lib/errors/app-error';
import type { UserSession } from '@/types/auth';
import type { CreateRequestInput, ServiceRequestDTO } from '@/features/requests/types';

export class RequestService {
  static async createRequest(
    data: CreateRequestInput,
    student: UserSession
  ): Promise<ServiceRequestDTO> {
    // Enforce Business Invariant: No duplicate active requests of same category
    const hasPending = await RequestRepository.hasPendingRequest(student.id, data.categoryId);
    if (hasPending) {
      throw new BusinessRuleError('You already have a pending request for this category.');
    }

    // Persist via Data Access Layer
    const ticket = await RequestRepository.create({
      ...data,
      studentId: student.id,
      departmentId: student.departmentId,
      status: 'submitted',
    });

    // Side-Effect: Dispatch Audit Log
    await AuditService.log({
      actorId: student.id,
      actorRole: student.role,
      action: 'SUBMIT_REQUEST',
      module: 'MOD-13',
      entityId: ticket.id,
      newState: { trackingNumber: ticket.trackingNumber, status: 'submitted' },
    });

    // Side-Effect: Publish real-time event to Admin desk via Ably
    await AblyService.publish(
      `dept:${student.departmentId}:admin:requests`,
      'request.created',
      { trackingNumber: ticket.trackingNumber }
    );

    return ticket;
  }
}
```

