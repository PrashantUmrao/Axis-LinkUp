# System Architecture Diagrams Specification

> **Document ID:** DOC-ARCH-009  
> **Status:** Draft for Review (Phase 1, Part 1.2)  
> **Standard:** C4 Model & UML Sequence Standards  
> **Diagramming Format:** Mermaid.js  
> **Last Updated:** November 2026  

---

## 1. System Context Diagram (C4 Level 1)

Visualizes how different user roles and external services interact with the Axis LinkUp platform.

```mermaid
graph TD
    subgraph Users [Campus Stakeholders]
        Student["Student<br/>(Mobile & Web)"]
        Faculty["Faculty<br/>(Desktop & Tablet)"]
        Admin["Admin Staff<br/>(Desktop Workstations)"]
        SuperAdmin["Super Admin<br/>(High-Security Console)"]
    end

    subgraph AxisSystem [Axis LinkUp Ecosystem]
        AxisCore["Axis LinkUp Platform<br/>(Next.js Modular Monolith)"]
    end

    subgraph ExternalPlatforms [External Managed Services]
        Clerk["Clerk<br/>(Auth & MFA)"]
        Atlas["MongoDB Atlas<br/>(Replica Set - Mumbai)"]
        Ably["Ably Realtime<br/>(WebSockets & Presence)"]
        Cloudinary["Cloudinary<br/>(Media & Document Storage)"]
        FCM["Firebase FCM<br/>(Push Alerts)"]
    end

    Student -->|Checks notices, submits assignments, files tickets| AxisCore
    Faculty -->|Grades coursework, schedules classes, posts bulletins| AxisCore
    Admin -->|Processes requests, manages rooms, reviews SLAs| AxisCore
    SuperAdmin -->|Audits logs, assigns roles, triggers emergency alert| AxisCore

    AxisCore <-->|Authenticates sessions & user identities| Clerk
    AxisCore <-->|Stores & queries application documents| Atlas
    AxisCore <-->|Dispatches real-time events & alerts| Ably
    AxisCore <-->|Manages & secures document attachments| Cloudinary
    AxisCore -->|Sends mobile push notifications| FCM

    Student -.->|Subscribes to live channels| Ably
    Student -.->|Directly uploads coursework files| Cloudinary
```

---

## 2. Container Diagram (C4 Level 2)

Details the software containers, hosting boundaries, and protocols in use.

```mermaid
graph TD
    subgraph ClientTier [Client Applications]
        Browser["Responsive Web Browser / PWA<br/>(React 19 / TypeScript)"]
    end

    subgraph EdgeTier [Vercel Edge Network]
        EdgeProxy["Vercel CDN / Reverse Proxy<br/>(TLS 1.3 Termination)"]
        Middleware["Next.js Edge Middleware<br/>(JWT Decryption & RBAC Guard)"]
    end

    subgraph ServerlessTier [Next.js Application Core]
        RSC["React Server Components<br/>(Server HTML Streaming)"]
        ServerActions["Next.js Server Actions<br/>(Mutations & Business Logic)"]
        RouteHandlers["API Route Handlers<br/>(Webhooks & Token Minting)"]
    end

    subgraph PersistenceTier [Data & Persistence Engine]
        MongoDB[("MongoDB Atlas M10+<br/>(AWS Mumbai - ap-south-1)")]
    end

    subgraph CloudServices [Managed Cloud Integrations]
        Clerk["Clerk Identity Service"]
        Ably["Ably Realtime Broker"]
        Cloudinary["Cloudinary Media Engine"]
        FCM["Firebase Cloud Messaging"]
    end

    Browser -->|HTTPS / WSS| EdgeProxy
    EdgeProxy --> Middleware
    Middleware --> RSC
    Middleware --> ServerActions
    Middleware --> RouteHandlers

    RSC -->|Mongoose DAL (TCP)| MongoDB
    ServerActions -->|Mongoose DAL (TCP)| MongoDB
    ServerActions -->|REST API (HTTPS)| Ably
    ServerActions -->|REST API (HTTPS)| Cloudinary
    ServerActions -->|REST API (HTTPS)| FCM
    RouteHandlers <-->|Signed Webhooks (HTTPS)| Clerk

    Browser <-->|WebSocket (WSS)| Ably
    Browser -->|Direct Multipart Upload (HTTPS)| Cloudinary
```

