import { NextResponse } from 'next/server';
import { connectToDatabase, getDatabaseState } from '@/lib/db/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();
    const { status } = getDatabaseState();

    return NextResponse.json(
      {
        success: true,
        message: 'Database connected successfully',
        database: status,
      },
      { status: 200 }
    );
  } catch (_error: unknown) {
    // Note: Do not return credentials, error details, or stack traces
    return NextResponse.json(
      {
        success: false,
        message: 'Database connection unavailable',
        database: 'disconnected',
      },
      { status: 503 }
    );
  }
}
