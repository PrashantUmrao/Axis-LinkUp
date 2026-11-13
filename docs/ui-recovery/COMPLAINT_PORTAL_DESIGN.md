# AXIS LINKUP — COMPLAINT PORTAL DESIGN SPECIFICATION
**Document ID:** `SPEC-UI-016`  
**Phase:** 4.8.6 (Chat, Groups & Complaints UI Design)  
**Status:** Approved & Implemented  
**Module Title:** `Complaints & Communication`  
**Routes:** `/student/complaints`, `/faculty/complaints`, `/admin/complaints`  

---

## 1. Executive Summary

The "Complaints & Communication" portal implements the AICTE / UGC statutory Student Grievance Redressal framework for Axis Institute of Technology & Management (AITM), Kanpur.

Inspired by a high-grade internal email system, it establishes a two-tiered institutional grievance redressal ladder:
1. **Tier-1 (Department Authority):** Head of Department (HOD) — 48-hour resolution SLA.
2. **Tier-2 (Appellate Tribunal):** Executive Director (Campus Ombudsman) — 7-day resolution SLA.

Complainant identity is cryptographically bound to the authenticated user profile, completely preventing anonymous or spoofed petitions.

---

## 2. Student Workspace (`StudentComplaintsView`)

Located at `/student/complaints`:
- **Workspace Banner:** Displays collegiate authority, AICTE statutory backing, and a "Compose Complaint" primary action.
- **Summary Metric Row:**
  - `Total Filed`: Historical petition count.
  - `Under Review`: Active petitions pending inquiry.
  - `Official Responses`: Petitions with authority replies awaiting student review.
  - `Resolved`: Successfully closed cases.
- **Status Filter Tabs:** `All Complaints`, `Submitted`, `Under Review`, `Responded`, `Resolved`.
- **Docket Feed Cards:**
  - Reference number (e.g. `CMP-2026-0042`).
  - Status capsule pill.
  - Grievance category badge (`Academic`, `Lab & Infrastructure`, `Harassment`, `Fee/Accounts`, `Administrative`).
  - Addressed authority badge (`HOD` vs `Director`).
  - Submission date & remaining SLA countdown.
  - Subject and narrative preview.
  - "View Docket" trigger opening the detailed tribunal modal.

---

## 3. Complaint Composition (`ComplaintComposeForm`)

- **Complainant Assurance Strip:** Displays student full name, roll number, department, and institutional email from the authenticated user profile.
- **Recipient Selector:**
  - *Head of Department (HOD):* For academic, lab, and departmental matters (48h SLA).
  - *Executive Director (Ombudsman):* For institutional appeals, serious misconduct, or escalated departmental decisions (7-day SLA).
- **Category Chips:** One-click pill selection for grievance classification.
- **Subject & Narrative Inputs:** Structured input fields with character validation and factual guidance.
- **Supporting Proofs Docket:** Optional document attachment control for medical certificates, grade sheets, or error screenshots.
- **Submission Action:** Instant validation and transmission feedback.

---

## 4. Higher Authority Workspaces (`AuthorityComplaintsView`)

### 4.1 Head of Department (HOD) Cockpit (`/faculty/complaints`)
- Filtered to complaints addressed to HOD within the officer's department scope.
- Real-time 48-hour SLA countdown indicator.
- Student identification (Complainant Name, Roll, and Email).
- Authority adjudication tools: Write response, Mark as Resolved, or Escalate to Director.

### 4.2 Executive Director Cockpit (`/admin/complaints`)
- Receives direct petitions and escalated HOD appeals across the campus.
- 7-day statutory ombudsman timer.
- Highest tribunal authority with final binding resolution powers.
