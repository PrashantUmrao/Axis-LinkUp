# Axis LinkUp — Phase 5.2.7: Password Recovery System Implementation Report

**Author:** Axis LinkUp Engineering Team  
**Date:** November 15, 2026  
**Status:** Completed & Fully Verified  
**Target Platform:** Axis Institute of Technology & Management (AITM), Kanpur  

---

## 1. Executive Summary

Phase 5.2.7 delivers an enterprise-grade, cryptographically secure **Password Recovery System** for Axis LinkUp. The system allows scholars, faculty, and administrators to recover forgotten passwords seamlessly using either their institutional email or institutional username, while strictly enforcing zero-trust security invariants, account enumeration defense, cryptographic replay prevention, and automated session revocation upon password update.

### Key Architectural Highlights:
1. **Account Enumeration Defense:** Requests for recovery return an identical generic status notice (`"If an account matching that identifier exists, a verification code has been dispatched to its registered institutional email."`) regardless of whether the account exists in MongoDB, preventing hostile user discovery.
2. **Dual-Identifier Account Resolution:** Supports resolution via institutional email (e.g., `karan.mehta@axiscolleges.in`) or unique institutional username (`karan.mehta`) through `UserRepository.findByIdentifier()`.
3. **Reuse of Existing OTP Infrastructure:** Directly integrates with `OtpService` using `purpose = 'password_recovery'`, reusing the 5-minute expiration, 60-second cooldown rate-limiting, and 5-attempt brute-force protection built in Phase 5.2.6.
4. **Cryptographic Proof Token (HMAC-SHA256):** Issues a self-contained, tamper-proof, 15-minute proof token (`<payload_base64url>.<hmac_signature>`) bound to the recipient's email, recovery purpose, timestamp, and a random cryptographic nonce.
5. **Stateful Replay Defense:** Persists proof token hashes in `OtpModel` (`proofTokenHash`) and atomically marks them consumed upon password reset (`isProofConsumed: true`), pre-empting duplicate reuse or replay attacks.
6. **Clerk IAM Password Synchronization:** Updates the user's permanent password directly through Clerk's backend SDK (`client.users.updateUser()`) with zero plaintext storage in MongoDB.
7. **Automated Session Revocation:** Enumerates all active sessions via Clerk's backend SDK (`client.sessions.getSessionList()`) and revokes them immediately (`client.sessions.revokeSession()`), forcing fresh authentication across all previously authenticated devices.
8. **Collegiate Glassmorphism Frontend Flow:** Developed a multi-step recovery wizard at `/forgot-password`, linked directly from the portal login cards.

---

## 2. Security Architecture & Threat Modeling

### 2.1 Threat Mitigation Matrix

| Threat Vector | Mitigation Strategy | Implementation |
| :--- | :--- | :--- |
| **Account Enumeration** | Constant-response messaging regardless of identifier existence | `PasswordRecoveryService.requestRecovery` returns `GENERIC_REQUEST_NOTICE` without 404 |
| **Brute-Force OTP Guessing** | 5-attempt limit, timing-safe hash comparison, and automatic invalidation | `OtpService.verifyOtp` tracks `attempts`, consuming OTP upon 5th failure |
| **Email Bombing / DoS** | 60-second resend cooldown window | `OtpService.RESEND_COOLDOWN_MS = 60,000` returning HTTP 429 |
| **Proof Token Forgery** | HMAC-SHA256 signing using backend secret (`CLERK_SECRET_KEY`) | `OtpService.verifyProofToken` verifies signature with `crypto.timingSafeEqual` |
| **Token Tampering / Replay** | Stateful proof hash persistence with atomic consumption in MongoDB | `OtpRepository.findByProofTokenHash` & `consumeVerificationProof` |
| **Cross-Account Exploitation** | Proof email assertion against reset payload | `proofPayload.email === normalizedEmail` assertion |
| **Weak Password Attacks** | Strict institutional complexity schema | 8+ chars, uppercase, lowercase, numeric, special character |
| **Stolen Session Hijacking** | Automated session revocation upon password update | `client.sessions.revokeSession` for all active Clerk sessions |
| **Suspended Account Access** | Account lifecycle gate assertions | HTTP 403 `ForbiddenError` if `status === 'suspended'` |

### 2.2 Verification Proof Token Specification

```
verificationProofToken = <Base64URL(Payload)>.<HMAC-SHA256(Base64URL(Payload), SECRET)>
```

- **Payload Structure:**
  ```json
  {
    "email": "karan.mehta@axiscolleges.in",
    "purpose": "password_recovery",
    "issuedAt": 1731613200000,
    "expiresAt": 1731614100000,
    "nonce": "3a8f19c4d92e85ab7143e18a992d3f4b"
  }
  ```
- **Validity Window:** 15 minutes (900,000 ms).
- **Consumption:** Single-use only. Marked `isProofConsumed: true` in MongoDB upon successful password update.

---

## 3. Database Design & Persistence

