# Architecture Decision Record (ADR)
## ADR-011: Data Retention, Archiving & DPDP Act Compliance

> **Status:** Approved Baseline (Phase 1, Part 1.4)  
> **Date:** November 2026  
> **Deciders:** Senior Database Architect, Institutional Compliance Officer  
> **Target System:** Axis LinkUp Data Governance & Storage Engine  

---

## 1. Context & Problem Statement

Axis LinkUp stores high volumes of academic, operational, and personal data: student identity records, attendance, assignment submissions, chat conversations, administrative desk requests, and security audit logs.

We face competing regulatory and operational requirements:
1. **Academic Regulatory Audits (NAAC / NBA / NIRF):** Institutional accreditation bodies require retaining student academic records, marks, and official requisitions for a minimum of 3 to 5 years.
2. **Indian Digital Personal Data Protection (DPDP) Act, 2023:** Mandates that personally identifiable information (PII) must not be retained indefinitely once the original purpose has been fulfilled, and grants users the right to grievance redressal and data erasure.
3. **Database Performance & Storage Costs:** Unbounded retention of ephemeral chat messages and temporary notices degrades database performance and increases hosting expenses.

---

## 2. Decision Drivers

- **Legal Compliance:** Strict alignment with the DPDP Act (2023) and AICTE / university retention guidelines.
- **Audit Immutability:** Security audit logs must remain unalterable and accessible for 3 years.
- **Accidental Deletion Prevention:** Critical student requisitions and evaluations must never be lost due to accidental clicks.
- **Storage Tier Optimization:** Keep primary database collections lean and fast by archiving historic data.

---

## 3. Options Considered

### Option 1: Indefinite Data Accumulation (Never Delete Anything)
- Store all documents in primary MongoDB collections indefinitely.
- **Pros:** Zero risk of missing historic data.
- **Cons:** Violates Indian DPDP Act data minimization principles; database collections grow exponentially; increases cloud backup and storage costs.

### Option 2: Immediate Hard Deletion
- Permanently purge documents upon user request or expiration.
- **Pros:** Minimal storage footprint.
- **Cons:** Catastrophic for institutional compliance; violates accreditation audit requirements; loss of historical context if a grade or certificate is contested.

### Option 3: Tiered Data Lifecycle with Soft Deletion & PII Anonymization (Recommended)
- Implement a three-tiered lifecycle:
  1. *Operational Tier (Live Database):* Active records, soft-deleted flags (`isDeleted: true`), and TTL indexes for temporary bulletins.
  2. *Cold Archival Tier (Read-Only S3 / Compressed Storage):* Historic records moved after the academic term ends.
  3. *Anonymization / Purge Tier:* PII fields purged after the 5-year accreditation window expires, preserving only anonymized academic transcripts.

---

## 4. Decision

**Adopt Option 3: Tiered Data Lifecycle with Soft Deletion and DPDP-Compliant Anonymization.**

1. **Soft Deletion:** Chat messages, courses, and user accounts utilize `isDeleted: true`. Hard deletion from live collections is prohibited.
2. **Automated TTL Expiry:** Temporary notices automatically expire and archive via MongoDB TTL indexes on `expiresAt`.
3. **Audit Log Lockout:** `audit_logs` are write-once, append-only, and retained for exactly 3 years before automated cold storage archiving.
4. **Graduation / Alumni Anonymization:** Five years post-graduation, a student's personal phone number, avatar, and proof attachments are permanently purged from Cloudinary and MongoDB, preserving only unlinked academic degree completion data.

---

## 5. Advantages & Positive Consequences

1. **Ironclad Legal Compliance:** Fully satisfies both Indian DPDP Act privacy mandates and institutional accreditation rules.
2. **Protection from Operator Error:** Accidental deletions can be reversed by an administrator within the soft-delete grace window.
3. **Predictable Database Footprint:** Primary database storage remains below 2GB indefinitely, preserving sub-50ms query speeds.

---

## 6. Disadvantages & Negative Consequences

1. **Query Filtering Overhead:** Repository queries must consistently filter `{ isDeleted: false }` to avoid returning soft-deleted records to active UI views.

---

## 7. Mitigation Strategies & Future Considerations

- **Mongoose Global Plugins:** Register a soft-delete plugin across all relevant Mongoose schemas that automatically injects `{ isDeleted: false }` into `find`, `findOne`, and `countDocuments` queries by default.
- **Automated Archival Scripts:** Implement automated monthly background archival jobs during Phase 3 to migrate inactive records to cold compressed storage.