---

## 3. Component Diagram (C4 Level 3 — Next.js Modular Monolith)

Breaks down the internal code structure inside the Next.js application container.

```mermaid
graph TD
    subgraph AppRouter [Next.js App Router Layer]
        Page["Page Server Components (page.tsx)"]
        Action["Server Actions (*.actions.ts)"]
        Handler["Route Handlers (route.ts)"]
    end

    subgraph Guards [Security & Validation Layer]
        Zod["Zod Validation Schemas"]
        AuthGuards["withAuth & withRole Guards"]
        ABAC["Resource Policy Enforcer"]
    end

    subgraph Services [Domain Services Layer]
        NoticeService["Notice Service"]
        RequestService["Request Tracker Service"]
        AssignmentService["Assignment Service"]
        EmergencyService["Emergency Service"]
        AuditService["Audit Log Service"]
    end

    subgraph Repositories [Data Access Layer]
        NoticeRepo["Notice Repository"]
        RequestRepo["Request Repository"]
        AssignmentRepo["Assignment Repository"]
        AuditRepo["Audit Log Repository"]
        MongooseConn["Cached Mongoose Client"]
    end

    subgraph Database [Database]
        Atlas[("MongoDB Atlas")]
    end

    Page --> AuthGuards
    Action --> AuthGuards
    Handler --> AuthGuards

    AuthGuards --> Zod
    Zod --> ABAC
    ABAC --> Services

    NoticeService --> NoticeRepo
    RequestService --> RequestRepo
    AssignmentService --> AssignmentRepo
    EmergencyService --> AuditService
    Services --> AuditService
    AuditService --> AuditRepo

    NoticeRepo --> MongooseConn
    RequestRepo --> MongooseConn
    AssignmentRepo --> MongooseConn
    AuditRepo --> MongooseConn

    MongooseConn --> Atlas
```

---

## 4. Entity Relationship Diagram (MongoDB Collections)

Illustrates the document collections, primary identifiers, and referenced ObjectIds.

```mermaid
erDiagram
    users {
        ObjectId _id PK
        string clerkId UK
        string email UK
        string fullName
        string role
        ObjectId departmentId FK
        string status
        object studentMetadata
        object facultyMetadata
    }

    departments {
        ObjectId _id PK
        string code UK
        string name
        ObjectId hodId FK
    }

    courses {
        ObjectId _id PK
        string code UK
        string title
        ObjectId departmentId FK
        number semester
    }

    notices {
        ObjectId _id PK
        string title
        string contentMarkdown
        ObjectId authorId FK
        string priority
        object targetScope
        boolean isPinned
        date expiresAt
    }

    notice_receipts {
        ObjectId _id PK
        ObjectId noticeId FK
        ObjectId userId FK
        date readAt
        date acknowledgedAt
    }

    assignments {
        ObjectId _id PK
        ObjectId courseId FK
        ObjectId facultyId FK
        string title
        date dueDate
        boolean allowLate
    }

    submissions {
        ObjectId _id PK
        ObjectId assignmentId FK
        ObjectId studentId FK
        string fileUrl
        number score
        string status
        date submittedAt
    }

    service_requests {
        ObjectId _id PK
        string trackingNumber UK
        string category
        ObjectId studentId FK
        ObjectId assignedAdminId FK
        ObjectId departmentId FK
        string status
        object formData
    }

    rooms {
        ObjectId _id PK
        string block
        string roomNumber
        string type
        number seatingCapacity
        boolean hasProjector
    }

    timetable_slots {
        ObjectId _id PK
        ObjectId courseId FK
        ObjectId facultyId FK
        ObjectId roomId FK
        number dayOfWeek
        string startTime
        string endTime
    }

    audit_logs {
        ObjectId _id PK
        ObjectId actorId FK
        string actorRole
        string action
        string module
        string entityId
        object oldState
        object newState
        string ipAddress
        date createdAt
    }

    users ||--o{ notices : "authors"
    users ||--o{ notice_receipts : "acknowledges"
    users ||--o{ submissions : "submits"
    users ||--o{ service_requests : "initiates"
    users ||--o{ audit_logs : "triggers"
    departments ||--o{ courses : "offers"
    courses ||--o{ assignments : "contains"
    assignments ||--o{ submissions : "receives"
    notices ||--o{ notice_receipts : "tracks"
    rooms ||--o{ timetable_slots : "allocates"
    courses ||--o{ timetable_slots : "schedules"
```

