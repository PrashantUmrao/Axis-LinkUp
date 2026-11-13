# Responsive Design Guidelines & Viewport Standards
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Overview & Philosophy

Axis LinkUp is engineered to provide an uncompromising, high-clarity academic and administrative experience across all device form factors. Rather than designing for rigid screen breakpoints, the application employs a **fluid, mobile-first responsive architecture** that adapts gracefully across arbitrary viewport widths ranging from **320px ultra-compact mobile** to **1600px+ ultrawide workstations**.

---

## 2. Tested Viewport Matrix

| Category | Viewport Width | Representative Devices | Layout Behavior |
| :--- | :--- | :--- | :--- |
| **Mobile Compact** | `320px` | iPhone SE (1st gen), compact Androids | Single column, 16px padding, hidden sidebars, slide-over drawer, stacked action buttons |
| **Mobile Standard** | `375px` | iPhone SE (2nd/3rd gen), iPhone mini | Single column, 16px padding, 40-44px touch targets, full-width cards |
| **Mobile Modern** | `390px` | iPhone 12/13/14/15/16 | Single column, responsive typography, stacked hero identity |
| **Mobile Large** | `430px` | iPhone Pro Max, Samsung Galaxy S Ultra | Single column, comfortable padding, horizontal credential chips |
| **Tablet Portrait** | `768px` | iPad (9th/10th gen), iPad mini | 2-column metric grids, collapsible sidebar (w-20 or w-64), topbar breadcrumbs active |
| **Tablet Landscape**| `820px` – `1024px` | iPad Air, iPad Pro 11" | 2-column cards, collapsible sidebar, full topbar controls |
| **Laptop Standard** | `1280px` – `1440px` | MacBook Air, ThinkPad X1 Carbon | 3-column asymmetric layout (2-col main + 1-col sidebar), 4-col metrics |
| **Desktop / Wide**  | `1600px+` | Dell UltraSharp, Apple Studio Display | Contained max-width (`max-w-7xl` / `max-w-(--breakpoint-2xl)`), ambient radial glows |

---

## 3. Structural Responsive Rules

### 3.1 Zero Horizontal Overflow Enforcement
Horizontal scrolling on body/root viewports is prohibited:
```css
/* AppShell root container */
.app-shell-root {
  width: 100%;
  min-height: 100vh;
  overflow-x: hidden;
}

/* Flex child min-width override */
main {
  width: 100%;
  min-width: 0;
  flex: 1 1 0%;
}
```
- Long user identifiers, emails, and staff IDs use `truncate`, `min-w-0`, and `break-words`.
- Flex containers containing tables or grids declare `min-w-0` to avoid default `min-width: auto` flex overflow.

### 3.2 Responsive Container Padding
All pages are encapsulated within `ContentContainer`:
```tsx
<div className="mx-auto w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl">
```
- **Mobile (`< 640px`):** `px-4 py-6` (16px gutter) maximizing usable screen real estate.
- **Tablet (`640px – 1023px`):** `sm:px-6` (24px gutter).
- **Desktop (`>= 1024px`):** `lg:px-8` (32px gutter).

### 3.3 Dashboard Hero Banners
Hero welcome banners use adaptive internal padding:
```tsx
className="glass-panel relative overflow-hidden rounded-2xl p-4 shadow-md sm:p-6 lg:p-8"
```
- `p-4` on mobile ensures compact screens (`320px` – `375px`) maintain at least `288px` of usable internal width without text clipping.
- `sm:p-6 lg:p-8` expands breathing room on larger displays.

### 3.4 Responsive Card Grids
- **Overview Metrics:** `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`
  - Mobile: 1 card per row.
  - Tablet: 2 cards per row.
  - Desktop: 4 cards per row.
- **Main Dashboard Cockpit:** `grid grid-cols-1 gap-6 lg:grid-cols-3`
  - Left Column (`lg:col-span-2`): Coursework, roster, notices, and quick actions.
  - Right Column (`space-y-6`): Activity timeline, calendar, and governance boundary cards.

---

## 4. Navigation Adaptation

### 4.1 Desktop & Tablet Sidebar (`Sidebar`)
- **Width:** `w-64` expanded; `w-20` rail collapsed.
- **Toggle Mechanism:** Panel button in sticky topbar with state persistence in `localStorage`.
- **Breakpoint:** Visible on `md:flex` (`>= 768px`), hidden below.

### 4.2 Mobile Slide-Over Drawer (`MobileDrawer`)
- **Trigger:** Hamburger menu button in sticky topbar on `< md`.
- **Dimensions:** `w-72 max-w-[85vw]` with `overflow-hidden`.
- **Auto-Dismiss:** Closes automatically on route navigation change (`usePathname`), backdrop tap, or `Escape` keypress.
- **Touch Targets:** Minimum 44px height (`min-h-[44px]`) on all mobile links.

---

## 5. Touch Targets & Interaction Ergonomics

In compliance with mobile accessibility and ergonomic guidelines (WCAG 2.5.5 / Apple Human Interface Guidelines / Material Design):
- Primary touch targets have a minimum dimension of **44 × 44 pt** (`min-h-[44px]`).
- Secondary toolbar icon buttons use `size-9` (36px) with an expanded hit-box.
- All interactive controls feature visible focus rings (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden`).

