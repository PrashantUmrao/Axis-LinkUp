/**
 * Axis LinkUp — One-Time Controlled Root System Administrator Bootstrap CLI (P0 Batch 1).
 *
 * Strictly CLI/environment-driven and NEVER executable via HTTP.
 * Zero hardcoded emails, usernames, or passwords.
 *
 * Usage:
 *   BOOTSTRAP_ADMIN_EMAIL=sysadmin@axiscolleges.in \
 *   BOOTSTRAP_ADMIN_USERNAME=sysadmin \
 *   BOOTSTRAP_ADMIN_FULLNAME="Campus System Administrator" \
 *   npx tsx scripts/bootstrap-root-admin.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/db/mongodb';
import { UserRepository } from '../src/lib/db/repositories/user.repository';
import type { CreateUserInput } from '../src/types/user';

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const fullName = process.env.BOOTSTRAP_ADMIN_FULLNAME?.trim();

  if (!email || !email.includes('@')) {
    console.error(
      '[ERROR] BOOTSTRAP_ADMIN_EMAIL environment variable is required and must be a valid email address.'
    );
    process.exit(1);
  }

  if (!fullName || fullName.length < 2) {
    console.error(
      '[ERROR] BOOTSTRAP_ADMIN_FULLNAME environment variable is required (min 2 characters).'
    );
    process.exit(1);
  }

  console.info('[Bootstrap] Connecting to MongoDB Atlas...');
  await connectToDatabase();

  const existingUser =
    (await UserRepository.findByEmail(email)) ||
    (username ? await UserRepository.findByUsername(username) : null);

  if (existingUser) {
    // Idempotent elevation: ensure existing pre-provisioned root admin holds active sys_admin privileges
    existingUser.role = 'super_admin';
    existingUser.adminSubRole = 'sys_admin';
    existingUser.status = 'active';
    existingUser.isProfileComplete = true;
    if (username && !existingUser.username) {
      existingUser.username = username;
    }
    if (!existingUser.adminProfile) {
      const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      existingUser.adminProfile = {
        adminStaffId: `SA-${suffix}`,
        administrativeDomain: 'Central IT Administration',
        assignedQueueScopes: ['all'],
        emergencyOverridePermitted: true,
      };
    }
    await existingUser.save();
    console.info(
      `[Bootstrap] Idempotent update complete for root System Administrator (id: ${existingUser._id.toString()}, staffId: ${existingUser.adminProfile.adminStaffId}).`
    );
  } else {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const createInput: CreateUserInput = {
      email,
      fullName,
      username: username || undefined,
      role: 'super_admin',
      adminSubRole: 'sys_admin',
      status: 'active',
      isProfileComplete: true,
      adminProfile: {
        adminStaffId: `SA-${suffix}`,
        administrativeDomain: 'Central IT Administration',
        assignedQueueScopes: ['all'],
        emergencyOverridePermitted: true,
      },
    };
    const created = await UserRepository.create(createInput);
    console.info(
      `[Bootstrap] Created root System Administrator in MongoDB (id: ${created._id.toString()}, staffId: ${created.adminProfile?.adminStaffId}).`
    );
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(
    '[Bootstrap] Fatal error:',
    err instanceof Error ? err.message : String(err)
  );
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors during fatal exit
  }
  process.exit(1);
});
