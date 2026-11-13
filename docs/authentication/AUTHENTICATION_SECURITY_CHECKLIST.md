# Authentication Security & Compliance Checklist

> **Document ID:** DOC-AUTH-008  
> **Status:** Architecture Verification Baseline (Phase 3, Part 3.1)  
> **Institution:** Axis Institute of Technology & Management  
> **Standards:** OWASP Top 10 • NIST SP 800-63B • DPDP Act (India)  
> **Last Updated:** November 2026  

---

## 1. Credential Security & Password Policy Standards

| Security Requirement | Status | Architecture Safeguard | Standard / Policy |
| :--- | :---: | :--- | :--- |
| **Password Complexity** | Enforced | Minimum 8 characters; requires at least one uppercase, one lowercase, one number, and one symbol. | NIST SP 800-63B |
| **Breach Password Screening** | Enforced | Passwords screened automatically against compromised database dumps (HaveIBeenPwned). | OWASP ASVS v4.0 |
| **Zero Plaintext Storage** | Enforced | Passwords hashed using salted, memory-hard algorithms (Argon2id/bcrypt) within managed identity provider. | ISO 27001 |
| **No Passwords in Code/Logs** | Enforced | Automated redaction in `src/lib/logging/logger.ts` scrubs `password` keys from all logs. | DOC-ENG-001 |

---

## 2. Multi-Factor Authentication (MFA) Verification

| Security Requirement | Status | Architecture Safeguard | Standard / Policy |
| :--- | :---: | :--- | :--- |
| **Mandatory Admin MFA** | Enforced | TOTP MFA (Google Authenticator / Authy) strictly mandatory for `admin` and `super_admin` roles. | NFR-SEC-01 |
| **MFA Enrollment Enforcement** | Enforced | Administrative accounts cannot navigate past `/mfa-setup` on first login until TOTP is verified. | NIST AAL2 |
| **Optional Student/Faculty MFA**| Proposed | Optional TOTP or email-based MFA available in user settings for enhanced personal protection. | Discretionary |
| **Backup Recovery Codes** | Enforced | One-time cryptographic recovery codes generated upon MFA activation for emergency account recovery. | NIST SP 800-63B |

---

## 3. Session & Cookie Defense Standards

| Security Requirement | Status | Architecture Safeguard | Standard / Policy |
| :--- | :---: | :--- | :--- |
| **HttpOnly Cookie Flag** | Enforced | Session cookies inaccessible to client-side JavaScript, defeating document.cookie XSS theft. | OWASP Top 10 |
| **Secure Cookie Flag** | Enforced | Enforced in production; browser transmits cookies exclusively over encrypted TLS 1.3 tunnels. | RFC 6265bis |
| **SameSite=Strict Cookie Flag**| Enforced | Prevents browser from transmitting session cookies on third-party cross-origin requests (CSRF defense).| OWASP CSRF Guide |
| **Short-Lived Access Tokens** | Enforced | Access JWT tokens limited to 15-minute validity window. | NIST SP 800-63B |
| **Global Session Revocation** | Enforced | Super Admins can revoke all active sessions for any user instantaneously upon security compromise. | RFC 7009 |

---

## 4. Privilege Escalation & Metadata Protection

| Security Requirement | Status | Architecture Safeguard | Standard / Policy |
| :--- | :---: | :--- | :--- |
| **Client-Immutable Metadata** | Enforced | `publicMetadata` (roles) writable strictly via server-side secret key; client writes blocked by provider. | DOC-ARCH-005 |
| **Zero Trust Client Claims** | Enforced | Edge Middleware and Server Actions independently re-evaluate JWT signatures and MongoDB status. | DOC-ENG-001 |
| **Super Admin Lockout Guard** | Enforced | Server Actions prevent the last remaining active Super Admin from demoting or suspending themselves. | Fail-Safe Design |
| **TAMPER-PROOF Audit Trail** | Enforced | Every role assignment and status transition immutably logged to MongoDB `audit_logs`. | DPDP Act Sec. 8 |

---

## 5. Webhook Security & Tamper Resistance

| Security Requirement | Status | Architecture Safeguard | Standard / Policy |
| :--- | :---: | :--- | :--- |
| **Cryptographic HMAC Signatures**| Enforced | Webhooks verified using Svix HMAC-SHA256 signatures with secret key `CLERK_WEBHOOK_SECRET`. | RFC 2104 |
| **Replay Attack Prevention** | Enforced | Webhook signatures enforce 5-minute timestamp tolerance window; stale events are rejected. | OWASP Webhook Guide |
| **Idempotency Guarantees** | Enforced | Webhook handlers upsert records by `authProviderId` ensuring duplicate delivery produces zero errors. | RFC 7231 |

---

## 6. Indian Data Protection (DPDP Act) & Data Sovereignty

| Security Requirement | Status | Architecture Safeguard | Standard / Policy |
| :--- | :---: | :--- | :--- |
| **Indian Data Residency** | Enforced | Primary database deployed strictly in AWS Mumbai (`ap-south-1`). | DPDP Act 2023 |
| **PII Isolation** | Enforced | Student roll numbers, attendance, grades, and phone numbers remain strictly in MongoDB Atlas. | DPDP Act Sec. 4 |
| **Right to Erasure / Redaction**| Enforced | Student accounts can be anonymized upon graduation in compliance with institutional retention laws. | DPDP Act Sec. 12 |

---

## 7. Decision Classification

- **Approved Decisions (Firm):**
  - Mandatory TOTP MFA for `admin` and `super_admin`.
  - Full DPDP Act compliance with Indian data residency in AWS Mumbai.
  - Svix HMAC-SHA256 verification on all identity webhooks.
  - Zero logging of passwords or tokens.
- **Proposed Decisions:**
  - Automated detection and temporary lockouts on accounts exhibiting multiple failed logins from distinct geographic IPs.
- **Pending Human Approval:**
  - Mandatory password expiration policy (e.g. 90-day password rotation for administrative accounts).

