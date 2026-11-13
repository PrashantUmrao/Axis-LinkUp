# Architecture Decision Record (ADR)
## ADR-007: Real-Time Communication Engine — Ably Realtime

> **Status:** Proposed / Under Review (Recommendation)  
> **Date:** November 2026  
> **Deciders:** Senior Full-Stack Architect, Realtime & Network Lead  
> **Target System:** Axis LinkUp Real-Time Messaging & Broadcast Infrastructure  

---

## 1. Context & Problem Statement

Axis LinkUp requires bi-directional real-time communication for:
- Course discussion channels and student-faculty messaging (MOD-08).
- Live in-app notifications and unread badge counters (MOD-17).
- Instant service request status changes (MOD-13).
- Sub-100ms campus Emergency Mode broadcast takeovers (MOD-16).
- Faculty online/office hours presence indicators.

Because the core application is hosted on Vercel's serverless infrastructure, persistent stateful WebSocket connections cannot terminate on the application compute layer.

---

## 2. Decision Drivers

- **Serverless Decoupling:** Enable browser clients to maintain persistent WebSocket connections without requiring stateful application servers.
- **Mission-Critical Broadcast Reliability:** Emergency Mode alerts must reach 5,000 active sessions with guaranteed sub-100ms delivery and message ordering.
- **Granular Token Authorization:** Enforce strict channel capability tokens ensuring students can only subscribe to their enrolled classes.
- **Campus Network Resilience:** Flaky mobile signals and campus Wi-Fi drops must be handled gracefully without message loss.

---

## 3. Options Considered

### Option 1: Self-Hosted Socket.io + Redis Cluster on Dedicated VM
- Standalone Node.js server cluster deployed on AWS EC2 or DigitalOcean.
- **Pros:** Full ownership of code and data; fixed monthly server hosting cost.
- **Cons:** High DevOps overhead (OS patching, cluster load-balancing with sticky sessions, Redis sentinel configuration); single point of failure during campus emergencies if the VM cluster crashes.

### Option 2: Firebase Realtime Database / Firestore Listeners
- Google managed NoSQL database with real-time client listeners.
- **Pros:** Broad adoption, easy SDK integration.
- **Cons:** Pricing scales rapidly with read operations; lacks fine-grained channel presence; less suitable as an ephemeral pub/sub event bus compared to dedicated brokers.

### Option 3: Ably Realtime (Recommended)
- Globally distributed, managed real-time messaging broker with 99.999% SLA.
- **Pros:**
  - Decouples serverless backends: Next.js publishes statelessly via REST API; clients subscribe via WebSockets.
  - Ephemeral token minting guarantees fine-grained channel capabilities.
  - Built-in reconnection buffer replays missed messages during campus Wi-Fi drops.
  - Automatic fallback to HTTP long-polling if campus firewalls block WebSockets.
- **Cons:** Third-party cloud service; message quotas apply once free tier is exceeded.

---

## 4. Proposed Decision

**Adopt Option 3: Ably Realtime as the Dedicated Real-Time Message Broker.**

Next.js Server Actions will save chat and alert messages in MongoDB first, then publish the event statelessly to Ably via its REST SDK for immediate fan-out to connected clients.

---

## 5. Advantages & Positive Consequences

1. **Perfect Serverless Synergy:** Vercel functions remain 100% stateless and scalable.
2. **Emergency Reliability:** Emergency broadcasts bypass application server bottlenecks, broadcasting directly from Ably's global edge network.
3. **Firewall Immunity:** Automatic fallback to HTTP long-polling ensures students behind restrictive campus proxy servers still receive updates.

---

## 6. Disadvantages & Negative Consequences

1. **Vendor Dependency:** Platform relies on Ably for real-time delivery (mitigated by Ably's 99.999% uptime track record).

---

## 7. Mitigation Strategies & Future Considerations

- **Server-Mediated Persistence:** Messages are stored in MongoDB before dispatching to Ably, ensuring message history is never lost even if Ably is temporarily unreachable.
- **Usage Throttling:** Client typing indicators and badge pings are debounced to conserve message volume quotas.

