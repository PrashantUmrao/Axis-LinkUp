# AXIS LINKUP — CHAT INTERFACE DESIGN SPECIFICATION
**Document ID:** `SPEC-UI-014`  
**Phase:** 4.8.6 (Chat, Groups & Complaints UI Design)  
**Status:** Approved & Implemented  
**Routes:** `/student/messages`, `/faculty/messages`, `/admin/messages`  

---

## 1. Executive Summary

The Internal Chat interface delivers an institutional communication platform inspired by **WhatsApp Web** architecture, styled with Reference 1's light-blue frosted glassmorphism (`#edf5fd` in light mode, `#08111f` in dark mode) and Reference 2's density and layout balance.

It features a 3-column responsive layout:
1. **Left Sidebar:** Conversation feed, search filter, and category pills.
2. **Center Canvas:** Active conversation header, chronological message history bubbles, attachments, and composer.
3. **Right Drawer:** Contact profile and institutional conduct governance.

---

## 2. Layout & Component Architecture

### 2.1 Left Sidebar (`ChatSidebar`)
- **Heading & Status:** "Messages" with AITM campus network status indicator.
- **Search Bar:** Real-time filter matching contact names, `@handles`, or message body snippets.
- **Category Filter Tabs:**
  - `All`: Complete conversation docket.
  - `Direct`: One-on-one proctorial and student advisories.
  - `Groups`: Faculty-moderated academic channels.
- **Conversation List Items:**
  - Avatar with online green badge indicator (or group dual-user icon).
  - User Name & Role / Department.
  - Last message timestamp formatted in Indian standard time.
  - Unread message counter badge (`rounded-full bg-primary text-primary-foreground`).
  - Read receipt checkmarks (`CheckCheck`).

### 2.2 Center Conversation View (`ChatConversationView`)
- **Conversation Topbar:**
  - Back navigation chevron for mobile screens.
  - Contact avatar, name, verified handle, and online availability status.
  - Channel policy badge (`Broadcast Only` vs `Discussion`).
  - Information panel toggle button.
- **Message Stream:**
  - Date separator capsule (`Today`).
  - **Own Messages (`isOwn: true`):** Aligned right, rounded-2xl with `rounded-tr-xs`, royal-blue surface (`bg-primary text-primary-foreground`), white timestamp, and delivery ticks.
  - **Incoming Messages (`isOwn: false`):** Aligned left, rounded-2xl with `rounded-tl-xs`, frosted glass surface (`bg-card/75 backdrop-blur-md border border-glass-border`), sender name, role chip, dark/light contrast text, and timestamp.
  - **Attachment Cards:** Coursework documents (PDF/images) with file name, size chip, and download/preview icon.
- **Message Composer:**
  - Paperclip attachment trigger.
  - Emoji picker toggle.
  - Clean input field with focus ring.
  - Send pill button (`variant="pill-primary"`).
  - Broadcast restriction gate: When a student opens a broadcast-only channel, composer input is locked with a warning notice: *"This academic group is in Broadcast-Only mode. Only verified faculty moderators may post."*

### 2.3 Right Information Drawer (`ChatInfoPanel`)
- Contact photo, full name, institutional handle, and verified department.
- Channel policy summary.
- Enrolled members count and roster.
- AITM institutional privacy and IT Code of Conduct advisory.

---

## 3. Responsive Breakpoints

| Breakpoint | Width | Behavior |
| :--- | :--- | :--- |
| **Mobile** | `< 768px` | Single-column view; tapping a conversation smoothly slides in the conversation canvas; back button returns to sidebar. |
| **Tablet** | `768px - 1023px` | Fixed 320px sidebar + flex conversation canvas; info panel collapses into a sliding sheet. |
| **Desktop** | `≥ 1024px` | Full multi-column layout; sidebar (320px) + conversation canvas (flex-1) + optional info panel (320px). |

---

## 4. Truth-in-UI & Backend Boundaries

In accordance with Phase 4.8.6 mandates, no mock messaging engine has been fabricated:
- Authenticated user session identity (`session.userId`, `session.fullName`) is bound directly to sent messages.
- Real-time WebSocket synchronization is scheduled for Phase 5; the UI currently maintains local conversation state during the active browser session.
