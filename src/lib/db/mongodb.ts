import mongoose, { type Mongoose } from 'mongoose';

/**
 * Global interface augmentation to cache the Mongoose connection promise
 * across serverless invocations and Next.js hot reloads in development.
 */
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
  disconnectListenerAttached?: boolean;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
  disconnectListenerAttached: false,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Validates the MongoDB connection URI without exposing sensitive credentials.
 */
function getValidatedMongoUri(): string {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.trim() === '') {
    throw new Error(
      'Database configuration error: MONGODB_URI environment variable is not defined.'
    );
  }

  const trimmedUri = uri.trim();
  if (!trimmedUri.startsWith('mongodb://') && !trimmedUri.startsWith('mongodb+srv://')) {
    throw new Error(
      'Database configuration error: MONGODB_URI must begin with "mongodb://" or "mongodb+srv://".'
    );
  }

  return trimmedUri;
}

/**
 * Attaches a one-time Mongoose `disconnected` event listener so transient
 * network drops immediately clear the singleton cache and trigger clean reconnection (AUD-H15).
 */
function ensureDisconnectListener(conn: mongoose.Connection): void {
  if (cached.disconnectListenerAttached) return;
  cached.disconnectListenerAttached = true;

  conn.on('disconnected', () => {
    cached.conn = null;
    cached.promise = null;
  });
}

/**
 * Reusable, singleton connection utility for MongoDB Atlas via Mongoose.
 * Reuses the existing connection during hot-reloads and concurrent requests,
 * and automatically clears stale cache handles if readyState drops from 1 (AUD-H15).
 *
 * @returns {Promise<Mongoose>} The active Mongoose instance.
 */
export async function connectToDatabase(): Promise<Mongoose> {
  // If an active connection exists, return it immediately
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  // AUD-H15: If a cached connection exists but dropped (readyState !== 1),
  // clear BOTH cached.conn and cached.promise so Mongoose reconnects cleanly.
  if (cached.conn && cached.conn.connection.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  // If a connection promise is currently resolving, await it
  if (!cached.promise) {
    const uri = getValidatedMongoUri();

    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose
      .connect(uri, opts)
      .then((mongooseInstance) => {
        ensureDisconnectListener(mongooseInstance.connection);
        return mongooseInstance;
      })
      .catch((err: unknown) => {
        // Reset cached promise so subsequent attempts can retry
        cached.conn = null;
        cached.promise = null;
        // Log safe message without leaking credentials or full URI
        const message = err instanceof Error ? err.message : 'Unknown database error';
        console.error('Database connection failed:', message);
        throw new Error(
          'Database connection failed. Please verify network access and credentials.'
        );
      });
  }

  try {
    cached.conn = await cached.promise;
    if (cached.conn.connection.readyState !== 1) {
      cached.conn = null;
      cached.promise = null;
    }
  } catch (error) {
    cached.conn = null;
    cached.promise = null;
    throw error;
  }

  if (!cached.conn) {
    throw new Error('Database connection is not ready. Please retry.');
  }

  return cached.conn;
}

/**
 * Helper to inspect the current database connection state.
 */
export function getDatabaseState(): {
  isConnected: boolean;
  readyState: number;
  status: string;
} {
  const state = mongoose.connection.readyState;
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    isConnected: state === 1,
    readyState: state,
    status: states[state] ?? 'unknown',
  };
}

export default connectToDatabase;
