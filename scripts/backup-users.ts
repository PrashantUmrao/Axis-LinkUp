/* eslint-disable no-console */
/**
 * Axis LinkUp — MongoDB User Collection Backup Utility.
 * Exports the complete User collection to a timestamped JSON file.
 * Run before any destructive or reset operation.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/db/mongodb';
import { UserModel } from '../src/lib/db/models/user.model';

async function backupUsers() {
  console.log('\n======================================================');
  console.log('   Axis LinkUp — User Collection Snapshot Backup      ');
  console.log('======================================================\n');

  console.log('Connecting to MongoDB Atlas...');
  await connectToDatabase();
  console.log('Connected to MongoDB Atlas.\n');

  const users = await UserModel.find({}).lean();
  console.log(`Exporting ${users.length} user records...`);

  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `backup-users-${timestamp}.json`);

  fs.writeFileSync(backupFilePath, JSON.stringify(users, null, 2), 'utf-8');

  console.log(`[SUCCESS] Backup successfully written to:`);
  console.log(` -> ${backupFilePath}`);
  console.log(`Total records: ${users.length}`);

  // Quick verification read
  const readBack = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'));
  if (Array.isArray(readBack) && readBack.length === users.length) {
    console.log('[VERIFICATION] Backup file verified readable and complete.');
  } else {
    throw new Error('Backup verification failed! File content mismatch.');
  }

  await mongoose.disconnect();
}

backupUsers().catch((err) => {
  console.error('[BACKUP FAILED]', err);
  process.exit(1);
});

