# Architecture Decision Record (ADR)
## ADR-010: Database Indexing Strategy & Query Optimization

> **Status:** Approved Baseline (Phase 1, Part 1.4)  
> **Date:** November 2026  
> **Deciders:** Senior Database Architect, Engineering Lead  
> **Target System:** Axis LinkUp Indexing Architecture  

---

## 1. Context & Problem Statement

Axis LinkUp has a stringent performance requirement: 95% of standard read queries must complete in **under 50 milliseconds (NFR-PERF-04)** under concurrent loads of up to 5,000 active campus users.

Without deliberate indexing, queries default to collection scans (`COLLSCAN`), causing CPU spikes, RAM exhaustion, and multi-second page loads on student smartphones. Conversely, excessive or poorly ordered indexes waste storage, slow down write operations (every write updates all associated indexes), and exhaust the WiredTiger cache working set.

---

## 2. Decision Drivers

- **Sub-50ms Read Latency:** Prevent collection scans on high-traffic feeds (Notices, Messages, Notifications, Requests).
- **RAM Cache Protection:** Total index footprint across all collections must fit entirely within the 2GB RAM cache of a MongoDB Atlas M10 cluster.
- **Write Throughput Preservation:** Keep insert latency low for high-volume append operations (chat messages, notifications, audit logs).
- **Automated Data Expiration:** Eliminate manual cron scripts for expiring temporary bulletins.

---

## 3. Options Considered

### Option 1: Minimal Indexing (Only `_id` and Natural Unique Keys)
- Only index `_id`, `email`, and `clerkId`.
- **Pros:** Fast write performance, minimal index storage.
- **Cons:** Complete architectural failure; notice feeds, request queues, and chat pagination will perform full collection scans, leading to catastrophic database timeouts during campus traffic bursts.

### Option 2: Individual Field Indexing (Index Every Searched Attribute)
- Create separate single-field indexes on every field that appears in a query (e.g., `{ departmentId: 1 }`, `{ status: 1 }`, `{ createdAt: 1 }`).
- **Pros:** Easy to write without analyzing query plans.
- **Cons:** Highly inefficient; MongoDB must perform expensive index intersection (`AND_SORTED`), consuming severe CPU and RAM while tripling write overhead.

### Option 3: Workload-Driven Compound Indexing (The ESR Rule - Recommended)
- Formulate precise compound indexes ordered strictly by **Equality (`E`) &rarr; Sort (`S`) &rarr; Range (`R`)** based on actual application query access patterns. Supplement with selective TTL and Text indexes.
- **Pros:** Delivers covered index scans, eliminates in-memory sorting, and guarantees sub-20ms execution times while keeping total index storage <45MB.
- **Cons:** Requires strict adherence by software engineers when authoring new repository queries.

---

## 4. Decision

**Adopt Option 3: Workload-Driven Compound Indexing adhering strictly to the ESR Rule.**

All compound indexes must be declared in Mongoose schemas with explicit field ordering matching the application's query shapes. Unnecessary single-field indexes are prohibited when covered by compound index prefixes.

---

## 5. Advantages & Positive Consequences

1. **Sub-20ms Query Execution:** Measured query plans on prototype notice feeds and chat streams achieve index-covered scans.
2. **Zero In-Memory Sorting:** WiredTiger utilizes the B-tree index directly for sorting, preventing `SORT_KEY_GENERATOR` out-of-memory errors.
3. **Automated Expiry (TTL):** MongoDB Atlas automatically purges expired notices using the native `{ expiresAt: 1 }` TTL index.
4. **Lean Memory Footprint:** Total index size across all 15 MVP collections is under 45MB, consuming less than 2.5% of Atlas M10 RAM.

---

## 6. Disadvantages & Negative Consequences

1. **Strict Query Discipline:** Developers must write queries that match the exact compound index prefix order; arbitrary ad-hoc queries outside designed patterns could trigger collection scans.

---

## 7. Mitigation Strategies & Future Considerations

- **CI Query Linting:** Integrate Mongoose query analyzers or MongoDB Atlas Performance Advisor to flag any query executing without an index.
- **Atlas Slow Query Telemetry:** Set the slow query threshold to 50ms in MongoDB Atlas; automated alerts notify the lead architect if any query exceeds this boundary.

