/* eslint-disable no-console */
/**
 * Axis LinkUp — Comprehensive Account Audit & Dry-Run Deletion Inspection Script.
 * Read-only script. Performs zero destructive operations.
 * Inspects MongoDB Atlas and Clerk identities to prepare an exhaustive inventory
 * of Faculty, HOD, Director, System Administrator, and Student accounts.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import mongoose from 'mongoose';
import { createClerkClient } from '@clerk/backend';
import { connectToDatabase } from '../src/lib/db/mongodb';
import { UserModel } from '../src/lib/db/models/user.model';
import { DepartmentModel } from '../src/lib/db/models/department.model';
import { NoticeModel } from '../src/lib/db/models/notice.model';
import { PollModel } from '../src/lib/db/models/poll.model';

interface AccountInventoryItem {
  mongoId: string;
  authProviderId: string | null;
  fullName: string;
  email: string;
  username: string | null;
  role: string;
  adminSubRole: string | null;
  status: string;
  departmentCode: string | null;
  employeeId?: string;
  adminStaffId?: string;
  clerkIdentityFound: boolean;
  clerkStatus?: string;
}

async function runAudit() {
  console.log('\n================================================================');
  console.log('   Axis LinkUp — Phase 1 & 5: Read-Only Account Audit & Dry-Run  ');
  console.log('================================================================\n');

  console.log('[1/4] Connecting to MongoDB Atlas...');
  await connectToDatabase();
  console.log('Connected to MongoDB Atlas successfully.');

  // Fetch departments for code resolution
  const departments = await DepartmentModel.find({}).lean();
  const deptMap = new Map<string, string>();
  for (const d of departments) {
    deptMap.set(d._id.toString(), d.code);
  }

  // Fetch all MongoDB users
  console.log('\n[2/4] Inspecting MongoDB User Collection...');
  const allUsers = await UserModel.find({}).lean();
  console.log(`Total MongoDB User Documents found: ${allUsers.length}`);

  // Fetch all Clerk users
  console.log('\n[3/4] Inspecting Clerk Authentication Identities...');
  let clerkUsers: Array<{
    id: string;
    emailAddresses: Array<{ emailAddress: string }>;
    username: string | null;
    publicMetadata: Record<string, unknown>;
  }> = [];

  try {
    const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const response = await client.users.getUserList({ limit: 500 });
    clerkUsers = response.data.map((u) => ({
      id: u.id,
      emailAddresses: u.emailAddresses.map((e) => ({ emailAddress: e.emailAddress })),
      username: u.username,
      publicMetadata: (u.publicMetadata as Record<string, unknown>) || {},
    }));
    console.log(`Total Clerk IAM Identities found: ${clerkUsers.length}`);
  } catch (clerkErr) {
    console.warn(
      `[WARN] Could not retrieve Clerk users list directly: ${
        clerkErr instanceof Error ? clerkErr.message : String(clerkErr)
      }`
    );
  }

  // Categorize accounts
  const students: AccountInventoryItem[] = [];
  const faculty: AccountInventoryItem[] = [];
  const hods: AccountInventoryItem[] = [];
  const directors: AccountInventoryItem[] = [];
  const sysAdmins: AccountInventoryItem[] = [];
  const otherAdmins: AccountInventoryItem[] = [];

  for (const user of allUsers) {
    const deptCode = user.departmentId ? deptMap.get(user.departmentId.toString()) || null : null;

    // Check corresponding Clerk identity
    const clerkUser = clerkUsers.find(
      (c) =>
        c.id === user.authProviderId ||
        c.emailAddresses.some((e) => e.emailAddress.toLowerCase() === user.email.toLowerCase()) ||
        (user.username && c.username && c.username.toLowerCase() === user.username.toLowerCase())
    );

    const item: AccountInventoryItem = {
      mongoId: user._id.toString(),
      authProviderId: user.authProviderId || null,
      fullName: user.fullName,
      email: user.email,
      username: user.username || null,
      role: user.role,
      adminSubRole: user.adminSubRole || null,
      status: user.status,
      departmentCode: deptCode,
      employeeId: user.facultyProfile?.employeeId,
      adminStaffId: user.adminProfile?.adminStaffId,
      clerkIdentityFound: Boolean(clerkUser),
      clerkStatus: clerkUser ? (clerkUser.publicMetadata.status as string) || 'active' : undefined,
    };

    if (user.role === 'student') {
      students.push(item);
    } else if (user.role === 'faculty') {
      faculty.push(item);
    } else if (user.role === 'admin' && user.adminSubRole === 'hod') {
      hods.push(item);
    } else if (user.role === 'super_admin' && user.adminSubRole === 'director') {
      directors.push(item);
    } else if (user.role === 'super_admin') {
      sysAdmins.push(item);
    } else if (user.role === 'admin') {
      otherAdmins.push(item);
    }
  }

  // Check referenced shared data
  console.log('\n[4/4] Inspecting Shared Data Cross-References (Notices & Polls)...');
  const targetedIds = [
    ...faculty.map((f) => new mongoose.Types.ObjectId(f.mongoId)),
    ...hods.map((h) => new mongoose.Types.ObjectId(h.mongoId)),
    ...directors.map((d) => new mongoose.Types.ObjectId(d.mongoId)),
    ...sysAdmins.map((s) => new mongoose.Types.ObjectId(s.mongoId)),
    ...otherAdmins.map((o) => new mongoose.Types.ObjectId(o.mongoId)),
  ];

  const referencedNotices = await NoticeModel.countDocuments({
    authorId: { $in: targetedIds },
  });

  const referencedPolls = await PollModel.countDocuments({
    creatorId: { $in: targetedIds },
  });

  console.log(`Notices authored by targeted accounts: ${referencedNotices}`);
  console.log(`Polls authored by targeted accounts: ${referencedPolls}`);

  console.log('\n================================================================');
  console.log('   ACCOUNT INVENTORY & TARGET SUMMARY                            ');
  console.log('================================================================');
  console.log(`1. Student Accounts (CRITICAL: 100% PROTECTED): ${students.length}`);
  console.log(`2. Faculty Accounts:                            ${faculty.length}`);
  console.log(`3. Department HOD Accounts:                     ${hods.length}`);
  console.log(`4. Executive Director Accounts:                 ${directors.length}`);
  console.log(`5. System Administrator Accounts:               ${sysAdmins.length}`);
  console.log(`6. Other Admin Accounts:                        ${otherAdmins.length}`);
  console.log(
    `----------------------------------------------------------------`
  );
  console.log(
    `TOTAL TARGETED FOR RESET:                        ${
      faculty.length + hods.length + directors.length + sysAdmins.length + otherAdmins.length
    }`
  );
  console.log(
    `TOTAL STUDENTS PRESERVED (UNTOUCHED):           ${students.length}`
  );

  console.log('\n--- TARGETED FACULTY ACCOUNTS ---');
  if (faculty.length === 0) console.log('None found.');
  faculty.forEach((f, i) => {
    console.log(
      `${i + 1}. [${f.mongoId}] ${f.fullName} (${f.email}) | User: ${f.username || 'N/A'} | EmpID: ${
        f.employeeId || 'N/A'
      } | Dept: ${f.departmentCode || 'N/A'} | Status: ${f.status} | ClerkLinked: ${
        f.clerkIdentityFound
      }`
    );
  });

  console.log('\n--- TARGETED HOD ACCOUNTS ---');
  if (hods.length === 0) console.log('None found.');
  hods.forEach((h, i) => {
    console.log(
      `${i + 1}. [${h.mongoId}] ${h.fullName} (${h.email}) | User: ${h.username || 'N/A'} | StaffID: ${
        h.adminStaffId || 'N/A'
      } | Dept: ${h.departmentCode || 'N/A'} | Status: ${h.status} | ClerkLinked: ${
        h.clerkIdentityFound
      }`
    );
  });

  console.log('\n--- TARGETED DIRECTOR ACCOUNTS ---');
  if (directors.length === 0) console.log('None found.');
  directors.forEach((d, i) => {
    console.log(
      `${i + 1}. [${d.mongoId}] ${d.fullName} (${d.email}) | User: ${d.username || 'N/A'} | StaffID: ${
        d.adminStaffId || 'N/A'
      } | Status: ${d.status} | ClerkLinked: ${d.clerkIdentityFound}`
    );
  });

  console.log('\n--- TARGETED SYSTEM ADMINISTRATOR ACCOUNTS ---');
  if (sysAdmins.length === 0) console.log('None found.');
  sysAdmins.forEach((s, i) => {
    console.log(
      `${i + 1}. [${s.mongoId}] ${s.fullName} (${s.email}) | User: ${s.username || 'N/A'} | StaffID: ${
        s.adminStaffId || 'N/A'
      } | Status: ${s.status} | ClerkLinked: ${s.clerkIdentityFound}`
    );
  });

  console.log('\n--- TARGETED OTHER ADMIN ACCOUNTS ---');
  if (otherAdmins.length === 0) console.log('None found.');
  otherAdmins.forEach((o, i) => {
    console.log(
      `${i + 1}. [${o.mongoId}] ${o.fullName} (${o.email}) | User: ${o.username || 'N/A'} | SubRole: ${
        o.adminSubRole || 'N/A'
      } | Status: ${o.status} | ClerkLinked: ${o.clerkIdentityFound}`
    );
  });

  console.log('\n--- STUDENT ACCOUNTS SAMPLE (VERIFYING EXCLUSION) ---');
  students.slice(0, 5).forEach((st, i) => {
    console.log(
      `${i + 1}. [${st.mongoId}] ${st.fullName} (${st.email}) | User: ${st.username} | Dept: ${
        st.departmentCode
      } | Status: ${st.status} (PRESERVED)`
    );
  });
  if (students.length > 5) {
    console.log(`... and ${students.length - 5} more student accounts safely untouched.`);
  }

  // Also check Clerk users without MongoDB records (orphaned Clerk users)
  const orphanedClerkUsers = clerkUsers.filter((cu) => {
    const foundInMongo = allUsers.some(
      (mu) =>
        mu.authProviderId === cu.id ||
        cu.emailAddresses.some((e) => e.emailAddress.toLowerCase() === mu.email.toLowerCase())
    );
    return !foundInMongo;
  });

  console.log('\n--- ORPHANED CLERK IDENTITIES (Not in MongoDB) ---');
  if (orphanedClerkUsers.length === 0) {
    console.log('None found.');
  } else {
    orphanedClerkUsers.forEach((oc, i) => {
      console.log(
        `${i + 1}. [${oc.id}] Email: ${oc.emailAddresses[0]?.emailAddress} | Username: ${
          oc.username
        } | RoleMetadata: ${oc.publicMetadata.role || 'none'}`
      );
    });
  }

  console.log('\n[AUDIT COMPLETE] No data was modified.');
  await mongoose.disconnect();
}

runAudit().catch((err) => {
  console.error('[AUDIT FAILED]', err);
  process.exit(1);
});
