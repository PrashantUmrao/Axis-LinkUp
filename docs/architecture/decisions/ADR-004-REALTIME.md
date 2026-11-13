# Architecture Decision Record (ADR)
## ADR-004: Real-Time Communication Engine — Ably Realtime

> **Status:** Proposed / Under Review (Recommendation)  
> **Date:** November 2026  
> **Deciders:** Senior Software Architect, Network & Realtime Lead  
> **Target System:** Axis LinkUp Real-Time Messaging & Broadcast Layer  

---

## 1. Context & Problem Statement

Axis LinkUp requires low-latency, bi-directional communication for:
- Course discussion channels and 1-on-1 messaging (MOD-08).
- Live in-app notifications and unread badge counters (MOD-17).
- Instant ticket status transitions (MOD-13).
- Campus-wide Emergency Mode broadcasts requiring sub-100ms client screen takeovers (MOD-16).
- Faculty online presence indicators.

Because the core application is hosted on Vercel's serverless infrastructure, long-lived persistent WebSocket connections cannot terminate directly on the application servers (serverless functions spin down after processing individual HTTP requests).

---

## 2. Decision Drivers

- **Serverless Compatibility:** The real-time engine must decouple WebSocket client connections from serverless compute instances.
- **High-Gravity Emergency Reliability (MOD-16):** Emergency alerts must reach thousands of active campus screens instantly with guaranteed message ordering and delivery.
- **Granular Token Authorization:** Capabilities must restrict students from publishing to unauthorized course or administrative channels.
- **Campus Network Resilience:** Seamless connection recovery during campus Wi-Fi drops as students transit between lecture halls.

---

## 3. Options Considered

### Option 1: Self-Hosted Socket.io + Redis Pub/Sub on Dedicated VM
- Deploy dedicated Node.js servers on AWS EC2 or DigitalOcean Droplets behind an ALB with sticky sessions.
- **Pros:** Full ownership of code and data, predictable fixed hosting server costs.
- **Cons:** High DevOps burden (clustering, continuous monitoring, auto-scaling, OS security patches); single point of failure if the self-hosted broker crashes during an emergency.

### Option 2: Pusher Channels
- Managed real-time service.
- **Pros:** Easy integration, widespread usage.
- **Cons:** Lacks robust message continuity and stream history on standard tiers; higher latency guarantees compared to Ably; presence protocol is less granular.

### Option 3: Ably Realtime (Recommended)
- Globally distributed, managed real-time messaging broker built on a fault-tolerant multi-region cluster.
- **Pros:**
  - 99.999% uptime SLA.
  - Native integration with serverless backends (publish via REST API; clients listen via WebSockets).
  - Fine-grained token capabilities generated dynamically per user based on course enrollments.
  - Built-in connection recovery buffer: replays missed messages if client drops connection for up to 2 minutes.
  - Automatic fallback to HTTP Long Polling if campus firewalls block WebSocket traffic.
- **Cons:** Usage-based pricing model once usage exceeds the monthly free tier (3 million messages/month).

---

## 4. Proposed Decision

**Adopt Option 3: Ably Realtime as the Real-Time Message Broker.**

Browser clients will establish persistent WebSocket connections directly to Ably’s edge. The Next.js serverless backend will mint capability-restricted tokens via an auth endpoint and publish events to Ably statelessly over its REST SDK.

---

## 5. Advantages & Positive Consequences

1. **Serverless Architecture Harmony:** Perfectly decouples stateless Vercel Serverless compute from stateful WebSocket connections.
2. **Sub-150ms Delivery (NFR-PERF-03):** High-speed event fan-out across all active sessions.
3. **Emergency Blast Reliability:** Delivers campus-wide emergency directives to 5,000 active devices in milliseconds without bottlenecking application database connections.
4. **Campus Firewall Immunity:** Built-in protocol fallback ensures students behind restrictive campus proxy servers still receive updates via HTTP long-polling.

---

## 6. Disadvantages & Negative Consequences

1. **Third-Party Service Dependency:** Requires external network connectivity to Ably edge endpoints.
2. **Cost Thresholds:** High message volume during peak semester chat activity could exceed free tier limits, necessitating an upgraded tier.

---

## 7. Mitigation Strategies & Future Considerations

- **Server-Mediated Chat Publishing:** All chat messages are sent to a Next.js Server Action first, saved in MongoDB, and then published to Ably. This ensures message persistence remains independent of Ably's retention limits and allows strict server-side content moderation.
- **Message Debouncing:** Client typing indicators and badge updates are debounced (max 1 event every 2 seconds) to conserve message volume quotas.
- **Hybrid Local Fallback Evaluation:** If institutional leadership prefers zero third-party messaging costs in Phase 3, the service abstraction layer (`RealtimeService`) allows swapping Ably for a campus-hosted Socket.io cluster without rewriting frontend UI components.

