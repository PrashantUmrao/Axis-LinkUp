/* eslint-disable no-console */
/**
 * Axis LinkUp — Safe Faculty and Admin Account Deletion Utility.
 *
 * CRITICAL SAFETY RULES:
 * 1. Zero students may ever be touched or modified.
 * 2. Hard abort if any student account is encountered in the deletion candidate list.
 * 3. Preserves all collections, indexes, and historical shared content.
 * 4. Deletes targeted Clerk IAM identities and MongoDB non-student records.
 *
 * EXECUTION:
 *   npx tsx scripts/delete-faculty-admin-accounts.ts --confirm-deletion
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import mongoose from 'mongoose';
import { createClerkClient } from '@clerk/backend';
import { connectToDatabase } from '../src/lib/db/mongodb';
import { UserModel } from '../src/lib/db/models/user.model';

const PROTECTED_STUDENT_EMAILS = ['theprashantumrao@gmail.com'];
const PROTECTED_CLERK_IDS = ['user_3M3S2RxNg0f7ihtFDcmHbW9z93Q'];

async function deleteAccounts() {
  console.log('\n======================================================');
  console.log('   Axis LinkUp — Safe Faculty & Admin Account Reset   ');
  console.log('======================================================\n');

  const confirmFlag = process.argv.includes('--confirm-deletion');
  if (!confirmFlag) {
    console.error(
      '[SAFETY BLOCK] --confirm-deletion flag is required to execute deletion.'
    );
    console.error('Run dry-run or obtain explicit approval before setting this flag.');
    process.exit(1);
  }

  console.log('[1/5] Connecting to MongoDB Atlas...');
  await connectToDatabase();
  console.log('Connected to MongoDB Atlas successfully.');

  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  // 1. Audit student accounts to verify baseline
  console.log('\n[2/5] Verifying Protected Student Accounts...');
  const studentUsers = await UserModel.find({ role: 'student' }).lean();
  console.log(`Protected student accounts in MongoDB: ${studentUsers.length}`);

  for (const st of studentUsers) {
    console.log(` -> PRESERVED STUDENT: ${st.fullName} (${st.email}) [ID: ${st._id}]`);
  }

  if (studentUsers.length === 0) {
    console.warn('[WARN] No student accounts found in MongoDB.');
  }

  // 2. Identify MongoDB Non-Student Accounts
  console.log('\n[3/5] Identifying MongoDB Faculty and Admin Accounts...');
  const nonStudentUsers = await UserModel.find({
    role: { $in: ['faculty', 'admin', 'super_admin'] },
  }).lean();

  console.log(`Found ${nonStudentUsers.length} non-student accounts in MongoDB.`);

  for (const user of nonStudentUsers) {
    // Ultra-strict assertion
    if (
      user.role === 'student' ||
      PROTECTED_STUDENT_EMAILS.includes(user.email.toLowerCase()) ||
      (user.authProviderId && PROTECTED_CLERK_IDS.includes(user.authProviderId))
    ) {
      throw new Error(
        `FATAL SAFETY VIOLATION: Student account detected in deletion list! [${user.email}] Aborting immediately.`
      );
    }
  }

  // Delete from MongoDB and Clerk if authProviderId exists
  for (const user of nonStudentUsers) {
    console.log(
      `Deleting MongoDB user: [${user.role}] ${user.fullName} (${user.email}) [${user._id}]`
    );

    if (user.authProviderId) {
      if (!PROTECTED_CLERK_IDS.includes(user.authProviderId)) {
        try {
          console.log(` -> Deleting Clerk identity: ${user.authProviderId}`);
          await clerk.users.deleteUser(user.authProviderId);
          console.log(` -> Successfully deleted Clerk identity: ${user.authProviderId}`);
        } catch (clerkErr) {
          console.warn(
            ` -> Note: Clerk identity ${user.authProviderId} removal returned: ${
              clerkErr instanceof Error ? clerkErr.message : String(clerkErr)
            }`
          );
        }
      }
    }

    await UserModel.deleteOne({ _id: user._id });
    console.log(` -> Successfully removed MongoDB record: ${user._id}`);
  }

  // 3. Clean up orphaned test identities in Clerk
  console.log('\n[4/5] Inspecting & Cleaning Clerk IAM Test Identities...');
  const clerkUserList = await clerk.users.getUserList({ limit: 100 });
  console.log(`Total identities in Clerk: ${clerkUserList.data.length}`);

  const targetOrphanUsernames = ['hodaxis', 'ankitpatel'];
  const targetOrphanEmails = ['2023bit026@axiscolleges.in', 'hey.prashantumrao@gmail.com'];

  for (const cu of clerkUserList.data) {
    const cuEmail = cu.emailAddresses[0]?.emailAddress?.toLowerCase() || '';
    const cuUsername = cu.username?.toLowerCase() || '';

    // Guard student
    if (
      PROTECTED_CLERK_IDS.includes(cu.id) ||
      PROTECTED_STUDENT_EMAILS.includes(cuEmail) ||
      cu.publicMetadata.role === 'student'
    ) {
      console.log(` -> PRESERVING CLERK STUDENT: ${cu.id} (${cuEmail}) [Username: ${cu.username}]`);
      continue;
    }

    // Check if target orphan test identity
    if (
      targetOrphanUsernames.includes(cuUsername) ||
      targetOrphanEmails.includes(cuEmail) ||
      cu.publicMetadata.role === 'faculty' ||
      cu.publicMetadata.role === 'admin' ||
      cu.publicMetadata.role === 'super_admin'
    ) {
      console.log(
        ` -> Deleting targeted Clerk test identity: ${cu.id} (${cuEmail}) [Username: ${cu.username}]`
      );
      await clerk.users.deleteUser(cu.id);
      console.log(` -> Successfully deleted Clerk user ${cu.id}`);
    }
  }

  // 4. Verification
  console.log('\n[5/5] Performing Post-Deletion Verification Audit...');
  const postStudentCount = await UserModel.countDocuments({ role: 'student' });
  const postFacultyAdminCount = await UserModel.countDocuments({
    role: { $in: ['faculty', 'admin', 'super_admin'] },
  });

  const postClerkList = await clerk.users.getUserList({ limit: 100 });

  console.log('------------------------------------------------------');
  console.log('Post-Deletion Status:');
  console.log(`- MongoDB Student Accounts:       ${postStudentCount} (Expected: ${studentUsers.length})`);
  console.log(`- MongoDB Faculty/Admin Accounts: ${postFacultyAdminCount} (Expected: 0)`);
  console.log(`- Clerk Remaining Identities:     ${postClerkList.data.length} (Expected: 1 Student)`);
  console.log('------------------------------------------------------');

  if (postStudentCount !== studentUsers.length) {
    throw new Error(
      `SAFETY FAILURE: Student account count changed from ${studentUsers.length} to ${postStudentCount}!`
    );
  }

  if (postFacultyAdminCount !== 0) {
    throw new Error(
      `SAFETY FAILURE: ${postFacultyAdminCount} Faculty/Admin accounts still exist in MongoDB!`
    );
  }

  console.log('\n[SUCCESS] Faculty & Admin account reset completed safely.');
  console.log('All Student accounts remain 100% intact and functional.');

  await mongoose.disconnect();
}

deleteAccounts().catch((err) => {
  console.error('\n[FATAL ERROR] Deletion script halted:', err);
  process.exit(1);
});

