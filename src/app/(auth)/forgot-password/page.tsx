'use client';

/**
 * Self-Service Collegiate Password Recovery Page.
 * Conforms to Phase 5.2.7 specifications:
 * - Multi-step guided password recovery flow
 * - Step 1: Identifier Entry (Email or institutional username)
 * - Step 2: Email OTP Verification (6-digit code, cooldown, attempt limits)
 * - Step 3: New Password Setup (Strong password policy, confirmation)
 * - Step 4: Success State & Automated Session Revocation Notice
 * - Preserves approved Glassmorphism design system and portal context
 */

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  KeyRound,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { OtpInput } from '@/components/auth/otp-input';
import type { VerifyOtpResponse } from '@/types/otp';

type RecoveryStep = 'identifier' | 'otp' | 'password' | 'success';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const portalParam = searchParams.get('portal') || 'student';

  // Wizard state
  const [step, setStep] = useState<RecoveryStep>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [verificationProofToken, setVerificationProofToken] = useState('');

  // Password Setup State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Loaders
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionsRevoked, setSessionsRevoked] = useState<number>(0);

  // 1. Submit Identifier (Email or Username)
  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/auth/password-recovery/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Failed to initiate password recovery.');
      }

      const email = json.data?.email || (identifier.includes('@') ? identifier.trim() : '');
      const masked = json.data?.maskedEmail || (identifier.includes('@') ? identifier.trim() : 'your institutional email');

      setResolvedEmail(email);
      setMaskedEmail(masked);
      setStep('otp');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'An error occurred during recovery request.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Handle OTP Verification Success
  const handleOtpVerified = (verifyResult: VerifyOtpResponse) => {
    if (verifyResult.verificationProofToken) {
      setVerificationProofToken(verifyResult.verificationProofToken);
      setResolvedEmail(verifyResult.email);
      setStep('password');
    } else {
      setErrorMessage('Verification proof was not issued. Please try again.');
    }
  };

  // Password strength checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid =
    hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // 3. Submit New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid || !passwordsMatch || !verificationProofToken) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/v1/auth/password-recovery/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resolvedEmail,
          verificationProofToken,
          password,
          confirmPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Password reset failed.');
      }

      setSessionsRevoked(json.data?.sessionsRevoked ?? 0);
      setStep('success');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to reset password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 4: Success State Render
  if (step === 'success') {
    return (
      <div className="glass-card border-glass-border mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-5 border p-8 text-center shadow-2xl">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 shadow-lg">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="space-y-2">
          <h2 className="font-heading text-foreground text-2xl font-bold tracking-tight">
            Password Reset Complete!
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your institutional password has been securely updated.
            {sessionsRevoked > 0 && (
              <span className="block pt-1 text-emerald-600 dark:text-emerald-400">
                All prior active sessions ({sessionsRevoked}) were automatically revoked for your security.
              </span>
            )}
          </p>
        </div>

        <div className="border-border/30 bg-muted/20 w-full rounded-xl border p-3.5 text-left text-xs">
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Collegiate Account:</span>
            <span className="text-foreground font-mono font-medium">{resolvedEmail}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Session Status:</span>
            <span className="text-emerald-500 font-medium">Fresh Authentication Required</span>
          </div>
        </div>

        <Button
          type="button"
          variant="pill-primary"
          onClick={() => router.push(`/sign-in?portal=${portalParam}`)}
          className="w-full text-xs font-semibold"
        >
          <span>Sign In With New Password</span>
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      {/* Top Header */}
      <div className="space-y-2 text-center">
        <div className="bg-primary/10 border-primary/20 text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
          <KeyRound className="size-3.5" />
          <span>Identity Recovery Gateway</span>
        </div>

        <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight">
          Reset Your Password
        </h1>

        <p className="text-muted-foreground text-xs">
          {step === 'identifier' && 'Enter your registered email or username to receive a verification code'}
          {step === 'otp' && `Enter the 6-digit confirmation code sent to ${maskedEmail || 'your email'}`}
          {step === 'password' && 'Establish your new permanent collegiate password'}
        </p>
      </div>

      {/* Main Glass Card */}
      <Card variant="glass" className="border-glass-border space-y-5 border p-6 shadow-xl sm:p-8">
        <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-3">
          <CardTitle className="text-xs font-semibold">
            {step === 'identifier' && 'Step 1 of 3: Account Identification'}
            {step === 'otp' && 'Step 2 of 3: Email OTP Verification'}
            {step === 'password' && 'Step 3 of 3: New Password Setup'}
          </CardTitle>
          <span className="text-muted-foreground font-mono text-[10px] uppercase">
            {portalParam.toUpperCase()} PORTAL
          </span>
        </CardHeader>

        <CardContent className="space-y-4 p-0">
          {/* Global Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold">Recovery Error</p>
                <p className="text-[11px] opacity-90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STEP 1: Identifier Entry */}
          {step === 'identifier' && (
            <form onSubmit={handleRequestRecovery} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <User className="size-3.5" />
                  Institutional Email or Username
                </label>
                <Input
                  type="text"
                  placeholder="e.g. aarav.sharma@axiscolleges.in or aarav.sharma"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  className="bg-card/40 border-glass-border h-10 text-xs"
                />
              </div>

              <Button
                type="submit"
                variant="pill-primary"
                disabled={!identifier.trim() || isSubmitting}
                className="w-full text-xs font-semibold"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Finding Account &amp; Sending Code...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Mail className="size-3.5" />
                    Send Verification Code
                  </span>
                )}
              </Button>
            </form>
          )}

          {/* STEP 2: OTP Verification */}
          {step === 'otp' && (
            <div className="space-y-4">
              <OtpInput
                email={resolvedEmail}
                purpose="password_recovery"
                title="Verify Password Recovery Code"
                description={`A 6-digit verification code has been dispatched to ${maskedEmail || resolvedEmail}.`}
                autoSendOnMount={false}
                onVerified={handleOtpVerified}
                onCancel={() => setStep('identifier')}
              />

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setStep('identifier')}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
                >
                  <ArrowLeft className="size-3" />
                  <span>Change email or username</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: New Password Setup */}
          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="border-border/20 bg-muted/20 flex items-center justify-between rounded-xl border p-3 text-xs">
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase">Account Verified</div>
                  <div className="text-foreground font-mono font-medium">{resolvedEmail}</div>
                </div>
                <div className="flex items-center gap-1 text-emerald-500 text-[11px] font-medium">
                  <ShieldCheck className="size-3.5" />
                  Identity Confirmed
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="text-muted-foreground flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <Lock className="size-3.5" />
                    New Password
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground text-[11px]"
                  >
                    {showPassword ? (
                      <span className="flex items-center gap-1">
                        <EyeOff className="size-3" /> Hide
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" /> Show
                      </span>
                    )}
                  </button>
                </label>

                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="bg-card/40 border-glass-border h-9 text-xs"
                />
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <Lock className="size-3.5" />
                  Confirm Password
                </label>

                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-card/40 border-glass-border h-9 text-xs"
                />

                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-[10px] text-destructive">Passwords do not match</p>
                )}
              </div>

              {/* Password Strength Checklist */}
              <div className="border-border/30 bg-muted/10 space-y-1.5 rounded-xl border p-3 text-[11px]">
                <div className="text-muted-foreground font-medium">Password Requirements:</div>
                <ul className="space-y-1">
                  <li
                    className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="size-3" />
                    <span>At least 8 characters</span>
                  </li>
                  <li
                    className={`flex items-center gap-1.5 ${hasUppercase && hasLowercase ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="size-3" />
                    <span>Uppercase &amp; lowercase letters</span>
                  </li>
                  <li
                    className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="size-3" />
                    <span>At least one number</span>
                  </li>
                  <li
                    className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-500' : 'text-muted-foreground'}`}
                  >
                    <CheckCircle2 className="size-3" />
                    <span>At least one special character</span>
                  </li>
                </ul>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="pill-primary"
                disabled={!isPasswordValid || !passwordsMatch || isSubmitting}
                className="w-full text-xs font-semibold"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" />
                    Updating Password &amp; Revoking Sessions...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <KeyRound className="size-3.5" />
                    Reset Password
                  </span>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Return to Sign-In link */}
      <div className="text-center">
        <Link
          href={`/sign-in?portal=${portalParam}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Return to Sign In</span>
        </Link>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="text-primary size-8 animate-spin" />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}

