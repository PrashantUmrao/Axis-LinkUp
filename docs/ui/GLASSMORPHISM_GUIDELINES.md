# Axis LinkUp — Glassmorphism Implementation Guidelines
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Aesthetic:** Controlled Frosted Glass & Ambient Luminance  
**Target Performance:** 60 FPS on Standard Mobile & Desktop Hardware  

---

## 1. Core Principles of Restrained Glassmorphism

Glassmorphism in **Axis LinkUp** is designed as a functional depth tool rather than a decorative novelty. To avoid visual fatigue, sluggish GPU compositing, or illegible text, all glass implementations follow five golden rules:

1. **Restrained Opacity:** Background opacity is never lower than 60% and never higher than 85%. Too low creates visual chaos; too high destroys the frosted aesthetic.
   - Light Mode: `rgba(255, 255, 255, 0.72)`
   - Dark Mode: `rgba(24, 35, 52, 0.70)`
2. **Controlled Backdrop Blur:** Blur values are fixed between **10px and 16px**. Extreme values (30px–50px) overload mobile GPU fill rates and introduce scroll stuttering.
3. **Subtle Boundaries:** Frosted glass must possess a crisp edge to separate it from underlying content:
   - 1px border (`var(--glass-border)`) with 10%–18% opacity.
4. **Specular Edge Highlighting:** Surfaces feature a micro-bevel reflection (`var(--glass-highlight)`) using an inner shadow:
   - `inset 0 1px 1px 0 rgba(255, 255, 255, 0.85)` in Light Mode
   - `inset 0 1px 1px 0 rgba(255, 255, 255, 0.12)` in Dark Mode
5. **Mandatory Fallback:** Every glass utility provides a solid fallback background for browsers lacking `backdrop-filter` support.

---

## 2. Standard CSS Utility Classes

The following utility classes are declared in [src/app/globals.css](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/globals.css):

### `.glass-panel` (Standard Surface)
```css
.glass-panel {
  background-color: var(--glass-surface);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
}
```

### `.glass-card` (Interactive Card)
```css
.glass-card {
  background-color: var(--glass-surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), var(--glass-highlight);
  border-radius: var(--radius-xl);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.glass-card:hover {
  background-color: var(--glass-surface-hover);
  border-color: var(--glass-border-hover);
  box-shadow: 0 12px 36px 0 rgba(0, 0, 0, 0.15), var(--glass-highlight);
}
```

### `.glass-nav` (Sticky Navigation Header)
```css
.glass-nav {
  background-color: var(--glass-surface);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: 0 4px 20px 0 rgba(0, 0, 0, 0.05);
}
```

### `.glass-dropdown` (Floating Popovers)
```css
.glass-dropdown {
  background-color: var(--glass-surface);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 16px 40px 0 rgba(0, 0, 0, 0.25), var(--glass-highlight);
}
```

### `.glass-modal` (Dialog Surfaces)
```css
.glass-modal {
  background-color: var(--glass-surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.35), var(--glass-highlight);
}
```

---

## 3. Anti-Pattern Checklist (What to Avoid)

| Anti-Pattern | Why It Is Prohibited | Approved Replacement |
| :--- | :--- | :--- |
| **Glass on Glass Nesting (3+ layers)** | Creates severe text blur and illegible contrast. | Use `.glass-panel-secondary` or solid `bg-muted/40` for inner child containers. |
| **Neon Glow Shadows** | Look childish and destroy collegiate institutional credibility. | Use soft ambient shadows (`0 8px 32px rgba(0,0,0,0.10)`). |
| **Heavy Blur (> 25px)** | Severe mobile frame rate drops during scrolling. | Cap blur at `12px–16px`. |
| **Border-less Glass** | Surfaces blend invisibly into busy background images. | Always include a 1px border (`var(--glass-border)`). |
| **Low Contrast Body Text** | Violates WCAG accessibility standards. | Always use `text-foreground` or `text-muted-foreground`. |

