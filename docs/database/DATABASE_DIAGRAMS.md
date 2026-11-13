# Database Architecture Diagrams Specification

> **Document ID:** DOC-DATA-004  
> **Status:** Approved Baseline (Phase 1, Part 1.4)  
> **Institution:** Axis Institute of Technology & Management  
> **Format:** Mermaid ERD & Relationship Graphs  
> **Last Updated:** November 2026  

---

## 1. Master Institutional Entity-Relationship Diagram

Visualizes the holistic data model connecting all 25 collections across Axis LinkUp.

```mermaid
erDiagram
    %% Core Identity & Academics
    users ||--o{ notices : "authors"
    users ||--o{ notice_receipts : "acknowledges"
    users ||--o{ chat_messages : "sends"
    users ||--o{ notifications : "receives"
    users ||--o{ service_requests : "submits_or_processes"
    users ||--o{ audit_logs : "triggers"
    users }o--|| departments : "belongs_to"
    
    departments ||--o{ courses : "offers"
    departments ||--o{ service_requests : "manages"
    departments ||--o{ request_categories : "defines"
    
    academic_terms ||--o{ course_enrollments : "schedules"
    academic_terms ||--o{ timetable_slots : "schedules"
    academic_terms ||--o{ calendar_events : "contains"
    
    courses ||--o{ course_enrollments : "instantiates"
    courses ||--o{ timetable_slots : "schedules"
    courses ||--o{ assignments : "contains"
    courses ||--o{ study_materials : "hosts"
    
    users ||--o{ course_enrollments : "instructs_or_attends"
    users ||--o{ timetable_slots : "teaches"
    
    %% Communication & Notices
    notices ||--o{ notice_receipts : "tracked_by"
    chat_channels ||--o{ chat_messages : "contains"
    users }o--o{ chat_channels : "member_of"
    
    %% Operations & Workflows
    request_categories ||--o{ service_requests : "classifies"
    rooms ||--o{ timetable_slots : "hosts"
    rooms ||--o{ room_reservations : "allocated_to"
    users ||--o{ room_reservations : "requests_or_approves"
    
    %% Phase 2 & 3 Modules
    assignments ||--o{ submissions : "receives"
    users ||--o{ submissions : "submits_or_evaluates"
    polls ||--o{ poll_votes : "accumulates"
    users ||--o{ student_achievements : "owns_or_verifies"
    emergency_alerts ||--o{ emergency_acknowledgments : "tracks"
    users ||--o{ emergency_acknowledgments : "confirms"
```

---

## 2. Identity, Role & Academic Enrollment Diagram

Focuses on user authentication links, departmental hierarchy, and student/faculty cohort mappings.

```mermaid
erDiagram
    departments {
        ObjectId _id PK
        string code UK
        string name
        ObjectId hodId FK
        boolean isActive
    }

    users {
        ObjectId _id PK
        string clerkId UK
        string email UK
        string fullName
        string role
        ObjectId departmentId FK
        string phone
        string avatarUrl
        string status
        object studentMetadata
        object facultyMetadata
        date createdAt
    }

    academic_terms {
        ObjectId _id PK
        string name UK
        date startDate
        date endDate
        boolean isCurrent
    }

    courses {
        ObjectId _id PK
        string code UK
        string title
        ObjectId departmentId FK
        number semester
        number credits
    }

    course_enrollments {
        ObjectId _id PK
        ObjectId courseId FK
        ObjectId termId FK
        string section
        ObjectId primaryFacultyId FK
        ObjectId[] coFacultyIds FK
        ObjectId[] studentIds FK
    }

    departments ||--o{ users : "employs / enrolls"
    departments ||--o{ courses : "offers"
    academic_terms ||--o{ course_enrollments : "runs"
    courses ||--o{ course_enrollments : "offers_section"
    users ||--o{ course_enrollments : "teaches (primaryFacultyId)"
    users }o--o{ course_enrollments : "enrolled (studentIds[])"
```

---

## 3. Communication, Notices & Real-Time Messaging Diagram

Focuses on targeted notice distribution, acknowledgment receipts, and chat channel isolation.

