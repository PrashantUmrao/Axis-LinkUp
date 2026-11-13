/**
 * Common shared TypeScript utility types.
 * Pure type definitions with zero runtime overhead.
 */

/**
 * Allows a type to be explicitly null.
 */
export type Nullable<T> = T | null;

/**
 * Allows a type to be explicitly undefined.
 */
export type Optional<T> = T | undefined;

/**
 * Recursively makes all properties of an object optional.
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * Sorting direction for tabular queries.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * The four approved institutional user roles for Axis LinkUp.
 */
export type UserRole = 'student' | 'faculty' | 'admin' | 'super_admin';

/**
 * String alias representing a 24-character hex MongoDB ObjectId.
 */
export type ObjectIdString = string;

/**
 * String alias representing an ISO-8601 formatted date string.
 */
export type ISODateString = string;
