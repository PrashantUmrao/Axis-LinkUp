# Axis LinkUp — Role-Based Access Control (RBAC) & Permission Matrix

> **Document ID:** DOC-AUTH-005  
> **Status:** Architecture Baseline (Phase 3, Part 3.1)  
> **Institution:** Axis Institute of Technology & Management  
> **Model:** Server-Enforced RBAC with Attribute-Based (ABAC) Resource Scoping  
> **Last Updated:** November 2026  

---

## 1. Authorization Philosophy: Default-Deny & Defense-in-Depth

Axis LinkUp operates under a strict **Default-Deny** security posture:
- Unless an explicit permission rule or ownership predicate matches the incoming request, the server denies access (`HTTP 403 Forbidden`).
- **Client Claims are Untrusted:** Role indicators sent from client components are discarded. The server extracts the authenticated identity from the verified session cookie and checks roles directly from the session claims and MongoDB profile.
- **Role-Level vs. Resource-Level Authorization:** Simple role-based checks (e.g. `role === 'faculty'`) are **insufficient** on their own. They must be coupled with **Resource-Level Attribute Checks (ABAC)** to ensure, for example, that a faculty member can only edit assignments for their own assigned courses, and a student can only view their own submissions.

---

## 2. The Four Core Roles & Their Operational Scopes

| Role | Hierarchy Level | Primary Operational Scope | Security Invariants |
| :--- | :---: | :--- | :--- |
| **`student`** | 1 (Base) | Self-profile, enrolled department, batch year, assigned course sections. | Cannot publish global notices; cannot access other students' private grades/submissions. |
| **`faculty`** | 2 | Assigned courses, sections, departmental notices, student evaluations. | Cannot alter global college settings; cannot modify administrative tickets or audit logs. |
| **`admin`** | 3 | Departmental administrative queues, service tickets, facility bookings, notices. | Scoped to assigned operational queues (Registrar, Exam Cell); cannot alter system audit logs. |
| **`super_admin`**| 4 (Executive) | Global system configuration, user role management, emergency broadcasts, audit. | Master Emergency trigger; full oversight; cannot delete or tamper with audit records. |

---

## 3. Comprehensive Master Permissions Matrix (All 19 Modules)

**Legend:**
- **`ALLOW`**: Unrestricted operation within assigned scope.
- **`OWN`**: Operation permitted strictly if caller owns the resource (or is assigned instructor).
- **`DEPT`**: Operation permitted strictly within the administrator's assigned department.
- **`DENY`**: Operation strictly prohibited (raises `ForbiddenError`).

