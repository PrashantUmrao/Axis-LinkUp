# Architecture Decision Record (ADR)
## ADR-002: Primary Database — MongoDB Atlas & Mongoose

> **Status:** Proposed / Under Review (Recommendation)  
> **Date:** November 2026  
> **Deciders:** Senior Software Architect, Database Lead  
> **Target System:** Axis LinkUp Persistence Layer  

---

## 1. Context & Problem Statement

Axis LinkUp requires a primary persistence engine capable of managing a wide variety of data structures:
- Highly structured academic data (courses, departments, timetables).
- Polymorphic dynamic data (Student Request Tracker forms with category-specific custom fields, notice attachment arrays, dynamic poll configurations).
- Fast-evolving schemas during early MVP iterations.
- Strict compliance with the Indian Digital Personal Data Protection (DPDP) Act requiring Indian cloud data residency.

In Phase 1.1, PostgreSQL was initially surveyed. In Phase 1.2, **MongoDB Atlas with Mongoose** is proposed for architectural evaluation.

---

## 2. Decision Drivers

- **Dynamic Form Modeling:** The Student Request Tracker (MOD-13) requires handling disparate request schemas (bonafide certificate vs. leave slip vs. lab access) without complex relational schema migrations.
- **Embedded Document Performance:** Displaying notices with embedded attachments and read receipt counts in a single atomic read operation without expensive multi-table SQL joins.
- **Data Residency Compliance:** MongoDB Atlas offers dedicated managed clusters in AWS Mumbai (`ap-south-1`).
- **Developer Velocity with TypeScript:** Mongoose 8+ provides strong TypeScript schema inference, validation hooks, and robust ODM query helpers.

---

## 3. Options Considered

### Option 1: Relational Database (PostgreSQL with Prisma / Drizzle)
- **Pros:** Native foreign key constraints, strict relational schema enforcement, standardized SQL query syntax.
- **Cons:** Rigid schema migrations; storing dynamic request forms requires complex JSONB columns that lose relational typing benefits; complex joins for hierarchical document structures (e.g. notices with attachments).

### Option 2: Document Database (MongoDB Atlas with Mongoose - Recommended)
- **Pros:** 
  - Natural JSON document storage that maps directly to Next.js JavaScript objects.
  - Excellent support for polymorphic form data in `service_requests`.
  - Atomic document updates and embedded arrays (e.g., ticket comments, notice attachments).
  - Multi-document ACID transactions supported in MongoDB Atlas replica sets.
  - Native TTL indexing for automatic notice expiration and session cleanups.
- **Cons:** 
  - Lack of engine-level foreign key cascade deletion (must be handled via Mongoose middleware or application logic).
  - Risk of inconsistent schemas if strict Mongoose validation schemas are bypassed.

---

## 4. Proposed Decision

**Adopt Option 2: MongoDB Atlas (Hosted in AWS Mumbai `ap-south-1`) with Mongoose 8+.**

MongoDB Atlas will serve as the primary database. Mongoose will enforce strict schema definitions, custom validation rules, and relationship references (`ObjectId` with `ref`).

---

## 5. Advantages & Positive Consequences

1. **Flexibility for Custom Workflows:** Accommodates institutional forms, custom request fields, and rich markdown content effortlessly.
2. **Read Performance:** Pre-joined document embeddings minimize query latency, keeping 95% of standard read queries `<50ms` (NFR-PERF-04).
3. **Data Residency Compliance:** AWS Mumbai cluster configuration satisfies all Indian DPDP Act regulatory mandates.
4. **Serverless Scalability:** Connection pooling managed via cached singleton Mongoose connection to prevent cold-start saturation on Vercel.

---

## 6. Disadvantages & Negative Consequences

1. **No Native Cascading Deletes:** Deleting a Course does not automatically delete related Assignments at the database engine level. This must be managed defensively within repository methods or Mongoose `pre('deleteOne')` middleware hooks.
2. **Schema Drift Risk:** Unchecked direct database writes could bypass application-level validation. Mitigated by restricting direct database access to application service roles only.

---

## 7. Mitigation Strategies & Future Considerations

- **Strict Mongoose Schema Validation:** All Mongoose schemas will enable `strict: 'throw'`, mandatory timestamps, and explicit enum validators.
- **Multi-Document Transactions:** Operations requiring multi-collection consistency (e.g., approving a request while logging an audit record) will be wrapped in Mongoose transaction sessions.
- **Institutional Review Gate:** If campus stakeholders mandate strict SQL-only compliance during Phase 1.3, the repository layer abstraction ensures business logic remains unaffected if a transition to PostgreSQL is ever required.

