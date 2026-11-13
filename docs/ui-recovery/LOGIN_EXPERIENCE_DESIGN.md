# AXIS LINKUP — LOGIN EXPERIENCE DESIGN
**Role-Specific Authentication & Zero-Trust Ingress**  
*Document Version:* 2.0.0  
*Phase:* 4.8.4 — Landing Page & Login Experience Redesign  
*Institution:* Axis Institute of Technology & Management (AITM), Kanpur  
*Last Updated:* November 13, 2026  

---

## 1. Overview & Architectural Philosophy

The **Axis LinkUp Login Experience** provides a secure, role-specific authentication interface styled strictly according to our **Light-Blue Glassmorphism Design System (Reference 1)**.

### Core Tenets:
1. **Preserve Clerk as Identity Provider:** All password hashing, session issuance, JWT rotation, and OTP verification are handled natively by Clerk. Zero custom password databases exist.
2. **Context-Aware Door Framing:** The login screen clearly identifies which institutional portal the user is entering, displaying the portal's icon, badge, and descriptive subtitle.
3. **Easy Door Switching:** A prominent "← Switch Portal Door" button allows users to change their target portal at any time.
4. **Complete Elimination of Self-Registration:** Public sign-up links, buttons, and footer actions are permanently removed.

---

## 2. Form Fields & Interactions

### 2.1 Credential Ingress Step
- **Identifier Field:**
  - Label: `Username or Institutional Email`
  - Input: Glass input (`variant="glass"`) with leading `User` icon.
  - Placeholder: `e.g. roll_no or name@axis.edu`
  - Validation: Non-empty string; accepts either unique username handle or institutional email address.
- **Password Field:**
  - Label: `Password`
  - Input: Glass input (`variant="glass"`) with leading `Lock` icon and trailing `Eye` / `EyeOff` show/hide toggle button.
  - Accessible toggle: `aria-label="Show password"` / `"Hide password"`.
- **Forgot Password Anchor:**
  - Position: Right-aligned above the password input.
  - Interaction: Switches to the collegiate password recovery guidance view or opens the Clerk reset flow.
- **Primary Action Button:**
  - Label: `Sign In to [Portal]` (e.g. `Sign In to Student`)
  - Variant: `variant="pill-primary"` (`rounded-full bg-primary text-white shadow-md shadow-primary/25`).
  - Loading State: Animated spinner (`<RefreshCw className="animate-spin" />`) with label *"Verifying Credentials..."*.

### 2.2 High-Assurance OTP Step
- Triggered when Clerk requires first-factor or second-factor step-up verification (`needs_first_factor` or `needs_second_factor`).
- Renders a 6-digit numeric OTP code input (`otpCodeFieldInput`) with centered monospace digits.
- "Confirm OTP & Sign In" button with loading feedback.
- "Back to Password Sign In" fallback.

### 2.3 Password Recovery Workflow
- Provides clear institutional instructions:
  - Enrolled students: Contact Department Registrar.
  - Instructional faculty: Contact Office of Academic Affairs.
  - Emergency IT Support: `it-support@axis.edu.in`.
- "← Back to Sign In" action.

---

## 3. Security Hardening & Threat Mitigations

| Threat | Mitigation | Implementation |
| :--- | :--- | :--- |
| **Username Enumeration** | Constant-time generic error messages | Form returns: *"Invalid username/email or password. Please verify your credentials."* |
| **Cross-Portal Privilege Ingress** | Server-side role cross-check | Post-authentication role verification against requested portal; blocks mismatched roles with 403 Forbidden. |
| **Brute-Force Attacks** | Rate-limiting & attempt throttling | Triggers 60-second cooldown on repeated authentication failures. |
| **Credential Sniffing** | Modern TLS 1.3 encryption & HttpOnly cookies | Clerk session tokens stored strictly in HttpOnly, SameSite=Strict cookies. |

---

## 4. Clerk Appearance Configuration

```tsx
<SignIn
  routing="path"
  path="/sign-in"
  signUpUrl={undefined}
  fallbackRedirectUrl={targetDashboard}
  forceRedirectUrl={targetDashboard}
  appearance={{
    elements: {
      rootBox: 'w-full',
      card: 'bg-transparent shadow-none p-0 border-0',
      header: 'hidden',
      main: 'w-full gap-4',
      form: 'gap-3.5',
      formFieldLabel: 'text-foreground text-xs font-medium',
      formFieldInput:
        'h-10 text-xs rounded-xl bg-glass-surface/60 border border-glass-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 backdrop-blur-md',
      formButtonPrimary:
        'h-10 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25',
      formFieldAction: 'text-primary text-xs hover:underline font-medium',
      footerAction: 'hidden',
      footer: 'hidden',
    },
  }}
/>
```
