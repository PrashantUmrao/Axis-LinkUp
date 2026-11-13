# AXIS LINKUP — COMPLAINT DETAIL DESIGN SPECIFICATION
**Document ID:** `SPEC-UI-017`  
**Phase:** 4.8.6 (Chat, Groups & Complaints UI Design)  
**Status:** Approved & Implemented  
**Component:** `ComplaintDetailModal`  

---

## 1. Executive Summary

The Complaint Detail View (`ComplaintDetailModal`) provides a comprehensive statutory docket interface for examining petition facts, inspecting student credentials, tracking inquiry status, and maintaining an immutable chronological record of official authority findings.

---

## 2. Docket Component Sections

### 2.1 Header & Status Ribbon
- **Statutory Reference:** Canonical ticket identifier (e.g. `CMP-2026-0042`).
- **Status Badge:** Dynamic pill badge (`Submitted`, `Under Review`, `Responded`, `Resolved`, `Escalated to Director`).
- **Classification Badge:** Category chip (e.g. `Lab & Infrastructure`, `Academic & Evaluation`).
- **SLA Countdown Timer:** Live hours-remaining indicator respecting the 48h (HOD) or 7-day (Director) deadlines.
- **Petition Title:** Prominent font-heading typography.

### 2.2 Case Metadata Matrix
- **Complainant Student Dossier:**
  - Full Name.
  - University Roll Number.
  - Institutional Department.
- **Addressed Authority Dossier:**
  - Authority Title & Designated Officer (e.g. `Head of Department (Dr. R. K. Verma)`).
  - Original filing timestamp.

### 2.3 Statement & Facts Narrative
- Unabridged student petition statement rendered in readable monospace/prose with KaTeX math rendering support where applicable.

### 2.4 Supporting Evidence Docket
- List of verified documentary proofs (medical receipts, lab error dumps, grade sheet scans) with one-click inspection.

### 2.5 Chronological Official Response Chain
- **Historical Immutability:** Previous authority responses are preserved chronologically; new responses do not overwrite previous communication.
- **Entry Structure:**
  - Author Name and Institutional Role chip.
  - Response timestamp.
  - Official inquiry findings and directive text.
  - Explicit action taken tag (e.g. `Action: Network Infrastructure Inquiry Opened`, `Action: Ledger Rectification Applied`).

### 2.6 Authority Resolution & Escalation Dock
Available to authorized officers (Faculty, HOD, Director, Admin):
- **Finding & Response Textarea:** Multi-line official comment composer.
- **Record Response Action:** Logs finding to the immutable docket.
- **Resolve Grievance Action:** Changes status to `Resolved` with emerald confirmation.
- **Escalate to Director Action (HOD exclusive):** Forwards case to Executive Director Ombudsman tribunal with instant status update.
