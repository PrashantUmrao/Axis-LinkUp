# AXIS LINKUP — GROUP MESSAGING DESIGN SPECIFICATION
**Document ID:** `SPEC-UI-015`  
**Phase:** 4.8.6 (Chat, Groups & Complaints UI Design)  
**Status:** Approved & Implemented  
**Component:** `CreateGroupDialog`, `ChatInfoPanel`, `ChatSidebar`  

---

## 1. Executive Summary

Faculty-created Academic Groups form the core academic communication layer of Axis LinkUp. In compliance with the Phase 4.8.2 Access Control & Communication Workflow:
- **Strict Role Boundaries:** Only verified **Faculty** (and Super Admins) have authorization to create academic groups or add student members.
- **Student Restrictions:** Students are members of groups assigned to their courses; they **cannot** create groups, add unauthorized members, or alter group governance.
- **Channel Policies:** Groups support two operational policies:
  1. `Broadcast Only`: Official notices and coursework releases; only faculty moderators can post.
  2. `Open Discussion`: Peer queries and coursework discussion among verified class members.

---

## 2. Group Creation Interface (`CreateGroupDialog`)

Accessible exclusively to faculty members via the "New Group" trigger in the chat sidebar:
- **Group Title & Auto-Handle:** Input with real-time lowercase handle preview (e.g. `@cse301_batch_a`).
- **Objectives & Description:** Multi-line text field detailing coursework focus.
- **Communication Policy Toggle:**
  - *Broadcast Only:* Single-speaker announcement channel.
  - *Open Discussion:* Multi-member collaborative channel.
- **Student Roster Search & Multi-Select:**
  - Real-time search by registered student name.
  - Interactive chip capsule list showing selected students with one-click remove (`X`).
  - Dropdown selection list with "Add" action.
- **Faculty Governance Affirmation:**
  - Visual security badge indicating active faculty moderation.
  - Modal confirmation button (`Create Channel`).

---

## 3. Student Group Experience

When a student accesses an academic group:
1. **Joined Groups Feed:** Filtered in sidebar under the "Groups" tab.
2. **Channel Policy Indicator:** Explicit pill badge in conversation header.
3. **Restricted Input Warning:** In `Broadcast Only` channels, the input composer is disabled and replaced with:
   > 🔇 *This academic group is in Broadcast-Only mode. Only verified faculty moderators may post.*
4. **Member Roster Inspection:** Students can open the right info panel to view the faculty moderator and enrolled classmates, but cannot add or remove peers.

---

## 4. Security & ABAC Alignment

- Implements `PERMISSIONS.CHAT_MODERATE_MESSAGES` and `PERMISSIONS.CHAT_SEND_COURSE_MESSAGE`.
- Preserves Clerk JWT claims and MongoDB user models.
- Backend group persistence and socket events will be integrated in Phase 5.
