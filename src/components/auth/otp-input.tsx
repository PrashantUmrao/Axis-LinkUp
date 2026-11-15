'use client';

/**
 * 6-Digit Email OTP Verification Component.
 * Supports auto-focus advance, backspace regression, paste parsing,
 * 60-second cooldown timer, remaining attempts counter, and error handling.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mail,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OtpPurpose, VerifyOtpResponse } from '@/types/otp';

export interface OtpInputProps {
  email: string;
  purpose: OtpPurpose;
  onVerified: (result: VerifyOtpResponse) => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
  autoSendOnMount?: boolean;
}

export function OtpInput({
  email,
  purpose,
  onVerified,
  onCancel,
  title = 'Email Verification Required',
  description,
  autoSendOnMount = false,
}: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState<number>(0);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Request fresh OTP code
  const handleRequestOtp = useCallback(
    async (isResend = false) => {
      if (!email || isSending || cooldown > 0) return;

      setIsSending(true);
      setErrorMessage(null);
      setSuccessNotice(null);

      try {
        const endpoint = isResend ? '/api/v1/auth/otp/resend' : '/api/v1/auth/otp/request';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, purpose }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message || 'Failed to dispatch verification code.');
        }

        setCooldown(json.data?.resendAvailableInSeconds || 60);
        setSuccessNotice(json.message || 'Verification code sent to your email.');
        setDigits(['', '', '', '', '', '']);
        setRemainingAttempts(null);

        // Focus first input box
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to send verification code.'
        );
      } finally {
        setIsSending(false);
      }
    },
    [email, purpose, isSending, cooldown]
  );

  // Auto-send on mount if requested
  useEffect(() => {
    if (autoSendOnMount) {
      handleRequestOtp(false);
    }
  }, [autoSendOnMount, handleRequestOtp]);

  // Handle single character input & auto-advance
  const handleDigitChange = (index: number, val: string) => {
    const char = val.slice(-1);
    if (char && !/^\d$/.test(char)) return; // Only allow digits

    const nextDigits = [...digits];
    nextDigits[index] = char;
    setDigits(nextDigits);
    setErrorMessage(null);

    // Auto-advance
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Keyboard navigation (Backspace regression & arrow keys)
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        setDigits(nextDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Paste handling: distribute digits across inputs
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = pasted[i] || '';
    }
    setDigits(nextDigits);
    setErrorMessage(null);

    const targetFocusIndex = Math.min(pasted.length, 5);
    inputRefs.current[targetFocusIndex]?.focus();
  };

  // Verification submission
  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const otpCode = digits.join('');
    if (otpCode.length !== 6) {
      setErrorMessage('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const res = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: otpCode,
          purpose,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg = json.message || 'Verification failed.';
        // Extract remaining attempts if provided in error message
        const match = msg.match(/(\d+)\s+attempt/i);
        if (match) {
          setRemainingAttempts(parseInt(match[1], 10));
        } else if (res.status === 429) {
          setRemainingAttempts(0);
        }
        throw new Error(msg);
      }

      setIsSuccess(true);
      setSuccessNotice('Email verified successfully!');
      setTimeout(() => {
        onVerified(json.data);
      }, 600);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Invalid verification code.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const isComplete = digits.every((d) => d.length === 1);

  return (
    <div className="border-border/30 bg-muted/20 w-full space-y-4 rounded-xl border p-4 text-center">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-2">
          {isSuccess ? (
            <ShieldCheck className="size-5 text-emerald-500" />
          ) : (
            <Mail className="text-primary size-5" />
          )}
          <h3 className="font-heading text-foreground text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-muted-foreground text-xs">
          {description || `A 6-digit confirmation code was sent to ${email}`}
        </p>
      </div>

      {/* Success Notification */}
      {successNotice && !isSuccess && (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 6 Discrete Digit Inputs */}
      <div className="flex items-center justify-center gap-2 sm:gap-2.5">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            disabled={isVerifying || isSuccess}
            className={`font-mono text-center text-lg font-bold transition-all focus:outline-none ${
              digit
                ? 'border-primary bg-background text-foreground ring-primary/20 ring-2'
                : 'border-border/40 bg-card/60 text-muted-foreground'
            } h-11 w-10 rounded-lg border sm:h-12 sm:w-11`}
            aria-label={`Digit ${idx + 1} of verification code`}
          />
        ))}
      </div>

      {/* Remaining Attempts Warning */}
      {remainingAttempts !== null && remainingAttempts > 0 && (
        <p className="text-[11px] font-medium text-amber-500">
          ⚠️ {remainingAttempts} verification attempt{remainingAttempts === 1 ? '' : 's'} remaining
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="button"
          variant="pill-primary"
          onClick={() => handleVerify()}
          disabled={!isComplete || isVerifying || isSuccess}
          className="w-full text-xs font-semibold"
        >
          {isVerifying ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              Verifying Code...
            </span>
          ) : isSuccess ? (
            <span className="flex items-center justify-center gap-2 text-emerald-100">
              <CheckCircle2 className="size-3.5" />
              Verified
            </span>
          ) : (
            'Verify Email Code'
          )}
        </Button>

        {/* Resend Cooldown Controls */}
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => handleRequestOtp(true)}
            disabled={cooldown > 0 || isSending || isSuccess}
            className="text-primary hover:text-primary/80 flex items-center gap-1 font-medium disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            <RefreshCw className={`size-3 ${isSending ? 'animate-spin' : ''}`} />
            {cooldown > 0
              ? `Resend code in ${cooldown}s`
              : isSending
                ? 'Sending fresh code...'
                : 'Resend code'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OtpInput;

