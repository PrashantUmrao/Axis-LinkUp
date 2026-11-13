/**
 * Centralized Application Error Classes.
 * Structured, type-safe error hierarchies for operational error handling.
 */

import { ERROR_CODES, ERROR_CODE_TO_HTTP_STATUS, type ErrorCode } from './error-codes';
import type { HttpStatusCode } from '@/config/constants';

/**
 * Base Application Error.
 * All domain, validation, and operational errors derive from this class.
 */
export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    statusCode?: HttpStatusCode,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode ?? ERROR_CODE_TO_HTTP_STATUS[code] ?? 500;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when request payload fails schema validation (HTTP 400).
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, details, true);
  }
}

/**
 * Thrown when a request is malformed or invalid (HTTP 400).
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: unknown) {
    super(message, ERROR_CODES.BAD_REQUEST, 400, details, true);
  }
}

/**
 * Thrown when authentication is missing or token is invalid (HTTP 401).
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required. Please sign in.') {
    super(message, ERROR_CODES.UNAUTHORIZED, 401, undefined, true);
  }
}

/**
 * Thrown when the authenticated user lacks authorization for the resource (HTTP 403).
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = 'Access denied. You do not have permission to perform this action.'
  ) {
    super(message, ERROR_CODES.FORBIDDEN, 403, undefined, true);
  }
}

/**
 * Thrown when a requested resource does not exist (HTTP 404).
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', identifier?: string) {
    const message = identifier
      ? `${resource} with identifier "${identifier}" was not found.`
      : `${resource} was not found.`;
    super(message, ERROR_CODES.NOT_FOUND, 404, undefined, true);
  }
}

/**
 * Thrown when a unique constraint or state conflict occurs (HTTP 409).
 */
export class ConflictError extends AppError {
  constructor(
    message: string = 'A resource with these details already exists.',
    details?: unknown
  ) {
    super(message, ERROR_CODES.CONFLICT, 409, details, true);
  }
}

/**
 * Thrown when a semantic institutional business rule is violated (HTTP 422).
 */
export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ERROR_CODES.BUSINESS_RULE_VIOLATION, 422, details, true);
  }
}

/**
 * Thrown when rate limits are exceeded (HTTP 429).
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(message, ERROR_CODES.RATE_LIMIT_EXCEEDED, 429, undefined, true);
  }
}

/**
 * Thrown when an internal database error occurs (HTTP 500).
 * Never exposes raw database query text or credentials to the client.
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'A database error occurred while processing your request.') {
    super(message, ERROR_CODES.DATABASE_ERROR, 500, undefined, true);
  }
}

/**
 * Generic internal server error (HTTP 500).
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'An unexpected internal error occurred. Please try again later.') {
    super(message, ERROR_CODES.INTERNAL_ERROR, 500, undefined, false);
  }
}
