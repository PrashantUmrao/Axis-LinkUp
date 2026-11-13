/**
 * Master API response envelopes and pagination types.
 * Adheres to Axis LinkUp API Standards (DOC-ENG-004).
 */

export interface ApiValidationErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
  error: null;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  message?: string;
  data: null;
  error: ApiErrorDetail;
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface OffsetPaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CursorPaginationMeta {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export type PaginationMeta = OffsetPaginationMeta | CursorPaginationMeta;

export interface PaginatedApiResponse<T> {
  success: true;
  message?: string;
  data: T[];
  pagination: PaginationMeta;
  error: null;
  timestamp: string;
}