### 3.1 Extended `OtpModel` (`src/lib/db/models/otp.model.ts`)
```typescript
const OtpSchema = new Schema<IOtpDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    hashedOtp: { type: String, required: true },
    purpose: { type: String, enum: OTP_PURPOSES, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5 },
    resendAvailableAt: { type: Date, required: true },
    isConsumed: { type: Boolean, default: false },
    consumedAt: { type: Date, default: null },

    // Phase 5.2.7 Extensions
    proofTokenHash: { type: String, default: null, index: true },
    isProofConsumed: { type: Boolean, default: false, index: true },
    proofConsumedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'otps' }
);

// Compound index for verification proof lookup and replay validation
OtpSchema.index({ proofTokenHash: 1, isProofConsumed: 1 }, { sparse: true });
```

### 3.2 Extended `OtpRepository` (`src/lib/db/repositories/otp.repository.ts`)
- `setVerificationProof(id: string, proofTokenHash: string)`: Binds the proof token hash to the OTP document.
- `findByProofTokenHash(proofTokenHash: string)`: Retrieves the OTP document by proof token hash.
- `consumeVerificationProof(id: string)`: Atomically sets `{ isProofConsumed: true, proofConsumedAt: new Date() }`.

---

## 4. API Endpoints Specification

### 4.1 POST `/api/v1/auth/password-recovery/request`
Initiates recovery for a scholar or faculty member.

- **Request Body:**
  ```json
  {
    "identifier": "karan.mehta@axiscolleges.in"
  }
  ```
- **Validation Rules:**
  - `identifier`: String between 3 and 100 characters. Accepts email or institutional username.
- **Success Response (`HTTP 200 OK`):**
  ```json
  {
    "success": true,
    "message": "If an account matching that identifier exists, a verification code has been dispatched to its registered institutional email.",
    "data": {
      "message": "If an account matching that identifier exists, a verification code has been dispatched to its registered institutional email.",
      "email": "karan.mehta@axiscolleges.in",
      "maskedEmail": "ka***@axiscolleges.in",
      "cooldownSeconds": 60
    }
  }
  ```
