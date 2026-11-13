# Axis LinkUp — Design System Specification
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Visual Direction:** Premium, Professional, Production-Grade Glassmorphism  
**Color Modes:** Unified Dual-Theme (Light & Dark)  
**Status:** Canonical Foundation Specification (Phase 4.1)  

---

## 1. Design Philosophy & Aesthetic Principles

Axis LinkUp delivers a modern collegiate platform designed for four distinct user personas: **Students, Faculty, Administrators, and Super Administrators**. The interface balances visual prestige with uncompromising utility:

1. **Elegance & Purpose:** Visual elements serve operational clarity. Gradients, frosted glass, and micro-interactions elevate the user experience without cluttering information density.
2. **Controlled Glassmorphism:** Translucent surfaces use calibrated backdrop blur (10px–16px), subtle inner light reflections (`--glass-highlight`), and restrained opacity (70%–72%) to create depth while maintaining strict text legibility.
3. **Contrast & Inclusivity:** All interactive elements and typographic hierarchies strictly comply with **WCAG 2.1 Level AA** standards in both Light and Dark themes.
4. **Predictability:** Component geometry uses a standard 12px base radius (`--radius: 0.75rem`) and an 8pt spatial grid for rhythmic visual alignment.
5. **High-Performance Rendering:** Glass effects avoid expensive GPU filter stacking. Fallbacks are embedded for low-power mobile hardware and legacy rendering engines.

---

## 2. Core Architectural Tokens

### 2.1 Spacing & Layout Rhythm
The spatial grid uses a 4px/8px modular scale:
- `space-1` (4px): Micro gaps between icons and labels
- `space-2` (8px): Compact element spacing, badge padding
- `space-3` (12px): Standard form element padding, compact card padding
- `space-4` (16px): Default component padding, card content padding
- `space-6` (24px): Section gaps, card header/footer separation
- `space-8` (32px): Layout column gutters, module separation
- `space-12` (48px): Page section breaks

### 2.2 Corner Radii Scale
- `--radius-xs` (4.8px): Badges, checkboxes, tags
- `--radius-sm` (7.2px): Compact buttons, input fields
- `--radius-md` (9.6px): Standard buttons, dropdown menus
- `--radius-lg` (12px): Standard panels, cards
- `--radius-xl` (16.2px): Modal dialogs, major dashboard widgets
- `--radius-2xl` (21.6px): Floating hero banners, pill containers
- `--radius-full` (9999px): Avatars, rounded indicators

### 2.3 Layered Depth & Z-Index System
- `z-0`: Base canvas & ambient background gradients
- `z-10`: Recessed panels & secondary cards
- `z-20`: Primary content cards & interactive panels
- `z-30`: Sticky table headers & sub-navigation bars
- `z-40`: Fixed global navigation header (`.glass-nav`)
- `z-50`: Dropdown menus, tooltips, select popovers (`.glass-dropdown`)
- `z-60`: Modal backdrops & dialog surfaces (`.glass-modal`)
- `z-70`: Global toast alerts & notifications

---

## 3. Surface & Glassmorphic Elevation Model

The platform defines three structural surface tiers:

```
+---------------------------------------------------------------------------------+
| TIER 3: FLOATING GLASS (Modals, Dropdowns, Sticky Header)                       |
| Background: var(--glass-surface) | Blur: 16px-20px | Shadow: 0 24px 48px -12px  |
+---------------------------------------------------------------------------------+
        ^
+---------------------------------------------------------------------------------+
| TIER 2: PRIMARY GLASS (Dashboard Cards, Feed Items, Stat Panels)                |
| Background: var(--glass-surface) | Blur: 12px-14px | Shadow: var(--glass-shadow)|
+---------------------------------------------------------------------------------+
        ^
+---------------------------------------------------------------------------------+
| TIER 1: CANVAS BACKGROUND (Page Canvas & Ambient Gradient Lighting)             |
| Light: #F3F5F9 | Dark: #111827                                                  |
+---------------------------------------------------------------------------------+
```

---

## 4. Application Integration & Downstream Consumption

All dashboard pages in Phase 4 (Student, Faculty, Administrator, Super Administrator) must consume the design tokens defined in this system via Tailwind utility classes (`glass-card`, `glass-panel`, `bg-primary`, `text-foreground`, etc.) rather than hardcoding ad-hoc HEX values.

