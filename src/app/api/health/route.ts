import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';

export const dynamic = 'force-dynamic';

type DatabaseReadiness = 'connected' | 'configured' | 'unconfigured' | 'error';

/**
 * Safely resolves MongoDB readiness without hanging or leaking credentials/stack traces.
 */
async function checkDatabaseReadiness(): Promise<DatabaseReadiness> {
  if (!process.env.MONGODB_URI) {
    return 'unconfigured';
  }

  // Already connected via pooled Mongoose client
  if (mongoose.connection.readyState === 1) {
    return 'connected';
  }

  try {
    const timeoutMs = 2000;
    const outcome = await Promise.race<'connected' | 'timeout'>([
      connectToDatabase().then(() => 'connected' as const),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs)),
    ]);

    if (outcome === 'connected' && Number(mongoose.connection.readyState) === 1) {
      return 'connected';
    }
    return 'configured';
  } catch {
    return 'error';
  }
}

/**
 * GET /api/health
 * Master non-secret platform readiness probe for deployment health checks and uptime monitors.
 * Strictly prohibits leaking credentials, URIs, API keys, or stack traces.
 */
export async function GET() {
  const database = await checkDatabaseReadiness();

  const authConfigured = Boolean(
    process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );
  const realtimeConfigured = Boolean(process.env.ABLY_API_KEY);
  const storageConfigured = Boolean(
    process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
  const emailConfigured = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

  const isDatabaseReady = database === 'connected' || database === 'configured';
  const status = isDatabaseReady && authConfigured ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database,
        auth: {
          provider: 'clerk',
          configured: authConfigured,
        },
        realtime: {
          provider: 'ably',
          configured: realtimeConfigured,
        },
        storage: {
          provider: 'cloudinary',
          configured: storageConfigured,
        },
        email: {
          configured: emailConfigured,
        },
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
