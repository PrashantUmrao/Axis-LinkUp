# Axis LinkUp — Theme Configuration System
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Supported Modes:** Light Mode, Dark Mode, System Preference Mode  
**Implementation:** `src/components/theme/` and `src/app/layout.tsx`  

---

## 1. Architecture Overview

The Axis LinkUp theme engine provides persistent, dual-mode color theming across the entire application with zero Flash of Unstyled Content (FOUC).

```
+-----------------------------------------------------------------------------------+
| 1. Synchronous Inline Script (<head>)                                             |
| Reads 'axis-linkup-theme' from localStorage or checks prefers-color-scheme.       |
| Adds or removes '.dark' class on <html> before initial paint. (Zero FOUC)         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 2. React Context Provider (<ThemeProvider>)                                        |
| Mounts in RootLayout. Syncs React state with DOM classes and localStorage.         |
| Provides useTheme() hook for all client components.                               |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 3. CSS Variables & Tailwind Theme Engine                                          |
| Variables in globals.css respond instantly to '.dark' class toggle.               |
| All components (buttons, cards, glass panels) adapt colors smoothly in 200ms.     |
+-----------------------------------------------------------------------------------+
```

---

## 2. Anti-FOUC Implementation

To prevent a white flash when a user with dark mode enabled refreshes the page, a synchronous execution snippet is injected in the `<head>` of [src/app/layout.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/app/layout.tsx):

```tsx
<head>
  <script
    dangerouslySetInnerHTML={{
      __html: `
        (function() {
          try {
            var stored = localStorage.getItem('axis-linkup-theme') || 'system';
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (stored === 'dark' || (stored === 'system' && prefersDark)) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          } catch (e) {}
        })();
      `,
    }}
  />
</head>
```

In addition, `suppressHydrationWarning` is enabled on the `<html>` tag to eliminate React hydration mismatch warnings.

---

## 3. Developer Consumption Guide

### 3.1 Consuming the `useTheme` Hook
```tsx
'use client';

import { useTheme } from '@/components/theme';

export function CustomComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <p>Current setting: {theme} (Active: {resolvedTheme})</p>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('system')}>System</button>
    </div>
  );
}
```

### 3.2 Embedding the `ThemeToggle` Control
```tsx
import { ThemeToggle } from '@/components/theme';

// Render dropdown toggle
<ThemeToggle variant="dropdown" />

// Render single icon button toggle
<ThemeToggle variant="icon-button" />
```

---

## 4. Preservation of Clerk & Third-Party Screens

The theme system does not interfere with external authentication components. `<ClerkProvider>` wraps the HTML structure and applies institutional brand primary colors (`#3456D1`), while Clerk's prebuilt cards (`<SignIn />`, `<SignUp />`) use explicit CSS overrides matching the college aesthetic.

