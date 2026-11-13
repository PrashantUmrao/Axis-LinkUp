# AXIS LINKUP — ADMINISTRATION DASHBOARD REDESIGN SPECIFICATION
**Document ID:** `SPEC-UI-012`  
**Phase:** 4.8.5 (Dashboard Redesign & Composition)  
**Status:** Approved & Implemented  
**Target Ingress:** `src/app/(admin)/admin/dashboard/page.tsx` & `src/app/(super-admin)/super-admin/dashboard/page.tsx`  

---

## 1. Executive Summary

The Administration Workspace serves three primary administrative leadership roles at Axis Institute of Technology & Management (AITM), Kanpur:
1. **System Administrator:** Cloud infrastructure, closed user provisioning desk, role assignments, directory auditing.
2. **Head of Department (HOD):** Departmental faculty/student roster, AICTE statutory grievance adjudication (48-hour resolution SLA), coursework oversight.
3. **Executive Director:** Highest institutional authority, campus appeals tribunal, ombudsman docket, directorate circulars.

In accordance with:
$$\text{Admin Workspace} = \text{Reference 1 (Visual Identity)} + \text{Reference 2 (Layout \& Density)}$$
it utilizes soft translucent light-blue frosted surfaces, radial blue glows, and a high-density 3-tiered scope navigation bar allowing instant switching between administrative desks.

---

## 2. Layout Structure & Grid Composition

### 2.1 Top 4-Card Overview Row (Reference 2 KPI Row)
- **Grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- **Component:** `AdminMetricsOverview` (`src/app/(admin)/admin/dashboard/components/metrics-overview.tsx`)
- **Card 1: Enrolled Students**
  - Label: `Enrolled Students` | Category: `Directory`
  - Value: Direct MongoDB Atlas count (`counts.students`)
  - Subtext: `Atlas active student records`
  - Footer Trend Pill: `IAM Provisioned`
- **Card 2: Instructional Faculty**
  - Label: `Instructional Faculty` | Category: `Academic Staff`
  - Value: Direct MongoDB Atlas count (`counts.faculty`)
  - Subtext: `Department instructors & HODs`
  - Footer Trend Pill: `Verified Active`
- **Card 3: Administrative Officers**
  - Label: `Administrative Officers` | Category: `Governance`
  - Value: Direct MongoDB Atlas count (`counts.admins`)
  - Subtext: `Registrar, HODs & Directors`
  - Footer Trend Pill: `RBAC Active`
- **Card 4: Pending Requisitions**
  - Label: `Pending Requisitions` | Category: `Workflows`
  - Value: `0 Active` (Truth-in-UI verified)
  - Subtext: `Service desks & clearances`
  - Footer Trend Pill: `Queue Cleared`

---

## 3. Main Operational Canvas (2/3 Column) — Scope Switcher

The `AdminWorkspaceView` component coordinates three specialized administrative modules:

### 3.1 Scope 1: System Administrator Desk
- **Closed Account Provisioning Desk (`AdminProvisioningCard`):**
  - Implements Phase 4.8.2 closed account provisioning policy.
  - Interactive single-account provisioning form (Student, Faculty, Admin role selection with direct institutional email invite).
  - Batch onboarding trigger for Registrar Master CSV Roster.
  - Audit status indicator.
- **User Management & Provisioning Directory (`AdminUserManagement`):**
  - Complete user directory with status filters, suspension toggles, and role controls.
- **Student Service Requisition Queues (`AdminRequestTracking`):**
  - Campus clearance tracking and issuance.
- **Department Notices Desk (`AdminNoticeManagement`):**
  - Institutional circular publisher.

### 3.2 Scope 2: HOD Department Desk
- **HOD Department Grievance Adjudication (`HodGrievanceDesk`):**
  - First-authority tribunal under AICTE / UGC grievance guidelines.
  - Active tickets with countdown timer for 48-hour resolution SLA.
  - Adjudication controls: Resolve Case or Escalate to Director.
  - Complainant identity protection banner.
- **Department Faculty & Student Roster (`AdminUserManagement`).**
- **Department Circulars & Polls (`AdminNoticeManagement`, `AdminPollManagement`).**

### 3.3 Scope 3: Executive Director Desk
- **Directorate Statutory Appeals Desk (`DirectorAppealDesk`):**
  - Final institutional grievance authority (Ombudsman).
  - Adjudicates direct director petitions and escalated HOD complaints.
  - 7-day tribunal SLA compliance timer.
  - Executive order dispatch actions.
- **Campus-Wide Overview (`HodGrievanceDesk`).**

---

## 4. Right-Hand Telemetry & Architecture Rail (1/3 Column)

1. **Governance Metrics Gauge (`ConcentricProgress`):**
   - Circular concentric vector gauge:
     - Outer Ring: IAM Verification (100.0%, Royal Blue `#2563eb`).
     - Inner Ring: Platform Uptime (99.9%, Emerald Green `#10b981`).
     - Center Readout: `99.9% Uptime SLA`.
     - Sub-metrics: Access Model (Closed IAM), SLA Target (48h Resolution).
2. **Recent Administrative Activity (`AdminRecentActivity`):**
   - Real-time audit log of user provisioning and role promotions.
3. **Administrative Governance Card:**
   - Console role, assigned administrative domain, and authorization gate (`DOC-AUTH-005`).
4. **System Architecture Assurance Card:**
   - Clerk JWT status, MongoDB Atlas replica cluster, and Svix cryptographic webhook bridge.

---

## 5. Super-Admin Harmonization

`src/app/(super-admin)/super-admin/dashboard/page.tsx` was harmonized to replace hardcoded rose/purple colors with:
- Approved light-blue background glows (`primary/10`).
- Frosted glass cards (`variant="glass"`).
- Emergency broadcast, IAM governance, and system telemetry modules styled with royal-blue and cyan accents.
