import React from 'react';
import { notFound } from 'next/navigation';
import { isUiPreviewAllowed } from '@/lib/security/dev-route-guard';
import { UIPreviewClient } from './ui-preview-client';

export const dynamic = 'force-dynamic';

/**
 * Development-only Design System Showcase (/ui-preview).
 * Automatically returns HTTP 404 (notFound) in production builds (Phase 6.1).
 */
export default function UIPreviewPage() {
  if (!isUiPreviewAllowed()) {
    notFound();
  }

  return <UIPreviewClient />;
}