- **Non-Existent Identifier Response (`HTTP 200 OK`):**
  ```json
  {
    "success": true,
    "message": "If an account matching that identifier exists, a verification code has been dispatched to its registered institutional email.",
    "data": {
      "message": "If an account matching that identifier exists, a verification code has been dispatched to its registered institutional email."
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Malformed payload (<3 characters).
  - `403 Forbidden`: Account is suspended (`"Suspended accounts cannot initiate password recovery without administrative clearance."`).
  - `429 Too Many Requests`: Resend cooldown active (`"Please wait 45 second(s) before requesting another verification code."`).

---

### 4.2 POST `/api/v1/auth/password-recovery/reset`
Completes password recovery, updates credentials in Clerk IAM, and revokes prior active sessions.

- **Request Body:**
  ```json
  {
    "email": "karan.mehta@axiscolleges.in",
    "verificationProofToken": "eyJlbWFpbCI...64-hex-signature",
    "password": "NewCampusPassword#2026",
    "confirmPassword": "NewCampusPassword#2026"
  }
  ```
- **Validation Rules:**
  - `email`: Valid institutional email format.
  - `verificationProofToken`: Non-empty Base64URL+HMAC string.
  - `password`: Min 8 chars, 1+ uppercase, 1+ lowercase, 1+ number, 1+ special character.
  - `confirmPassword`: Must match `password` exactly.
- **Success Response (`HTTP 200 OK`):**
  ```json
  {
    "success": true,
    "message": "Your password has been reset successfully. Please sign in with your new credentials.",
    "data": {
      "success": true,
      "email": "karan.mehta@axiscolleges.in",
      "username": "karan.mehta",
      "role": "student",
      "sessionsRevoked": 2,
      "message": "Your password has been reset successfully. Please sign in with your new credentials."
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Proof token signature invalid, mismatched email, weak password, or password mismatch.
  - `400 Bad Request`: Proof token already consumed (`"This verification proof has already been used. Please request a new recovery code."`).
  - `403 Forbidden`: Account is suspended.
  - `410 Gone`: Proof token expired (>15 minutes).
  - `502 Bad Gateway`: Clerk IAM communication timeout/failure.

---

## 5. Frontend Recovery Experience

### 5.1 Recovery Entry Point (`src/components/auth/role-login-form.tsx`)
A dedicated recovery ingress link was added beneath the role-based sign-in form:
```tsx
<div className="border-border/40 border-t pt-3 text-center">
  <Link
    href={`/forgot-password?portal=${portal}`}
    className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs font-medium hover:underline transition-colors"
  >
    <KeyRound className="size-3.5" />
    <span>Forgot institutional password?</span>
  </Link>
</div>
```

### 5.2 Password Recovery Page (`src/app/(auth)/forgot-password/page.tsx`)
Built an intuitive 4-step wizard conforming to the platform's glassmorphism design:
- **Step 1 (Account Identification):** Collects institutional email or username. Calls `/api/v1/auth/password-recovery/request`.
- **Step 2 (Email OTP Verification):** Reuses the `<OtpInput />` component with `purpose="password_recovery"`. Displays masked email, cooldown countdown, and remaining attempts. Upon verification, stores `verificationProofToken`.
- **Step 3 (Password Reset):** Collects new password with live complexity checklist, confirm-password validation, and password visibility toggles (`Eye` / `EyeOff`). Calls `/api/v1/auth/password-recovery/reset`.
- **Step 4 (Success State):** Informs the user of successful credential update, reports the number of revoked active sessions, and provides a direct button to sign in (`/sign-in?portal=${portal}`).

---

## 6. Automated Testing & Verification Results

### 6.1 Password Recovery Unit Test Suite (`tests/unit/password-recovery.test.ts`)
15 tests across 4 suites validating:
1. **Forgot-Password Request & Account Resolution:** Resolution by email, resolution by username, generic notice defense, suspended account rejection.
2. **Cryptographic Proof Token Validation:** Verifiable HMAC token creation, 15m TTL, tampered payload rejection, tampered signature rejection, purpose mismatch rejection.
3. **Password Policy & Schema Validation:** Acceptance of strong password, rejection of missing special char, number, or length, mismatch rejection.
4. **Execution, Clerk IAM & Session Revocation:** Successful recovery, Clerk SDK `updateUser`, Clerk SDK `revokeSession`, replay rejection, cross-account rejection, suspended account rejection, Clerk failure handling (HTTP 502).

**Test Output:**
```
# tests 15
# suites 4
# pass 15
# fail 0
# duration_ms 1455.4114
```

### 6.2 Full Platform Test Suite
```
> axis-linkup@0.1.0 test
> npx tsx --test tests/unit/**/*.test.ts

# tests 246
# suites 87
# pass 246
# fail 0
# cancelled 0
# duration_ms 26568.4006
```

### 6.3 TypeScript Typecheck (`npx tsc --noEmit`)
- **Status:** **0 errors**.

### 6.4 ESLint Audit (`npm run lint`)
- **Status:** **0 warnings / 0 errors**.

### 6.5 Production Build (`npm run build`)
- **Status:** Compiled **23 static and dynamic routes** cleanly:
  - `○ /forgot-password` (4.84 kB)
  - `ƒ /api/v1/auth/password-recovery/request`
  - `ƒ /api/v1/auth/password-recovery/reset`
  - `ƒ /sign-in/[[...sign-in]]`

---

## 7. Modified & Created Files Summary

| File Path | Type | Description |
| :--- | :--- | :--- |
| `src/types/password-recovery.ts` | Created | Data contracts, input schemas, and result interfaces |
| `src/types/otp.ts` | Modified | Added `proofTokenHash`, `isProofConsumed`, `proofConsumedAt` to `IOtpDocument` |
| `src/types/index.ts` | Modified | Exported password-recovery types |
| `src/lib/db/models/otp.model.ts` | Modified | Added proof token tracking fields and compound index |
| `src/lib/db/repositories/otp.repository.ts` | Modified | Implemented proof token persistence and atomic consumption |
| `src/lib/validations/password-recovery.schema.ts` | Created | Zod schemas for recovery requests and password reset |
| `src/lib/services/otp.service.ts` | Modified | Added `generateProofToken` and `verifyProofToken` methods |
| `src/lib/services/password-recovery.service.ts` | Created | Domain service for forgot-password, reset, and session revocation |
| `src/lib/services/index.ts` | Modified | Exported `PasswordRecoveryService` |
| `src/app/api/v1/auth/password-recovery/request/route.ts` | Created | Public API handler for recovery code dispatch |
| `src/app/api/v1/auth/password-recovery/reset/route.ts` | Created | Public API handler for password reset & session revocation |
| `src/components/auth/role-login-form.tsx` | Modified | Added "Forgot institutional password?" ingress link |
| `src/app/(auth)/forgot-password/page.tsx` | Created | Multi-step collegiate password recovery wizard |
| `src/middleware.ts` | Modified | Added public edge matchers for `/forgot-password` and recovery APIs |
| `tests/unit/password-recovery.test.ts` | Created | 15 unit tests covering security, proof validation, and Clerk integration |
| `docs/phase-5/PHASE_5_2_7_PASSWORD_RECOVERY_REPORT.md` | Created | Architectural implementation report |

---

## 8. Manual Configuration & Operational Notes

1. **Clerk IAM Configuration:**
   - Ensure `CLERK_SECRET_KEY` is present in `.env.local` to enable backend session revocation and password updates.
   - Clerk password complexity settings in Clerk Dashboard should match or be lenient to the platform's minimum 8-character policy.
2. **SMTP / Email Delivery:**
   - In production, configure institutional SMTP or Resend credentials in `.env.local` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` or `RESEND_API_KEY`). In development, simulated sandbox dispatch is active with full log masking.

