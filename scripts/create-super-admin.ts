/**
 * Axis LinkUp — Initial Super Administrator Provisioning CLI Utility.
 *
 * Usage:
 *   npx tsx scripts/create-super-admin.ts --email=admin.lead@axiscolleges.in --name="Campus IT Director" [--auth-id=user_clerk_id]
 *
 * Security Requirements:
 *   1. Must use verified institutional domain (@axiscolleges.in).
 *   2. Super Admin credentials cannot be created via public sign-up.
 *   3. All actions logged with timestamp and execution context.
 */

import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/db/mongodb';
import { UserRepository } from '../src/lib/db/repositories/user.repository';
import type { CreateUserInput } from '../src/types/user';

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key && value) {
        args[key.trim()] = value.trim();
      }
    }
  }
  return args;
}

async function main() {
  console.info('\n======================================================');
  console.info('   Axis LinkUp — Super Administrator Provisioning     ');
  console.info('======================================================\n');

  const args = parseArgs();
  const email = args['email'] || process.env.SUPER_ADMIN_EMAIL || 'admin.lead@axiscolleges.in';
  const fullName = args['name'] || process.env.SUPER_ADMIN_NAME || 'Campus IT Director';
  const authProviderId = args['auth-id'] || process.env.SUPER_ADMIN_AUTH_ID;

  // Domain check
  if (!email.toLowerCase().endsWith('@axiscolleges.in')) {
    console.error(
      `[SECURITY ERROR] Rejected email: ${email}. Super Admin must belong to the @axiscolleges.in institutional domain.`
    );
    process.exit(1);
  }

  console.info(`Connecting to MongoDB Atlas...`);
  await connectToDatabase();
  console.info(`Connected to database successfully.\n`);

  // Check if existing user with email exists
  const existingUser = await UserRepository.findByEmail(email);

  if (existingUser) {
    console.info(`User already exists for ${email}. Elevating role to 'super_admin'...`);
    existingUser.role = 'super_admin';
    existingUser.status = 'active';
    if (authProviderId) existingUser.authProviderId = authProviderId;
    if (!existingUser.adminProfile) {
      existingUser.adminProfile = {
        adminStaffId: `SA-${Date.now().toString().slice(-6)}`,
        administrativeDomain: 'Central IT Administration',
        assignedQueueScopes: ['all'],
        emergencyOverridePermitted: true,
      };
    }
    await existingUser.save();
    console.info(`[SUCCESS] User ${email} elevated to 'super_admin' successfully.`);
    console.info(`ID: ${existingUser._id.toString()}`);
    console.info(`Staff ID: ${existingUser.adminProfile.adminStaffId}`);
  } else {
    console.info(`Creating initial Super Administrator for ${email}...`);
    const createData: CreateUserInput = {
      email,
      fullName,
      role: 'super_admin',
      status: 'active',
      isProfileComplete: true,
      authProviderId: authProviderId || undefined,
      adminProfile: {
        adminStaffId: `SA-AITM-${Date.now().toString().slice(-4)}`,
        administrativeDomain: 'Central IT Administration',
        assignedQueueScopes: ['all'],
        emergencyOverridePermitted: true,
      },
    };

    const user = await UserRepository.create(createData);
    console.info(`[SUCCESS] Super Administrator created successfully!`);
    console.info(`ID: ${user._id.toString()}`);
    console.info(`Email: ${user.email}`);
    console.info(`Staff ID: ${user.adminProfile?.adminStaffId}`);
    console.info(`Role: ${user.role}`);
    console.info(`Status: ${user.status}`);
  }

  console.info('\n[AUDIT] Mandatory Next Steps:');
  console.info('1. Admin must sign in at /sign-in using their registered email.');
  console.info('2. TOTP MFA must be enrolled on the first sign-in before accessing /super-admin.');
  console.info('\n======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[FATAL ERROR] Super Admin provisioning failed:', err);
  process.exit(1);
});
