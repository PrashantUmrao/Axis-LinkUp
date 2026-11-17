/**
 * Production guard utilities for development-only routes (Phase 6.1).
 */

/**
 * Determines whether the /ui-preview design system showcase may be served.
 * Strictly blocked (HTTP 404 via notFound()) in production environments while
 * remaining accessible during local development and test runs.
 */
export function isUiPreviewAllowed(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== 'production';
}