```mermaid
erDiagram
    notices {
        ObjectId _id PK
        string title
        string contentMarkdown
        ObjectId authorId FK
        string priority
        object targetScope
        object[] attachments
        boolean isPinned
        boolean requiresAcknowledgment
        date expiresAt
        date createdAt
    }

    notice_receipts {
        ObjectId _id PK
        ObjectId noticeId FK
        ObjectId userId FK
        date readAt
        date acknowledgedAt
    }

    chat_channels {
        ObjectId _id PK
        string name
        string type
        ObjectId courseId FK
        ObjectId departmentId FK
        ObjectId[] memberIds FK
        boolean isArchived
        date createdAt
    }

    chat_messages {
        ObjectId _id PK
        ObjectId channelId FK
        ObjectId senderId FK
        string messageBody
        object[] attachments
        boolean isDeleted
        date createdAt
    }

    notifications {
        ObjectId _id PK
        ObjectId userId FK
        string title
        string message
        string category
        string linkUrl
        boolean isRead
        date readAt
        date createdAt
    }

    users ||--o{ notices : "authors"
    notices ||--o{ notice_receipts : "tracks"
    users ||--o{ notice_receipts : "confirms"
    chat_channels ||--o{ chat_messages : "hosts"
    users ||--o{ chat_messages : "sends"
    users }o--o{ chat_channels : "participates_in"
    users ||--o{ notifications : "receives"
```

---

## 4. Administrative Services & Student Request Tracking Diagram

Focuses on the requisition lifecycle, form data validation, departmental queues, and SLA enforcement.

```mermaid
erDiagram
    request_categories {
        ObjectId _id PK
        string code UK
        string title
        string description
        ObjectId targetDepartmentId FK
        number defaultSlaHours
        object formSchema
        boolean isActive
    }

    service_requests {
        ObjectId _id PK
        string trackingNumber UK
        ObjectId categoryId FK
        ObjectId studentId FK
        ObjectId departmentId FK
        ObjectId assignedAdminId FK
        string status
        object formData
        object[] proofAttachments
        string issuedDocumentUrl
        string resolutionNotes
        object[] comments
        date slaDueDate
        date resolvedAt
        date createdAt
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
        string userAgent
        date createdAt
    }

    departments ||--o{ request_categories : "defines"
    request_categories ||--o{ service_requests : "instantiates"
    departments ||--o{ service_requests : "routes_to"
    users ||--o{ service_requests : "initiates (studentId)"
    users ||--o{ service_requests : "processes (assignedAdminId)"
    users ||--o{ audit_logs : "triggers (actorId)"
```

---

## 5. Academic Scheduling, Rooms & Timetables Diagram

Focuses on weekly recurring timetable allocation, facility specs, and ad-hoc room reservations.

```mermaid
erDiagram
    rooms {
        ObjectId _id PK
        string block
        string roomNumber
        string type
        number seatingCapacity
        boolean hasProjector
        number pcCount
        boolean isAirConditioned
    }

    timetable_slots {
        ObjectId _id PK
        ObjectId courseId FK
        ObjectId facultyId FK
        ObjectId roomId FK
        ObjectId termId FK
        number dayOfWeek
        string startTime
        string endTime
        string section
    }

    room_reservations {
        ObjectId _id PK
        ObjectId roomId FK
        ObjectId requestedById FK
        date startTime
        date endTime
        string purpose
        string status
        ObjectId approvedById FK
        date createdAt
    }

    calendar_events {
        ObjectId _id PK
        ObjectId termId FK
        string title
        string description
        string category
        date startDate
        date endDate
        object targetScope
    }

    rooms ||--o{ timetable_slots : "allocated_to"
    rooms ||--o{ room_reservations : "reserved_for"
    courses ||--o{ timetable_slots : "schedules"
    academic_terms ||--o{ timetable_slots : "spans"
    academic_terms ||--o{ calendar_events : "holds"
    users ||--o{ timetable_slots : "instructs"
    users ||--o{ room_reservations : "requests"
```

---

## 6. Coursework, Submissions & Study Materials Diagram (Phase 2)

Focuses on assignment distribution, student file uploads, deadline tracking, and lecture notes.

```mermaid
erDiagram
    assignments {
        ObjectId _id PK
        ObjectId courseId FK
        ObjectId facultyId FK
        string title
        string description
        number maxMarks
        date dueDate
        boolean allowLate
        date lateCutoffDate
        object[] attachments
        date createdAt
    }

    submissions {
        ObjectId _id PK
        ObjectId assignmentId FK
        ObjectId studentId FK
        string fileUrl
        string fileName
        number fileSizeBytes
        date submittedAt
        boolean isLate
        string status
        number score
        string feedback
        ObjectId gradedById FK
        date gradedAt
    }

    study_materials {
        ObjectId _id PK
        ObjectId courseId FK
        ObjectId facultyId FK
        number unitNumber
        string title
        string description
        string fileUrl
        string fileType
        number downloadCount
        string[] tags
        date createdAt
    }

    courses ||--o{ assignments : "contains"
    courses ||--o{ study_materials : "hosts"
    assignments ||--o{ submissions : "receives"
    users ||--o{ assignments : "creates (facultyId)"
    users ||--o{ submissions : "submits (studentId)"
    users ||--o{ submissions : "evaluates (gradedById)"
    users ||--o{ study_materials : "uploads (facultyId)"
```

