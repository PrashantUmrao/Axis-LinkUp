/**
 * Axis LinkUp — Safe, Idempotent MongoDB Partial Unique Index Migration (P0 Batch 3).
 *
 * Addresses:
 * - AUD-C06: Replaces legacy sparse compound index `directKey_1_type_1` (and redundant `directKey_1`)
 *            on `conversations` with partial unique index scoped to `{ type: 'direct', directKey: { $type: 'string' } }`.
 * - AUD-C07: Replaces legacy sparse unique indexes (`username_1`, `authProviderId_1`,
 *            `studentProfile.rollNumber_1`, `facultyProfile.employeeId_1`, `adminProfile.adminStaffId_1`)
 *            on `users` with `$type: 'string', $gt: ''` partial unique indexes.
 * - AUD-C10: Ensures `audit_logs` indexes (including unique `previousHash`) are synced.
 *
 * Usage:
 *   npx tsx scripts/migrate-p0-indexes.ts --dry-run
 *   npx tsx scripts/migrate-p0-indexes.ts
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/db/mongodb';
import { ConversationModel } from '../src/lib/db/models/conversation.model';
import { UserModel } from '../src/lib/db/models/user.model';
import { AuditLogModel } from '../src/lib/db/models/audit-log.model';

export interface ExistingMongoIndex {
  name: string;
  key: Record<string, unknown>;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

export const TARGET_CONVERSATION_LEGACY_INDEXES = new Set([
  'directKey_1_type_1',
  'directKey_1',
]);

export const TARGET_USER_LEGACY_INDEXES = new Set([
  'username_1',
  'authProviderId_1',
  'studentProfile.rollNumber_1',
  'facultyProfile.employeeId_1',
  'adminProfile.adminStaffId_1',
]);

/**
 * Pure classifier identifying legacy sparse/non-partial indexes that must be dropped
 * prior to calling `syncIndexes()` so MongoDB does not reject index option conflicts.
 */
export function identifyLegacyIndexesToDrop(
  existingIndexes: ExistingMongoIndex[],
  targetNames: Set<string>
): string[] {
  const toDrop: string[] = [];

  for (const idx of existingIndexes) {
    if (!idx.name || idx.name === '_id_') continue;
    if (!targetNames.has(idx.name)) continue;

    // Legacy `directKey_1` single-field index is always redundant with compound partial index
    if (idx.name === 'directKey_1') {
      toDrop.push(idx.name);
      continue;
    }

    // Any target unique index lacking partialFilterExpression (or still carrying sparse: true) must be rebuilt
    const hasPartial = Boolean(
      idx.partialFilterExpression && Object.keys(idx.partialFilterExpression).length > 0
    );
    if (!hasPartial || idx.sparse === true) {
      toDrop.push(idx.name);
    }
  }

  return toDrop;
}

async function migrateCollectionIndexes(
  collectionLabel: string,
  model: mongoose.Model<unknown>,
  targetNames: Set<string>,
  dryRun: boolean
): Promise<void> {
  const existing = (await model.collection.indexes()) as ExistingMongoIndex[];
  const toDrop = identifyLegacyIndexesToDrop(existing, targetNames);

  if (toDrop.length === 0) {
    console.info(`[MigrateIndexes] ${collectionLabel}: No legacy sparse indexes found to drop.`);
  } else {
    for (const indexName of toDrop) {
      if (dryRun) {
        console.info(
          `[MigrateIndexes] [DRY-RUN] Would drop legacy index "${indexName}" on ${collectionLabel}.`
        );
      } else {
        console.info(
          `[MigrateIndexes] Dropping legacy index "${indexName}" on ${collectionLabel}...`
        );
        await model.collection.dropIndex(indexName);
      }
    }
  }

  if (dryRun) {
    console.info(
      `[MigrateIndexes] [DRY-RUN] Would execute ${collectionLabel}.syncIndexes() to apply partial unique indexes.`
    );
  } else {
    console.info(`[MigrateIndexes] Running ${collectionLabel}.syncIndexes()...`);
    const droppedBySync = await model.syncIndexes();
    console.info(
      `[MigrateIndexes] ${collectionLabel} syncIndexes complete (dropped during sync: ${droppedBySync.length}).`
    );
  }
}

async function main() {
  dotenv.config({ path: '.env.local' });
  dotenv.config({ path: '.env' });

  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.MONGODB_URI) {
    console.error('[MigrateIndexes] MONGODB_URI is not configured in environment.');
    process.exit(1);
  }

  console.info(
    `[MigrateIndexes] Starting P0 Batch 3 index migration (${dryRun ? 'DRY-RUN' : 'LIVE'})...`
  );
  await connectToDatabase();

  try {
    await migrateCollectionIndexes(
      'conversations',
      ConversationModel as unknown as mongoose.Model<unknown>,
      TARGET_CONVERSATION_LEGACY_INDEXES,
      dryRun
    );

    await migrateCollectionIndexes(
      'users',
      UserModel as unknown as mongoose.Model<unknown>,
      TARGET_USER_LEGACY_INDEXES,
      dryRun
    );

    if (dryRun) {
      console.info(
        '[MigrateIndexes] [DRY-RUN] Would execute audit_logs.syncIndexes() to ensure unique previousHash chain index.'
      );
    } else {
      console.info('[MigrateIndexes] Running audit_logs.syncIndexes()...');
      await AuditLogModel.syncIndexes();
      console.info('[MigrateIndexes] audit_logs syncIndexes complete.');
    }

    console.info(
      `[MigrateIndexes] Completed successfully (${dryRun ? 'DRY-RUN — no changes committed' : 'LIVE'}).`
    );
  } finally {
    await mongoose.disconnect();
  }
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/migrate-p0-indexes.ts');

if (isDirectExecution) {
  main().catch((err) => {
    console.error(
      '[MigrateIndexes] Fatal migration error:',
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  });
}
