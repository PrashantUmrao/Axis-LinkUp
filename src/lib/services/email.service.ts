/**
 * Institutional Email Dispatch Service (AUD-C08).
 * Dispatches real transactional emails via the Resend REST API using native fetch
 * with a strict 10-second timeout.
 * - Production: fails closed if RESEND_API_KEY is missing or Resend returns an error.
 * - Development / Test: safely simulates delivery ONLY when RESEND_API_KEY is unset.
 * Never outputs raw OTP codes or API secrets in application logs.
 */

import { logger } from '@/lib/logging/logger';
import { AppError } from '@/lib/errors/app-error';
import { ERROR_CODES } from '@/lib/errors/error-codes';
import { HTTP_STATUS } from '@/config/constants';
import type { OtpPurpose } from '@/types/otp';

export const RESEND_API_URL = 'https://api.resend.com/emails';
export const EMAIL_DISPATCH_TIMEOUT_MS = 10_000;

export interface SendOtpEmailParams {
  to: string;
  otpCode: string;
  purpose: OtpPurpose;
  expiresInMinutes?: number;
  recipientName?: string;
}

export interface SendTransactionalEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  category?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId: string;
  provider: 'simulated' | 'smtp' | 'resend';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPurposeTitle(purpose: OtpPurpose): string {
  switch (purpose) {
    case 'password_recovery':
      return 'Password Recovery Verification Code';
    case 'account_activation':
      return 'Account Activation Verification Code';
    case 'email_verification':
      return 'Institutional Email Verification Code';
    default:
      return 'Axis LinkUp Verification Code';
  }
}

export class EmailService {
  /**
   * Helper to mask email address for safe audit logging.
   * e.g. "aarav.sharma@axiscolleges.in" -> "aa***@axiscolleges.in"
   */
  public static maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return '***';
    }
    const [localPart = '', domain = ''] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart}***@${domain}`;
    }
    return `${localPart.slice(0, 2)}***@${domain}`;
  }

  /**
   * Resolves the sender address for outbound institutional emails.
   */
  public static getSenderAddress(): string {
    return (
      process.env.EMAIL_FROM?.trim() ||
      process.env.RESEND_FROM_EMAIL?.trim() ||
      'Axis LinkUp <no-reply@axiscolleges.in>'
    );
  }

  /**
   * Dispatches a transactional email via Resend REST API when RESEND_API_KEY is configured.
   * Fails closed in production if unconfigured or if Resend returns a non-2xx response.
   */
  public static async sendTransactionalEmail(
    params: SendTransactionalEmailParams
  ): Promise<EmailDispatchResult> {
    const masked = this.maskEmail(params.to);
    const category = params.category || 'transactional';
    const resendApiKey = process.env.RESEND_API_KEY?.trim();

    if (resendApiKey) {
      const from = this.getSenderAddress();
      let response: Response;

      try {
        response = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [params.to],
            subject: params.subject,
            html: params.html,
            text: params.text,
          }),
          signal: AbortSignal.timeout(EMAIL_DISPATCH_TIMEOUT_MS),
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Network timeout';
        logger.error(
          `[EmailService] Resend transport error delivering ${category} email to ${masked}`,
          { error: errMsg }
        );
        throw new AppError(
          'Unable to reach the institutional email gateway. Please try again shortly.',
          ERROR_CODES.INTERNAL_ERROR,
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      if (!response.ok) {
        let providerError = `HTTP ${response.status}`;
        try {
          const errBody = (await response.json()) as { message?: string; name?: string };
          if (errBody?.message) {
            providerError = `${response.status}: ${errBody.message}`;
          }
        } catch {
          // Ignore unparseable error bodies
        }

        logger.error(
          `[EmailService] Resend rejected ${category} email to ${masked} (${providerError})`
        );
        throw new AppError(
          'Failed to dispatch verification email via the institutional email gateway.',
          ERROR_CODES.INTERNAL_ERROR,
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      let messageId = `resend_${Date.now()}`;
      try {
        const body = (await response.json()) as { id?: string };
        if (body?.id && typeof body.id === 'string') {
          messageId = body.id;
        }
      } catch {
        // Fallback ID if response body is empty
      }

      logger.info(
        `[EmailService] Dispatched ${category} email to ${masked} via Resend Gateway (id=${messageId})`
      );

      return {
        success: true,
        messageId,
        provider: 'resend',
      };
    }

    // Production MUST fail closed rather than silently pretending to deliver emails
    if (process.env.NODE_ENV === 'production') {
      logger.error(
        `[EmailService] Production email dispatch aborted: RESEND_API_KEY is not configured (target=${masked})`
      );
      throw new AppError(
        'Transactional email service is not configured. Please contact the Campus System Administrator.',
        ERROR_CODES.INTERNAL_ERROR,
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    // Development / Sandbox / Automated Test Mode: Safe simulated delivery (never logs raw OTP)
    logger.info(
      `[EmailService] [DEV/SANDBOX] Simulated ${category} email delivery to ${masked}`
    );

    return {
      success: true,
      messageId: `simulated_${Date.now()}`,
      provider: 'simulated',
    };
  }

  /**
   * Dispatches OTP verification email.
   * Never leaks raw OTP in telemetry or application logs.
   */
  public static async sendOtpEmail(params: SendOtpEmailParams): Promise<EmailDispatchResult> {
    const purposeTitle = formatPurposeTitle(params.purpose);
    const expiryMinutes = params.expiresInMinutes ?? 5;
    const greeting = params.recipientName?.trim()
      ? `Hello ${escapeHtml(params.recipientName.trim())},`
      : 'Hello,';
    const plainGreeting = params.recipientName?.trim()
      ? `Hello ${params.recipientName.trim()},`
      : 'Hello,';

    const subject = `Axis LinkUp — ${purposeTitle}`;
    const safeOtp = escapeHtml(params.otpCode);

    const html = [
      '<div style="font-family:Inter,system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a;border:1px solid #e2e8f0;border-radius:12px;">',
      '<h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Axis Colleges — Axis LinkUp</h2>',
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${greeting}</p>`,
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Use the one-time verification code below to complete your <strong>${escapeHtml(purposeTitle.toLowerCase())}</strong>:</p>`,
      `<div style="margin:20px 0;padding:16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;text-align:center;font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace;color:#0f172a;">${safeOtp}</div>`,
      `<p style="margin:0 0 12px;font-size:13px;color:#475569;">This verification code expires in <strong>${expiryMinutes} minutes</strong> and can only be used once.</p>`,
      '<p style="margin:0;font-size:12px;color:#64748b;">If you did not initiate this request, you can safely ignore this email. Never share this code with anyone.</p>',
      '</div>',
    ].join('');

    const text = [
      'Axis Colleges — Axis LinkUp',
      '',
      plainGreeting,
      '',
      `Use this one-time verification code for your ${purposeTitle.toLowerCase()}: ${params.otpCode}`,
      '',
      `This code expires in ${expiryMinutes} minutes and can only be used once.`,
      'If you did not request this code, please ignore this email.',
    ].join('\n');

    return await this.sendTransactionalEmail({
      to: params.to,
      subject,
      html,
      text,
      category: params.purpose.replace(/_/g, ' '),
    });
  }
}

export default EmailService;
