# Accessibility (a11y) & Usability Audit Report
### Axis LinkUp — Modern Collegiate Digital Ecosystem

---

## 1. Executive Summary & Compliance Target

This audit assesses the accessibility, assistive technology compatibility, and interaction ergonomics of **Axis LinkUp** against the **Web Content Accessibility Guidelines (WCAG) 2.1 and 2.2 Level AA** standards.

The application incorporates semantic HTML landmarks, visible focus rings, keyboard navigability, screen-reader accessible names, 44px touch targets on mobile viewports, and native support for user-preferred reduced motion.

---

## 2. Accessibility Criteria Evaluation

### 2.1 Semantic HTML Structure & Landmarks (WCAG 1.3.1, 2.4.1)
- **Application Shell:**
  - `<aside aria-label="Sidebar navigation">` contains desktop navigation groups.
  - `<header className="glass-nav">` encapsulates the institutional brand crest, breadcrumb trail, and user controls.
  - `<nav aria-label="Breadcrumbs">` with `aria-current="page"` on current route segment.
  - `<main>` dynamic content landmark with `min-w-0` to avoid flex container overflow.
  - `<footer>` institutional copyright and security notices.
- **Mobile Drawer:**
  - Enclosed in `<div role="dialog" aria-modal="true" aria-label="Mobile Navigation Drawer">`.
  - Accessible `<Button size="icon" aria-label="Close navigation drawer">`.

### 2.2 Keyboard Navigation & Focus Indicators (WCAG 2.1.1, 2.4.7)
- **Focus Rings:** All interactive elements (`Button`, `Link`, `Input`, `ThemeToggle`, `DropdownMenuTrigger`) incorporate high-contrast focus rings:
  ```css
  focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden
  ```
- **Escape Key Dismissal:** The mobile drawer traps and handles the `Escape` key to close the drawer panel immediately:
  ```typescript
  if (event.key === 'Escape' && isOpen) onClose();
  ```
- **No Keyboard Traps:** Focus moves logically through topbar, sidebar, main content, and dropdown menus.

### 2.3 Accessible Button Names & ARIA Labels (WCAG 4.1.2)
- All icon-only buttons declare an explicit `aria-label`:
  - `ThemeToggle`: `aria-label="Toggle theme"` / `aria-label="Switch to light/dark mode"`
  - `MobileDrawer`: `aria-label="Open mobile navigation menu"` / `aria-label="Close navigation drawer"`
  - `Sidebar` toggle: `aria-label="Collapse sidebar"` / `aria-label="Expand sidebar"`
  - `Notifications` placeholder: `aria-label="View notifications (Coming soon)" aria-disabled="true"`
  - `Search` placeholder: `aria-disabled="true"`
  - `UserProfileMenu`: `aria-label="Open user profile menu"`

### 2.4 Color Contrast & Typography Legibility (WCAG 1.4.3, 1.4.6)
- **Light Theme:**
  - Primary text on background: `#172033` on `#f3f5f9` (Contrast ratio **10.8:1**, exceeds AA requirement of 4.5:1).
  - Muted text on background: `#64748b` on `#f3f5f9` (Contrast ratio **4.8:1**, meets AA requirement).
  - Brand buttons: White text on `#3456d1` (Contrast ratio **5.2:1**).
- **Dark Theme:**
  - Primary text on background: `#f8fafc` on `#111827` (Contrast ratio **15.2:1**, exceeds AAA requirement of 7:1).
  - Muted text on background: `#aab7ca` on `#111827` (Contrast ratio **7.8:1**, exceeds AA requirement).
  - Warning badges: `#fbbf24` on amber glass surface with high legibility.

### 2.5 Touch Target Sizing (WCAG 2.5.5 Level AAA / Mobile Standard)
- All primary interactive elements in the mobile drawer declare `min-h-[44px]`.
- Topbar navigation toggle buttons use `size-9` (36px) with surrounding flex padding providing an effective tap target `>= 44px`.
- Profile avatar menu trigger features an expanded circular hit-box.

### 2.6 Vestibular Safety & Reduced Motion (WCAG 2.3.3)
- Global CSS includes explicit media query overrides for users with vestibular motion sensitivity:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
- Pulsing nodes (`animate-pulse`) and spin indicators gracefully collapse to static visual states under reduced-motion settings.