---

## 5. Authentication & Webhook Sync Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / Faculty Member
    participant Browser as Client Browser
    participant Clerk as Clerk Identity Service
    participant Webhook as /api/webhooks/clerk
    participant DB as MongoDB Atlas

    User->>Browser: Enters credentials & submits login
    Browser->>Clerk: POST /v1/client/sign_ins
    Clerk->>Clerk: Validate password & MFA
    Clerk-->>Browser: Set session cookie (__session)
    
    Note over Clerk,Webhook: Asynchronous Webhook Sync
    Clerk->>Webhook: HTTP POST event `user.created` (Svix signed)
    Webhook->>Webhook: Verify Svix signature using CLERK_WEBHOOK_SECRET
    Webhook->>DB: Upsert User Document into `users` collection
    DB-->>Webhook: User Created/Updated
    Webhook-->>Clerk: HTTP 200 Success Response
    
    Browser->>Browser: Redirects to assigned role dashboard (/student/dashboard)
```

---

## 6. Real-Time Chat & Emergency Broadcast Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Super Admin (Emergency Mode)
    participant Server as Next.js Server Action
    participant DB as MongoDB Atlas
    participant Ably as Ably Realtime Broker
    actor Students as All Connected Student Clients

    Admin->>Server: triggerEmergencyMode({ title: "Severe Storm Alert", severity: "red" })
    Server->>Server: Verify Super Admin Role & MFA Token
    Server->>DB: Insert `emergency_alerts` document
    Server->>DB: Insert `audit_logs` security event
    Server->>Ably: ably.channels.get("broadcast:global:emergency").publish("emergency.alert", payload)
    
    par Instant Broadcast to Connected Clients
        Ably-->>Students: WebSocket message delivered (<100ms)
        Students->>Students: Render Full-Screen Modal & High-Contrast Alert
        Students->>Students: Sound Emergency Audio Tone
    end

    Students->>Server: acknowledgeEmergencyAction({ alertId })
    Server->>DB: Insert `emergency_acknowledgments` document
    DB-->>Server: Acknowledged
```

---

## 7. Secure Direct-to-Cloudinary File Upload Flow

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Submitter
    participant Client as Web Browser
    participant Server as Next.js API (/api/storage/signature)
    participant Cloudinary as Cloudinary API
    participant Action as Next.js Server Action
    participant DB as MongoDB Atlas

    Student->>Client: Selects file (assignment_v1.pdf, 12MB)
    Client->>Client: Client-side validation (Size <= 25MB, type: PDF)
    Client->>Server: POST /api/storage/signature { category: "assignment" }
    Server->>Server: Verify Session & Enrollment
    Server->>Server: Generate HMAC-SHA256 signature using API Secret
    Server-->>Client: Return { signature, timestamp, apiKey, folder: "axis/assignments" }
    
    Client->>Cloudinary: Direct Multipart POST to Cloudinary Edge<br/>(Binary Payload + Signature)
    Cloudinary->>Cloudinary: Verify Signature & Persist Asset as `private`
    Cloudinary-->>Client: HTTP 200 OK { public_id: "raw/assignments/sub_102.pdf" }

    Client->>Action: submitAssignmentAction({ assignmentId, publicId })
    Action->>DB: Record submission in `submissions` collection
    DB-->>Action: Saved
    Action-->>Client: Success! Marked as Submitted.
```

---

## 8. Student Request Tracker State Machine (MOD-13)

```mermaid
stateDiagram-v2
    [*] --> Submitted: Student submits ticket with form data
    
    Submitted --> Under_Review: Admin picks up ticket & assigns officer
    Submitted --> Cancelled: Student cancels ticket before review
    
    Under_Review --> Approved: Admin verifies & endorses
    Under_Review --> Rejected: Deficiencies found (reason mandatory)
    
    Approved --> Ready_For_Pickup: Physical certificate printed / signed
    Approved --> Closed: Digital PDF auto-generated & delivered
    Ready_For_Pickup --> Closed: Student collects document from desk
    
    Rejected --> Closed: Student notified with appeal guidance
    Cancelled --> [*]
    Closed --> [*]
```

