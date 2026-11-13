# AXIS LINKUP — GLASSMORPHISM DESIGN SPECIFICATION
**Standardized Frosted Glass & Atmospheric Surface Architecture**  
*Document Version:* 2.0.0  
*Phase:* 4.8.3 — Premium Design System & Visual Identity Refinement  
*Institution:* Axis Institute of Technology & Management (AITM), Kanpur  
*Last Updated:* November 13, 2026  

---

## 1. Architectural Principles

Axis LinkUp implements an authentic, restrained glassmorphism aesthetic derived directly from **Reference 1 (Visual Identity)**. Rather than superficial decorative effects, the glass design serves clear functional purposes:
1. **Layer Hierarchy:** Separates background environment, master canvas, content panels, and foreground modals through optical depth.
2. **Contextual Awareness:** Translucent panels refract the underlying sky-blue atmosphere, giving the interface lightness and cohesion.
3. **Rigorous Readability:** Content contrast is strictly preserved; opacity levels never compromise WCAG 2.1 AA text standards.

---

## 2. Standardized Blur & Opacity Matrix

| Surface Role | Light Theme Fill | Dark Theme Fill | Backdrop Blur | Border Spec | Specular Highlight |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Master Canvas** | `rgba(255, 255, 255, 0.50)` | `rgba(10, 20, 36, 0.65)` | `20px` | `1px solid rgba(255, 255, 255, 0.75)` | `inset 0 1.5px 1px rgba(255, 255, 255, 0.90)` |
| **Primary Card** | `rgba(255, 255, 255, 0.65)` | `rgba(14, 28, 50, 0.65)` | `14px` | `1px solid rgba(255, 255, 255, 0.75)` | `inset 0 1.5px 1px rgba(255, 255, 255, 0.90)` |
| **Card (Hover)** | `rgba(255, 255, 255, 0.82)` | `rgba(20, 38, 66, 0.78)` | `14px` | `1px solid rgba(37, 99, 235, 0.40)` | `inset 0 1.5px 1px rgba(255, 255, 255, 0.95)` |
| **Secondary Panel** | `rgba(235, 244, 254, 0.60)` | `rgba(18, 35, 62, 0.50)` | `10px` | `1px solid rgba(147, 197, 253, 0.35)` | None |
| **Elevated Panel** | `rgba(255, 255, 255, 0.70)` | `rgba(16, 32, 58, 0.75)` | `18px` | `1px solid rgba(255, 255, 255, 0.80)` | `inset 0 1.5px 1px rgba(255, 255, 255, 0.90)` |
| **Capsule Pill** | `rgba(255, 255, 255, 0.65)` | `rgba(14, 28, 50, 0.65)` | `14px` | `1px solid rgba(255, 255, 255, 0.75)` | `inset 0 1px 1px rgba(255, 255, 255, 0.80)` |
| **Dropdown Menu** | `rgba(255, 255, 255, 0.85)` | `rgba(14, 28, 50, 0.85)` | `16px` | `1px solid rgba(255, 255, 255, 0.80)` | `inset 0 1px 1px rgba(255, 255, 255, 0.85)` |
| **Modal / Dialog** | `rgba(255, 255, 255, 0.88)` | `rgba(14, 28, 50, 0.88)` | `20px` | `1px solid rgba(255, 255, 255, 0.85)` | `inset 0 1.5px 1px rgba(255, 255, 255, 0.90)` |

---

## 3. Optical Specular Reflection (Edge Highlight)

An authentic glass surface exhibits a delicate refraction edge where ambient light catches the top bevel. Axis LinkUp standardizes this with a dual-box-shadow technique:

```css
/* Standard Glass Surface with Ambient Shadow + Top Specular Edge */
box-shadow:
  0 12px 36px -6px rgba(37, 99, 235, 0.08),
  inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.90);
```

### Why this works:
1. `0 12px 36px -6px rgba(37, 99, 235, 0.08)` creates a diffused, ambient blue drop shadow that matches the canvas environment (eliminating dull gray shadows).
2. `inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.90)` introduces a crisp, translucent white rim at the top of the card that mimics real optical glass.

---

## 4. Layer Nesting & GPU Performance Rules

```text
ALLOWED NESTING HIERARCHY (Maximum 2 Blurred Layers):
┌────────────────────────────────────────────────────────┐
│ Global Sky-Blue Atmospheric Background (Zero Blur)     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Layer 1: Floating Master Canvas (blur: 20px)      │  │
│  │   ┌───────────────────────────────────────────┐  │  │
│  │   │ Layer 2: Dashboard Glass Card (blur: 14px)│  │  │
│  │   │   • Content, Charts, Tables (Zero Blur)   │  │  │
│  │   └───────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Strict Restrictions:
- **NO Layer 3 Nesting:** Never place a blurred card inside another blurred card inside a blurred container. This degrades mobile GPU frame rates.
- **Maximum Blur Cap:** Blur filters must never exceed `24px`.
- **GPU Acceleration:** All glass containers use `-webkit-backdrop-filter` alongside standard `backdrop-filter` with `bg-clip-padding` to prevent border bleed.

---

## 5. Non-Supporting Fallback Strategy

For legacy browsers, low-power modes, or headless testing engines lacking `backdrop-filter` support, Axis LinkUp provides an automatic solid fallback:

```css
@supports not (backdrop-filter: blur(1px)) {
  .glass-panel,
  .glass-panel-secondary,
  .glass-panel-elevated,
  .glass-card,
  .glass-canvas,
  .glass-pill,
  .glass-nav,
  .glass-dropdown,
  .glass-modal {
    background-color: var(--card);
  }
}
```

---

## 6. Accessibility & Motion Guidelines

1. **Reduced Motion:** When `@media (prefers-reduced-motion: reduce)` is active, hover transforms (`translateY(-1px)`) and transition durations are reduced to `0.01ms`.
2. **Text Contrast Guarantee:** Text elements placed over frosted glass panels must utilize semantic `--foreground` (`#0f1c30` in Light Mode, `#f8fafc` in Dark Mode) or `--muted-foreground` (`#475d7e` in Light Mode), which guarantee >= 4.5:1 contrast against the translucent glass fill.

