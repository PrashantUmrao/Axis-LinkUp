# Navigation Architecture Subsystem
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Subsystem Architecture

The navigation system for **Axis LinkUp** is organized under `src/components/navigation/` with centralized configuration in `src/config/navigation.ts`.

```
src/
├── config/
│   └── navigation.ts       # Master navigation registry, portal metadata, and breadcrumb resolver
└── components/
    └── navigation/
        ├── nav-icons.tsx       # Dynamic SVG icon dispatcher (Lucide React)
        ├── sidebar.tsx         # Desktop and tablet collapsible sidebar rail
        ├── topbar.tsx          # Sticky frosted glass top navigation bar
        ├── mobile-drawer.tsx   # Mobile slide-over drawer with glass backdrop
        ├── user-menu.tsx       # Clerk-integrated profile dropdown menu
        └── index.ts            # Navigation barrel export
```

---

## 2. Centralized Registry (`src/config/navigation.ts`)

Navigation items are statically defined in `MASTER_NAVIGATION_ITEMS`, preventing ad-hoc route declarations across individual components.

### 2.1 Navigation Item Schema
```typescript
export interface NavItem {
  id: string;
  title: string;
  href: string;
  iconName: string;
  roles: UserRole[];
  permission?: Permission;
  badge?: string;
  disabled?: boolean;
  category: 'primary' | 'modules' | 'account';
  description?: string;
}
```

### 2.2 Portal Metadata (`ROLE_PORTAL_METADATA`)
Each collegiate persona is assigned distinct visual branding within the shell:

| Role | Portal Title | Portal Subtitle | Default Dashboard | Badge Variant |
| :--- | :--- | :--- | :--- | :--- |
| `student` | Axis LinkUp | Student Portal | `/student/dashboard` | `info` (Sky Blue) |
| `faculty` | Axis LinkUp | Faculty Cockpit | `/faculty/dashboard` | `success` (Emerald) |
| `admin` | Axis LinkUp | Department Console | `/admin/dashboard` | `warning` (Amber) |
| `super_admin` | Axis LinkUp | Central Executive Console | `/super-admin/dashboard` | `destructive` (Purple) |

---

## 3. Component Details

### 3.1 `Sidebar` (`src/components/navigation/sidebar.tsx`)
- **Dual Display Modes:**
  - Expanded (`w-64`): Full institutional crest, title, subtitle, category headers (`Workspace`, `Modules`, `Settings`), item labels, and badges.
  - Collapsed (`w-20`): Compact crest, centered icon rails, and Radix UI `Tooltip` overlays on hover/focus.
- **Active Route Highlighting:** Evaluates Next.js `usePathname()`. Active routes receive `bg-primary/15 text-primary border-primary font-semibold shadow-xs`.
- **Keyboard & Screen Reader Support:** Employs semantic `<nav>` landmarks, `role="navigation"`, and `aria-current="page"`.

### 3.2 `Topbar` (`src/components/navigation/topbar.tsx`)
- **Breadcrumbs:** Dynamic trail resolved via `getBreadcrumbsForPath(pathname, role)` displaying portal root, current module, and action views with chevron separators.
- **Toggles:** Mobile drawer trigger (`Menu`) and desktop sidebar toggle (`PanelLeft` / `PanelLeftClose`).
- **Theme Switcher:** Inlines `ThemeToggle` (`icon-button` mode) from the Part 4.1 theme subsystem.
- **User Profile Trigger:** Triggers `UserProfileMenu`.

### 3.3 `MobileDrawer` (`src/components/navigation/mobile-drawer.tsx`)
- **Slide-Over Panel:** Full-height glass panel on the left with backdrop overlay blur (`backdrop-blur-xs bg-black/50`).
- **Automatic Navigation Dismissal:** Listens to `usePathname()` and automatically closes upon client route navigation.
- **Escape Key Handling:** Listens for `keydown` (Key: `Escape`) and unmounts the drawer immediately.
- **Scroll Locking:** Disables `document.body.style.overflow` while the drawer is open.

### 3.4 `UserProfileMenu` (`src/components/navigation/user-menu.tsx`)
- **Clerk Authentication Integration:** Leverages Clerk client hooks (`useUser()`, `useClerk()`) with server-passed session fallbacks.
- **Display Details:**
  - User's verified name (e.g., "Prashant Umrao").
  - Primary email (e.g., "theprashantumrao@gmail.com").
  - User avatar image with automatic two-letter initials fallback (e.g., "PU").
  - Role badge matching portal metadata.
- **Actions:**
  - Link to `/shared/profile` (Profile & Settings).
  - Institutional IAM verification notice ("AITM Institutional IAM Verified").
  - Sign Out action calling `clerk.signOut({ redirectUrl: '/sign-in' })`.

---

## 4. Strict Placeholder Governance

To comply with Part 4.2 requirements prohibiting fake features or broken 404 links:
1. **No Fake Routes:** Non-implemented feature modules (e.g., Notices, Assignments, Calendar, Spaces) are explicitly marked `disabled: true` with `badge: "Phase 5"`.
2. **Disabled Styling & Tooltips:** Disabled items render at 50%–55% opacity with `cursor-not-allowed` and an informative tooltip ("Module planned for Phase 5 implementation") instead of linking to non-existent URLs.
3. **Search & Notification Placeholders:** The topbar search trigger (`Cmd+K`) and notification bell are presented as non-functional placeholders with tooltips indicating future availability in Phase 5.

