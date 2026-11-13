/**
 * Master API Response Utilities.
 * Standardizes API responses across Route Handlers and Server Actions.
 * Aligns with DOC-ENG-004 (API & Server Action Standards).
 */

import { NextResponse } from 'next/server';
import { ERROR_CODES, ERROR_CODE_TO_HTTP_STATUS, type ErrorCode } from '@/lib/errors/error-codes';
import { HTTP_STATUS, type HttpStatusCode } from '@/config/constants';
import type {
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedApiResponse,
  OffsetPaginationMeta,
  CursorPaginationMeta,
  PaginationMeta,
} from '@/types/api';

/**
 * Creates an offset pagination metadata object.
 */
export function createOffsetPaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number
): OffsetPaginationMeta {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const safeTotalItems = Math.max(0, totalItems);
  const totalPages = Math.ceil(safeTotalItems / safePageSize);
  const hasMore = safePage < totalPages;

  return {
    currentPage: safePage,
    pageSize: safePageSize,
    totalItems: safeTotalItems,
    totalPages,
    hasMore,
  };
}

/**
 * Creates a cursor-based pagination metadata object.
 */
export function createCursorPaginationMeta(
  limit: number,
  nextCursor: string | null,
  hasMore: boolean
): CursorPaginationMeta {
  return {
    limit: Math.max(1, limit),
    nextCursor,
    hasMore,
  };
}

/**
 * Builds a standardized success payload object (Server Action / RPC safe).
 */
export function createSuccessPayload<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    ...(message ? { message } : {}),
    data,
    error: null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Builds a standardized paginated payload object (Server Action / RPC safe).
 */
export function createPaginatedPayload<T>(
  items: T[],
  pagination: PaginationMeta,
  message?: string
): PaginatedApiResponse<T> {
  return {
    success: true,
    ...(message ? { message } : {}),
    data: items,
    pagination,
    error: null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Builds a standardized error payload object (Server Action / RPC safe).
 */
export function createErrorPayload(
  message: string,
  code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    message,
    data: null,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Returns a Next.js JSON response for successful operations (HTTP 200 by default).
 */
export function successResponse<T>(
  data: T,
  message?: string,
  statusCode: HttpStatusCode = HTTP_STATUS.OK
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(createSuccessPayload(data, message), {
    status: statusCode,
  });
}

/**
 * Returns a Next.js JSON response for created resources (HTTP 201).
 */
export function createdResponse<T>(
  data: T,
  message: string = 'Resource created successfully'
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(createSuccessPayload(data, message), {
    status: HTTP_STATUS.CREATED,
  });
}

/**
 * Returns a Next.js JSON response for paginated collections (HTTP 200).
 */
export function paginatedResponse<T>(
  items: T[],
  pagination: PaginationMeta,
  message?: string,
  statusCode: HttpStatusCode = HTTP_STATUS.OK
): NextResponse<PaginatedApiResponse<T>> {
  return NextResponse.json(createPaginatedPayload(items, pagination, message), {
    status: statusCode,
  });
}

/**
 * Returns a Next.js JSON response for error conditions.
 */
export function errorResponse(
  message: string,
  code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
  statusCode?: HttpStatusCode,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const resolvedStatus =
    statusCode ?? ERROR_CODE_TO_HTTP_STATUS[code] ?? HTTP_STATUS.INTERNAL_SERVER_ERROR;
  return NextResponse.json(createErrorPayload(message, code, details), {
    status: resolvedStatus,
  });
}
