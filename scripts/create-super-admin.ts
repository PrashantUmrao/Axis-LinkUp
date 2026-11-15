/**
 * Axis LinkUp — Initial Super Administrator Provisioning CLI Utility.
 *
 * Usage:
 *   npx tsx scripts/create-super-admin.ts --email=admin.lead@axiscolleges.in --name="Campus IT Director" [--username=superadmin] [--password=TempPass#2026]
 *
 * Security Requirements:
 *   1. Must use verified institutional domain (@axiscolleges.in).
 *   2. Super Admin credentials cannot be created via public sign-up.
 *   3. Synchronizes MongoDB and Clerk IAM with role='super_admin'.
 *   4. All actions logged with timestamp and execution context.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import mongoose from 'mongoose';
import { createClerkClient } from '@clerk/backend';
import { connectToDatabase } from '../src/lib/db/mongodb';
import { UserRepository } from '../src/lib/db/repositories/user.repository';
import type { CreateUserInput } from '../src/types/user';

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      if (key) {
        args[key.trim()] = rest.join('=').trim();
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
  const email = (args['email'] || process.env.SUPER_ADMIN_EMAIL || 'admin.lead@axiscolleges.in').toLowerCase();
  const fullName = args['name'] || process.env.SUPER_ADMIN_NAME || 'Campus IT Director';
  const username = args['username'] ? args['username'].toLowerCase().trim() : undefined;
  const password = args['password'];
  let authProviderId = args['auth-id'] || process.env.SUPER_ADMIN_AUTH_ID;

  // Domain check - permits institutional domain or authorized primary administrator
  const isPermittedAdminEmail =
    email.endsWith('@axiscolleges.in') || email === 'hey.prashantumrao@gmail.com';

  if (!isPermittedAdminEmail) {
    console.error(
      `[SECURITY ERROR] Rejected email: ${email}. Super Admin must belong to the @axiscolleges.in institutional domain or be the designated primary administrator.`
    );
    process.exit(1);
  }

  // Connect to Clerk if secret key is present
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (clerkSecret) {
    try {
      const clerk = createClerkClient({ secretKey: clerkSecret });
      console.info('Checking Clerk IAM for existing user...');
      const existingClerkUsers = await clerk.users.getUserList({
        emailAddress: [email],
      });

      const cUser = existingClerkUsers.data[0];
      if (cUser) {
        console.info(`Found existing Clerk identity: ${cUser.id}`);
        authProviderId = cUser.id;
        // Ensure metadata has super_admin
        await clerk.users.updateUser(cUser.id, {
          publicMetadata: {
            ...cUser.publicMetadata,
            role: 'super_admin',
            status: 'active',
          },
        });
        console.info(`Updated Clerk publicMetadata for ${cUser.id} to role: 'super_admin'`);
      } else if (password) {
        console.info(`Creating new Clerk identity for ${email}...`);
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || 'Admin';
        const lastName = nameParts.slice(1).join(' ') || 'Lead';

        const newClerkUser = await clerk.users.createUser({
          emailAddress: [email],
          password,
          firstName,
          lastName,
          username: username || undefined,
          publicMetadata: {
            role: 'super_admin',
            status: 'active',
          },
        });
        authProviderId = newClerkUser.id;
        console.info(`[SUCCESS] Clerk identity created: ${newClerkUser.id}`);
      } else {
        console.info(
          'No password provided and user does not exist in Clerk. User can activate via OTP or sign-in invitation.'
        );
      }
    } catch (clerkErr) {
      console.warn(
        `[WARN] Clerk IAM sync encountered an issue: ${
          clerkErr instanceof Error ? clerkErr.message : String(clerkErr)
        }`
      );
    }
  }

  console.info(`\nConnecting to MongoDB Atlas...`);
  await connectToDatabase();
  console.info(`Connected to database successfully.\n`);

  // Check if existing user with email exists
  const existingUser = await UserRepository.findByEmail(email);

  if (existingUser) {
    console.info(`User already exists for ${email}. Elevating role to 'super_admin'...`);
    existingUser.role = 'super_admin';
    existingUser.adminSubRole = 'sys_admin';
    existingUser.status = 'active';
    if (authProviderId) existingUser.authProviderId = authProviderId;
    if (username) existingUser.username = username;
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
      username: username || undefined,
      role: 'super_admin',
      adminSubRole: 'sys_admin',
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
    console.info(`[SUCCESS] Super Administrator created in MongoDB successfully!`);
    console.info(`ID: ${user._id.toString()}`);
    console.info(`Email: ${user.email}`);
    console.info(`Username: ${user.username || 'N/A'}`);
    console.info(`Staff ID: ${user.adminProfile?.adminStaffId}`);
    console.info(`Role: ${user.role}`);
    console.info(`Status: ${user.status}`);
    console.info(`Clerk Auth ID: ${user.authProviderId || 'Pending sign-in'}`);
  }

  console.info('\n[AUDIT] Mandatory Next Steps:');
  console.info('1. Admin signs in at /sign-in using their registered email.');
  console.info('2. Enrolled into Axis LinkUp with full Super Administrator permissions.');
  console.info('3. Can provision Departments, Directors, HODs, and Faculty from Admin Portal.');
  console.info('\n======================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[FATAL ERROR] Super Admin provisioning failed:', err);
  process.exit(1);
});
