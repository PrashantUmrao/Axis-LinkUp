# Axis LinkUp — Component Library Reference
**Project:** Axis LinkUp — College Communication & Productivity Platform  
**Target Institution:** Axis Institute of Technology & Management (AITM), Kanpur  
**Component Location:** `src/components/ui/`  
**Theme Components:** `src/components/theme/`  

---

## 1. Component Inventory

The following 20 standardized UI components form the reusable foundation for all Phase 4 dashboards:

| Component | File Path | Primary Variants | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **GlassPanel** | [glass-panel.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/glass-panel.tsx) | `primary`, `secondary`, `interactive`, `elevated`, `subtle` | Polymorphic container for frosted glass layout blocks. |
| **Button** | [button.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/button.tsx) | `default`, `outline`, `secondary`, `ghost`, `destructive`, `glass`, `glass-primary` | Standard interactive button with CVA sizing (`xs`, `sm`, `default`, `lg`, `icon`). |
| **Card** | [card.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/card.tsx) | `default`, `glass`, `subtle` | Modular layout card with `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`. |
| **Input** | [input.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/input.tsx) | `default`, `glass` | Text input control with focus rings, placeholder, and disabled states. |
| **Textarea** | [textarea.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/textarea.tsx) | `default`, `glass` | Multiline text control for course comments and notices. |
| **Select** | [select.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/select.tsx) | `default`, `glass` | Accessible Radix UI dropdown with scroll buttons and search support. |
| **Checkbox** | [checkbox.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/checkbox.tsx) | Standard | Accessible Radix UI checkbox with animated checkmark. |
| **RadioGroup** | [radio.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/radio.tsx) | Standard | Accessible Radix UI radio list for mutually exclusive options. |
| **Badge** | [badge.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/badge.tsx) | `default`, `secondary`, `destructive`, `outline`, `glass`, `success`, `warning`, `info` | Micro indicators for role, status, and department tags. |
| **Avatar** | [avatar.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/avatar.tsx) | Standard | Fallback avatar with initials and image support. |
| **Dialog** | [dialog.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/dialog.tsx) | `glass-modal` | Accessible modal dialog with backdrop blur and trap focus. |
| **DropdownMenu** | [dropdown-menu.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/dropdown-menu.tsx) | `glass-dropdown` | Context menu, action menus, and navigation flyouts. |
| **Tooltip** | [tooltip.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/tooltip.tsx) | Standard | Accessible hover hints for buttons and icons. |
| **Tabs** | [tabs.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/tabs.tsx) | `default`, `glass` | Segmented controllers and tabbed dashboard views. |
| **Separator** | [separator.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/separator.tsx) | Horizontal, Vertical | Subtle borders for separating header and content elements. |
| **Skeleton** | [skeleton.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/skeleton.tsx) | Pulse | Shimmer loading placeholders matching component dimensions. |
| **LoadingState** | [loading-state.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/loading-state.tsx) | Inline, Card, Overlay | Spinners and glass loading overlay for asynchronous fetches. |
| **EmptyState** | [empty-state.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/empty-state.tsx) | Glass, Bordered | Zero-data states with contextual icons, messages, and CTA. |
| **ErrorState** | [error-state.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/ui/error-state.tsx) | Glass, Bordered | Error boundary cards with error code display and retry action. |
| **ThemeToggle** | [theme-toggle.tsx](file:///c:/Users/prash/Desktop/Axis%20LinkUp/src/components/theme/theme-toggle.tsx) | `dropdown`, `icon-button` | Accessible Light/Dark/System theme switcher. |

---

## 2. Usage Examples

### 1. Glass Card with Header & Actions
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from '@/components/ui';

export function CourseCard() {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex justify-between items-start">
          <Badge variant="info">Semester 7</Badge>
          <span className="text-xs text-muted-foreground">3 Credits</span>
        </div>
        <CardTitle>CS-401: Distributed Systems</CardTitle>
        <CardDescription>Prof. Sharma • CSE Department</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground">Lecture materials, laboratory exercises, and evaluations.</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm">Syllabus</Button>
        <Button variant="glass-primary" size="sm">Enter Course</Button>
      </CardFooter>
    </Card>
  );
}
```

### 2. Feedback States in Dashboards
```tsx
import { LoadingState, EmptyState, ErrorState } from '@/components/ui';

// Loading
if (isLoading) return <LoadingState glass message="Loading semester attendance..." />;

// Error
if (isError) return <ErrorState glass title="Failed to load attendance" onRetry={refetch} />;

// Empty
if (data.length === 0) return <EmptyState glass title="No notices found" description="Check back tomorrow." />;
```
