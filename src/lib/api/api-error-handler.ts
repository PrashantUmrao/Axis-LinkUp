/**
 * Centralized API & Server Action Error Handlers.
 * Transforms exceptions into sanitized, standardized client error envelopes.
 * Logs diagnostic traces on the server while protecting internal details.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from '@/lib/errors/app-error';
import { ERROR_CODES, type ErrorCode } from '@/lib/errors/error-codes';
import { createErrorPayload } from '@/lib/api/api-response';
import { logger } from '@/lib/logging/logger';
import { HTTP_STATUS, type HttpStatusCode } from '@/config/constants';
import type { ApiErrorResponse, ApiValidationErrorDetail } from '@/types/api';

interface MongooseErrorLike {
  name?: string;
  code?: number;
  keyPattern?: Record<string, number>;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, { path?: string; message?: string }>;
}

/**
 * Normalizes any caught exception into a structured, client-safe error representation.
 */
function normalizeError(error: unknown): {
  statusCode: HttpStatusCode;
  code: ErrorCode;
  message: string;
  details?: unknown;
} {
  // 1. Known Application Operational Errors
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // 2. Malformed JSON Syntax Errors (AUD-H15)
  if (error instanceof SyntaxError) {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: ERROR_CODES.BAD_REQUEST,
      message: 'Malformed JSON request body.',
    };
  }

  // 3. Zod Validation Errors
  if (error instanceof ZodError) {
    const formattedDetails: ApiValidationErrorDetail[] = error.issues.map((issue) => ({
      field: issue.path.join('.') || 'root',
      message: issue.message,
    }));

    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Invalid request payload. Please correct the highlighted errors.',
      details: formattedDetails,
    };
  }

  // 4. Mongoose / MongoDB Database Errors (AUD-H15: sanitized — never leak raw keyPattern or schema internals)
  if (typeof error === 'object' && error !== null) {
    const mongoErr = error as MongooseErrorLike;

    // Duplicate key violation (E11000)
    if (mongoErr.code === 11000) {
      return {
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.CONFLICT,
        message: 'A record with these unique details already exists.',
      };
    }

    // Invalid ObjectId format (CastError)
    if (mongoErr.name === 'CastError') {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Invalid resource identifier format.',
      };
    }

    // Mongoose Schema Validation Error (sanitized without raw schema paths/internals)
    if (mongoErr.name === 'ValidationError' && mongoErr.errors) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Submitted data failed validation. Please review your input and try again.',
      };
    }
  }

  // 4. Fallback for unhandled / unknown exceptions
  return {
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'An unexpected internal error occurred. Please try again later.',
  };
}

/**
 * Handles errors occurring within Route Handlers (src/app/api/*).
 * Returns a standardized Next.js JSON response.
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  const normalized = normalizeError(error);

  // Diagnostic server-side logging (retains stack trace on server, never sent to client)
  if (normalized.statusCode >= 500) {
    logger.error(`API 5xx Internal Error: ${normalized.message}`, error, {
      code: normalized.code,
      statusCode: normalized.statusCode,
    });
  } else {
    logger.warn(`API ${normalized.statusCode} Operational Warning: ${normalized.message}`, {
      code: normalized.code,
      details: normalized.details,
    });
  }

  return NextResponse.json(
    createErrorPayload(normalized.message, normalized.code, normalized.details),
    { status: normalized.statusCode }
  );
}

/**
 * Handles errors occurring within Server Actions (src/app/actions/* or src/features/*).
 * Returns a standardized error payload object.
 */
export function handleActionError(error: unknown): ApiErrorResponse {
  const normalized = normalizeError(error);

  if (normalized.statusCode >= 500) {
    logger.error(`Action 5xx Internal Error: ${normalized.message}`, error, {
      code: normalized.code,
      statusCode: normalized.statusCode,
    });
  } else {
    logger.warn(`Action ${normalized.statusCode} Operational Warning: ${normalized.message}`, {
      code: normalized.code,
      details: normalized.details,
    });
  }

  return createErrorPayload(normalized.message, normalized.code, normalized.details);
}
