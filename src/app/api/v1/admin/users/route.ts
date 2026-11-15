import type { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAuth } from '@/lib/auth';
import { assertCanManageUserRoles } from '@/lib/auth/rbac';
import { connectToDatabase } from '@/lib/db/mongodb';
import UserModel, { toUserDTO } from '@/lib/db/models/user.model';
import { DepartmentRepository } from '@/lib/db/repositories/department.repository';
import { successResponse } from '@/lib/api/api-response';
import { HTTP_STATUS } from '@/config/constants';
import { handleApiError } from '@/lib/api/api-error-handler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/users
 * Administrative User Directory & Account Query Route.
 * Strictly restricted to authorized System Administrators.
 * Supports keyword search across name, email, username, roll number, and employee ID,
 * role filtering, status filtering, and pagination.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    // 1. Strict System Administrator access check
    assertCanManageUserRoles(
      session,
      'Only System Administrators are authorized to access the collegiate user directory.'
    );

    // 2. Ensure database connectivity
    await connectToDatabase();

    // 3. Extract query parameters
    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get('q')?.trim() || '';
    const role = searchParams.get('role')?.trim() || 'all';
    const status = searchParams.get('status')?.trim() || 'all';
    const department = searchParams.get('department')?.trim() || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // 4. Construct MongoDB Filter Query
    const filter: Record<string, unknown> = {};

    // Role filter
    if (role && role !== 'all') {
      if (role === 'admin' || role === 'admins') {
        filter.role = { $in: ['admin', 'super_admin'] };
      } else if (role === 'students') {
        filter.role = 'student';
      } else {
        filter.role = role;
      }
    }

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Department filter
    if (department && department !== 'all') {
      const deptDoc = await DepartmentRepository.findActiveByIdOrCode(department);
      if (deptDoc) {
        filter.departmentId = deptDoc._id;
      } else if (Types.ObjectId.isValid(department)) {
        filter.departmentId = new Types.ObjectId(department);
      }
    }

    // Keyword search across identity fields
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { username: regex },
        { 'studentProfile.rollNumber': regex },
        { 'studentProfile.enrollmentNumber': regex },
        { 'facultyProfile.employeeId': regex },
        { 'adminProfile.adminStaffId': regex },
      ];
    }

    // 5. Execute paginated query and system-wide telemetry counts in parallel
    const [
      users,
      totalCount,
      studentCount,
      facultyCount,
      adminCount,
      activeCount,
      pendingCount,
      suspendedCount,
      deactivatedCount,
    ] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      UserModel.countDocuments(filter).exec(),
      UserModel.countDocuments({ role: 'student' }).exec(),
      UserModel.countDocuments({ role: 'faculty' }).exec(),
      UserModel.countDocuments({ role: { $in: ['admin', 'super_admin'] } }).exec(),
      UserModel.countDocuments({ status: 'active' }).exec(),
      UserModel.countDocuments({ status: 'pending_verification' }).exec(),
      UserModel.countDocuments({ status: 'suspended' }).exec(),
      UserModel.countDocuments({ status: 'deactivated' }).exec(),
    ]);

    const userDTOs = users.map((u) => toUserDTO(u));

    return successResponse(
      {
        users: userDTOs,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          hasMore: skip + users.length < totalCount,
        },
        counts: {
          total: studentCount + facultyCount + adminCount,
          students: studentCount,
          faculty: facultyCount,
          admins: adminCount,
          active: activeCount,
          pending: pendingCount,
          suspended: suspendedCount,
          deactivated: deactivatedCount,
        },
      },
      'User directory retrieved successfully',
      HTTP_STATUS.OK
    );
  } catch (error) {
    return handleApiError(error);
  }
}