| Module | Action / Capability | Student | Faculty | Admin | Super Admin | Enforcement Level |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **01. Users** | Read Own Profile | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | User ID Match |
| | Update Own Profile | `OWN` | `OWN` | `OWN` | `OWN` | Non-sensitive fields only |
| | Manage Users / Roles | `DENY` | `DENY` | `DEPT` | `ALLOW` | Super Admin check |
| **02. RBAC** | Modify Role Permissions | `DENY` | `DENY` | `DENY` | `ALLOW` | Super Admin check |
| **03. Student Dash** | View Student Portal | `ALLOW` | `DENY` | `DENY` | `DENY` | Role Check |
| **04. Faculty Dash** | View Faculty Portal | `DENY` | `ALLOW` | `DENY` | `DENY` | Role Check |
| **05. Admin Dash** | View Admin Console | `DENY` | `DENY` | `ALLOW` | `ALLOW` | Role Check |
| **06. Super Admin** | View System Telemetry | `DENY` | `DENY` | `DENY` | `ALLOW` | Super Admin check |
| **07. Notices** | Publish Course Notice | `DENY` | `OWN` | `DEPT` | `ALLOW` | Assigned Course Match |
| | Publish College Notice | `DENY` | `DENY` | `DEPT` | `ALLOW` | Admin Role Check |
| | Broadcast Urgent Notice | `DENY` | `DENY` | `DEPT` | `ALLOW` | Admin Role Check |
| **08. Chat** | Send Message in Course Channel| `OWN` | `OWN` | `DEPT` | `ALLOW` | Course Enrollment Match |
| | Moderate / Delete Messages | `DENY` | `OWN` | `DEPT` | `ALLOW` | Instructor / Mod Scope |
| **09. Polls** | Create Course Poll | `DENY` | `OWN` | `DEPT` | `ALLOW` | Course Assignment |
| | Cast Vote | `OWN` | `OWN` | `ALLOW` | `ALLOW` | One vote per user check |
| **10. Calendar** | View Master Schedule | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | Public / Enrolled |
| | Edit Academic Calendar | `DENY` | `DENY` | `ALLOW` | `ALLOW` | Admin Role Check |
| **11. Assignments**| Submit Assignment | `OWN` | `DENY` | `DENY` | `DENY` | Student Enrolled Match |
| | Create / Grade Assignment | `DENY` | `OWN` | `DEPT` | `ALLOW` | Assigned Course Match |
| | View Peer Submissions | `DENY` | `DENY` | `DENY` | `DENY` | **STRICT PROHIBITION** |
| **12. Notes** | Upload Course Materials | `DENY` | `OWN` | `DEPT` | `ALLOW` | Assigned Course Match |
| | Download Materials | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | Enrolled Department |
| **13. Requests** | Submit Service Ticket | `OWN` | `OWN` | `DENY` | `DENY` | Student / Staff |
| | Approve / Reject Ticket | `DENY` | `OWN` (Leave)| `DEPT` | `ALLOW` | Departmental Queue Scope |
| **14. Spaces** | Book Facility / Lab | `DENY` | `OWN` | `DEPT` | `ALLOW` | Approval Required |
| **15. Passport** | Submit Skill Proof | `OWN` | `DENY` | `DENY` | `DENY` | Student Only |
| | Endorse / Verify Claim | `DENY` | `OWN` | `DEPT` | `ALLOW` | Faculty Mentor Match |
| **16. Emergency** | Trigger Emergency Mode | `DENY` | `DENY` | `DENY` | `ALLOW` | Master Trigger Gate |
| | Acknowledge Alert | `ALLOW` | `ALLOW` | `ALLOW` | `ALLOW` | Mandatory Protocol |
| **17. Alerts** | Dispatch System Alerts | `DENY` | `OWN` | `DEPT` | `ALLOW` | Role Check |
| **18. Analytics** | View Institutional Reports | `DENY` | `OWN` | `DEPT` | `ALLOW` | Scoped Aggregation |
| **19. Audit Logs** | View Audit Records | `DENY` | `DENY` | `DEPT` | `ALLOW` | Read-only; Immutable |

---

## 4. Resource-Level Authorization (ABAC) Implementation Pattern

Every Server Action enforces resource-level authorization via defensive guard clauses:

```typescript
// Pattern: Resource Ownership Assertion in Server Action
export async function gradeSubmissionAction(rawInput: unknown): Promise<ApiResponse<SubmissionDTO>> {
  // 1. Assert Authentication and Base Role
  const session = await requireAuth();
  if (session.role !== 'faculty' && session.role !== 'super_admin') {
    throw new ForbiddenError('Only faculty members may grade submissions.');
  }

  // 2. Validate Input Payload
  const { submissionId, grade, feedback } = gradeSubmissionSchema.parse(rawInput);

  // 3. Fetch Resource and Verify Resource-Level Ownership (ABAC)
  const submission = await SubmissionRepository.findById(submissionId);
  if (!submission) {
    throw new NotFoundError('Submission', submissionId);
  }

  const course = await CourseRepository.findById(submission.courseId);
  const isAssignedInstructor = course?.instructorIds.includes(session.userId);

  if (!isAssignedInstructor && session.role !== 'super_admin') {
    throw new ForbiddenError('You can only grade submissions for courses assigned to you.');
  }

  // 4. Delegate to Domain Service
  const updatedSubmission = await GradingService.grade(submissionId, grade, feedback, session);
  return createSuccessPayload(updatedSubmission, 'Submission graded successfully.');
}
```

---

## 5. Decision Classification

- **Approved Decisions (Firm):**
  - Default-deny security posture across all routes and Server Actions.
  - Resource-level authorization (ABAC) required for assignments, grading, requests, and notices.
  - Strict prohibition against students viewing peer submissions or modifying marks.
- **Proposed Decisions:**
  - Automated department scoping on administrative queries (`{ departmentId: session.departmentId }`).
- **Pending Human Approval:**
  - Whether department HODs can delegate assignment grading to visiting lecturers or teaching assistants (TAs).

