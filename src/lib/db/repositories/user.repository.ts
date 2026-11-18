/**
 * User Repository (Data Access Layer).
 * Encapsulates Mongoose database interactions for the 'users' collection.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import UserModel from '@/lib/db/models/user.model';
import type {
  IUser,
  CreateUserInput,
  UpdateUserProfileInput,
  UserRole,
  UserStatus,
  AdminSubRole,
  DirectoryUserDTO,
} from '@/types/user';

export class UserRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Finds a user document by internal MongoDB ObjectId.
   */
  public static async findById(id: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    return UserModel.findById(id).exec();
  }

  /**
   * Finds multiple users by their MongoDB ObjectIds.
   */
  public static async findByIds(ids: string[]): Promise<IUser[]> {
    await this.ensureConnection();
    const validObjectIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (validObjectIds.length === 0) return [];
    return UserModel.find({ _id: { $in: validObjectIds } }).lean();
  }

  /**
   * Finds a user by unique institutional email.
   */
  public static async findByEmail(email: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!email || !email.trim()) return null;
    return UserModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  /**
   * Finds a user by unique institutional username.
   */
  public static async findByUsername(username: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!username || !username.trim()) return null;
    const normalized = username.toLowerCase().trim();
    const variants = [normalized];
    if (normalized.includes('_')) {
      variants.push(normalized.replace(/_/g, '.'));
    }
    if (normalized.includes('.')) {
      variants.push(normalized.replace(/\./g, '_'));
    }
    return UserModel.findOne({ username: { $in: variants } }).exec();
  }

  /**
   * Finds a user by identifier (either email or institutional username).
   */
  public static async findByIdentifier(identifier: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!identifier || !identifier.trim()) return null;
    const normalized = identifier.toLowerCase().trim();
    const variants = [normalized];
    if (normalized.includes('_')) {
      variants.push(normalized.replace(/_/g, '.'));
    }
    if (normalized.includes('.')) {
      variants.push(normalized.replace(/\./g, '_'));
    }
    return UserModel.findOne({
      $or: [{ email: normalized }, { username: { $in: variants } }],
    }).exec();
  }

  /**
   * Finds a user by external authentication provider identifier (e.g., Clerk user ID).
   */
  public static async findByAuthProviderId(providerId: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!providerId || !providerId.trim()) return null;
    return UserModel.findOne({ authProviderId: providerId.trim() }).exec();
  }

  /**
   * Finds a student by their institutional roll number.
   */
  public static async findByRollNumber(rollNumber: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!rollNumber || !rollNumber.trim()) return null;
    return UserModel.findOne({
      'studentProfile.rollNumber': rollNumber.toUpperCase().trim(),
    }).exec();
  }

  /**
   * Finds a faculty member by their unique employee identifier.
   */
  public static async findByEmployeeId(employeeId: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!employeeId || !employeeId.trim()) return null;
    return UserModel.findOne({
      'facultyProfile.employeeId': employeeId.toUpperCase().trim(),
    }).exec();
  }

  /**
   * Finds an administrator by their unique staff identifier.
   */
  public static async findByAdminStaffId(adminStaffId: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!adminStaffId || !adminStaffId.trim()) return null;
    return UserModel.findOne({
      'adminProfile.adminStaffId': adminStaffId.toUpperCase().trim(),
    }).exec();
  }

  /**
   * Creates and persists a new user document.
   */
  public static async create(input: CreateUserInput): Promise<IUser> {
    await this.ensureConnection();
    const user = new UserModel({
      ...input,
      email: input.email.toLowerCase().trim(),
      username: input.username ? input.username.toLowerCase().trim() : undefined,
      departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : null,
      provisionedBy: input.provisionedBy ? new Types.ObjectId(input.provisionedBy) : null,
      activatedAt: input.activatedAt ?? null,
    });
    return user.save();
  }

  /**
   * Updates permitted self-service profile fields.
   * Strictly isolates protected fields (role, status, email, departmentId).
   */
  public static async updateProfile(
    id: string,
    updateData: UpdateUserProfileInput
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;

    const setFields: Record<string, unknown> = {};

    if (updateData.fullName !== undefined) setFields.fullName = updateData.fullName;
    if (updateData.phoneNumber !== undefined) setFields.phoneNumber = updateData.phoneNumber;
    if (updateData.avatarUrl !== undefined) setFields.avatarUrl = updateData.avatarUrl;
    if (updateData.bio !== undefined) setFields.bio = updateData.bio;

    if (updateData.facultyProfile?.cabinRoom !== undefined) {
      setFields['facultyProfile.cabinRoom'] = updateData.facultyProfile.cabinRoom;
    }

    if (updateData.facultyProfile?.officeHours) {
      setFields['facultyProfile.officeHours'] = updateData.facultyProfile.officeHours;
    }

    if (updateData.facultyProfile?.specialization !== undefined) {
      setFields['facultyProfile.specialization'] = updateData.facultyProfile.specialization;
    }

    if (updateData.facultyProfile?.sharePhoneWithStudents !== undefined) {
      setFields['facultyProfile.sharePhoneWithStudents'] = Boolean(
        updateData.facultyProfile.sharePhoneWithStudents
      );
    }

    return UserModel.findByIdAndUpdate(
      id,
      { $set: setFields },
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }

  /**
   * Updates a student's section (Protected Administrator & HOD Gate).
   */
  public static async updateStudentSection(
    userId: string,
    section: string
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(userId) || !section || !section.trim()) return null;
    return UserModel.findOneAndUpdate(
      { _id: userId, role: 'student' },
      { $set: { 'studentProfile.section': section.trim().toUpperCase() } },
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }

  /**
   * Updates a student's academic program (Protected Administrator Gate).
   */
  public static async updateStudentProgram(
    userId: string,
    program: string,
    admissionYear?: number
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(userId) || !program || !program.trim()) return null;
    const setFields: Record<string, unknown> = {
      'studentProfile.program': program.trim().toUpperCase(),
    };
    if (admissionYear !== undefined) {
      setFields['studentProfile.admissionYear'] = admissionYear;
    }
    return UserModel.findOneAndUpdate(
      { _id: userId, role: 'student' },
      { $set: setFields },
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }

  /**
   * Atomically mutates institutional academic fields (Protected Administrative Gate).
   */
  public static async updateAcademicProfile(
    userId: string,
    update: {
      departmentId?: string;
      program?: string;
      batchYear?: number;
      admissionYear?: number;
      currentSemester?: number;
      section?: string;
      designation?: string;
    }
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(userId)) return null;

    const user = await UserModel.findById(userId).exec();
    if (!user) return null;

    const setFields: Record<string, unknown> = {};

    if (update.departmentId) {
      if (!Types.ObjectId.isValid(update.departmentId)) return null;
      setFields.departmentId = new Types.ObjectId(update.departmentId);
    }

    if (user.role === 'student') {
      if (update.program !== undefined) {
        setFields['studentProfile.program'] = update.program ? update.program.trim().toUpperCase() : null;
      }
      if (update.batchYear !== undefined) {
        setFields['studentProfile.batchYear'] = update.batchYear;
      }
      if (update.admissionYear !== undefined) {
        setFields['studentProfile.admissionYear'] = update.admissionYear;
      }
      if (update.currentSemester !== undefined) {
        setFields['studentProfile.currentSemester'] = update.currentSemester;
      }
      if (update.section !== undefined) {
        setFields['studentProfile.section'] = update.section.trim().toUpperCase();
      }
    } else if (user.role === 'faculty') {
      if (update.designation !== undefined) {
        setFields['facultyProfile.designation'] = update.designation.trim();
      }
    } else if (user.role === 'admin') {
      if (update.designation !== undefined) {
        setFields['adminProfile.designation'] = update.designation.trim();
      }
    }

    if (Object.keys(setFields).length === 0) return user;

    return UserModel.findByIdAndUpdate(
      userId,
      { $set: setFields },
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }

  /**
   * Updates user role (Protected Administrative Gate).
   */
  public static async updateRole(id: string, role: UserRole): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    return UserModel.findByIdAndUpdate(id, { $set: { role } }, { new: true }).exec();
  }

  /**
   * Updates account lifecycle status (Protected Administrative Gate).
   */
  public static async updateStatus(id: string, status: UserStatus): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    return UserModel.findByIdAndUpdate(id, { $set: { status } }, { new: true }).exec();
  }

  /**
   * Synchronizes external identity provider profile data via Webhook.
   */
  public static async syncExternalProfile(
    authProviderId: string,
    data: {
      fullName?: string;
      avatarUrl?: string;
      email?: string;
      username?: string;
      isEmailVerified?: boolean;
    }
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!authProviderId) return null;
    const updateData: Record<string, unknown> = { ...data };
    if (data.email) {
      updateData.email = data.email.toLowerCase().trim();
    }
    if (data.username) {
      updateData.username = data.username.toLowerCase().trim();
    }
    if (data.isEmailVerified !== undefined) {
      updateData.isEmailVerified = Boolean(data.isEmailVerified);
    }
    return UserModel.findOneAndUpdate(
      { authProviderId: authProviderId.trim() },
      { $set: updateData },
      { new: true }
    ).exec();
  }

  /**
   * Updates an institutional username.
   */
  public static async updateUsername(id: string, username: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id) || !username) return null;
    return UserModel.findByIdAndUpdate(
      id,
      { $set: { username: username.toLowerCase().trim() } },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Updates administrative sub-role (Protected Administrative Gate).
   */
  public static async updateAdminSubRole(
    id: string,
    adminSubRole: AdminSubRole | null
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    return UserModel.findByIdAndUpdate(
      id,
      { $set: { adminSubRole } },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Updates a user's institutional department assignment (Protected IAM Governance Gate).
   */
  public static async updateDepartment(
    id: string,
    departmentId: string | null
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    const deptObjId =
      departmentId && Types.ObjectId.isValid(departmentId)
        ? new Types.ObjectId(departmentId)
        : null;
    return UserModel.findByIdAndUpdate(
      id,
      { $set: { departmentId: deptObjId } },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Queries paginated institutional users for the Super Admin IAM Governance Console.
   */
  public static async findGovernedUsers(
    filter: Record<string, unknown>,
    page = 1,
    limit = 25
  ): Promise<{ users: IUser[]; total: number }> {
    await this.ensureConnection();
    const validPage = Math.max(1, page);
    const validLimit = Math.max(1, Math.min(100, limit));
    const skip = (validPage - 1) * validLimit;

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(validLimit)
        .exec(),
      UserModel.countDocuments(filter).exec(),
    ]);

    return { users, total };
  }

  /**
   * Aggregates role and account lifecycle status counts for the IAM Governance KPI strip.
   */
  public static async getRoleDistributionStats(): Promise<{
    totalUsers: number;
    byRole: Record<UserRole, number>;
    byStatus: {
      active: number;
      suspended: number;
      pending_verification: number;
      deactivated: number;
      other: number;
    };
  }> {
    await this.ensureConnection();
    const [agg] = await UserModel.aggregate([
      {
        $facet: {
          totalCount: [{ $count: 'total' }],
          roleCounts: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
          statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
    ]).exec();

    const byRole: Record<UserRole, number> = {
      student: 0,
      faculty: 0,
      admin: 0,
      super_admin: 0,
    };

    agg?.roleCounts?.forEach((item: { _id: UserRole; count: number }) => {
      if (item._id && item._id in byRole) {
        byRole[item._id] = item.count;
      }
    });

    const byStatus = {
      active: 0,
      suspended: 0,
      pending_verification: 0,
      deactivated: 0,
      other: 0,
    };

    agg?.statusCounts?.forEach((item: { _id: string; count: number }) => {
      if (item._id === 'active') byStatus.active = item.count;
      else if (item._id === 'suspended') byStatus.suspended = item.count;
      else if (item._id === 'pending_verification') byStatus.pending_verification = item.count;
      else if (item._id === 'deactivated') byStatus.deactivated = item.count;
      else byStatus.other += item.count;
    });

    return {
      totalUsers: agg?.totalCount?.[0]?.total || 0,
      byRole,
      byStatus,
    };
  }

  /**
   * Links an external auth provider ID to an existing pre-provisioned user record by email.
   */
  public static async linkAuthProviderId(
    email: string,
    authProviderId: string
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!email || !authProviderId) return null;
    return UserModel.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { $set: { authProviderId: authProviderId.trim() } },
      { new: true }
    ).exec();
  }

  /**
   * Finds users by department and optional role filter.
   */
  public static async findByDepartment(departmentId: string, role?: UserRole): Promise<IUser[]> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(departmentId)) return [];
    const query: Record<string, unknown> = {
      departmentId: new Types.ObjectId(departmentId),
    };
    if (role) query.role = role;
    return UserModel.find(query).exec();
  }

  /**
   * Finds academic roster students for a department with cohort filters and pagination.
   */
  public static async findDepartmentRoster(
    departmentId: string,
    options?: {
      program?: string;
      batchYear?: number;
      currentSemester?: number;
      section?: string;
      page?: number;
      limit?: number;
      cursor?: string;
    }
  ): Promise<{
    students: IUser[];
    totalCount: number;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(departmentId)) {
      return { students: [], totalCount: 0, nextCursor: null, hasMore: false };
    }

    const query: Record<string, unknown> = {
      departmentId: new Types.ObjectId(departmentId),
      role: 'student',
      status: { $in: ['active', 'pending_verification'] },
    };

    if (options?.program) {
      query['studentProfile.program'] = options.program.toUpperCase().trim();
    }
    if (options?.batchYear !== undefined) {
      query['studentProfile.batchYear'] = options.batchYear;
    }
    if (options?.currentSemester !== undefined) {
      query['studentProfile.currentSemester'] = options.currentSemester;
    }
    if (options?.section) {
      query['studentProfile.section'] = options.section.toUpperCase().trim();
    }

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 50));

    if (options?.cursor && Types.ObjectId.isValid(options.cursor)) {
      query._id = { $gt: new Types.ObjectId(options.cursor) };
    }

    const skip = options?.cursor ? 0 : (page - 1) * limit;

    const [students, totalCount] = await Promise.all([
      UserModel.find(query)
        .sort(options?.cursor ? { _id: 1 } : { 'studentProfile.rollNumber': 1, fullName: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      UserModel.countDocuments(query).exec(),
    ]);

    const lastStudent = students[students.length - 1];
    const hasMore = options?.cursor
      ? students.length === limit
      : skip + students.length < totalCount;
    const nextCursor = hasMore && lastStudent ? lastStudent._id.toString() : null;

    return { students, totalCount, nextCursor, hasMore };
  }

  /**
   * Sets a cryptographic activation token hash and expiration date.
   */
  public static async setActivationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(userId)) return null;
    return UserModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          activationTokenHash: tokenHash,
          activationTokenExpiresAt: expiresAt,
        },
      },
      { new: true }
    ).exec();
  }

  /**
   * Finds a user document by their unique cryptographic activation token hash.
   */
  public static async findByActivationTokenHash(tokenHash: string): Promise<IUser | null> {
    await this.ensureConnection();
    if (!tokenHash || !tokenHash.trim()) return null;
    return UserModel.findOne({ activationTokenHash: tokenHash.trim() }).exec();
  }

  /**
   * Completes the account activation workflow atomically with race-condition defense:
   * Sets status to 'active', isEmailVerified to true, activatedAt timestamp,
   * and clears the activation token hash and expiry to guarantee replay prevention.
   */
  public static async completeAccountActivation(
    userId: string,
    activatedAt: Date = new Date()
  ): Promise<IUser | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(userId)) return null;
    return UserModel.findOneAndUpdate(
      {
        _id: userId,
        activationTokenHash: { $ne: null },
      },
      {
        $set: {
          status: 'active',
          isEmailVerified: true,
          activatedAt,
          activationTokenHash: null,
          activationTokenExpiresAt: null,
        },
      },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Counts active users by role.
   */
  public static async countByRole(role: UserRole): Promise<number> {
    await this.ensureConnection();
    return UserModel.countDocuments({ role, status: 'active' }).exec();
  }

  /**
   * Deletes a user by internal ID (Super Admin only).
   */
  public static async deleteById(id: string): Promise<boolean> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return false;
    const result = await UserModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  /**
   * Searches active, provisioned collegiate users for directory discovery and direct messaging.
   * Conforms to Zero-Trust privacy:
   * - Restricts to status: 'active'
   * - Requires external auth identity (authProviderId exists and is non-null)
   * - Excludes currently authenticated user
   * - Searches across fullName, username, email, rollNumber, employeeId using sanitized regex
   * - Returns safe DirectoryUserDTO instances with no sensitive credentials or internal secrets.
   */
  public static async searchDirectory(options: {
    query?: string;
    currentUserId?: string;
    roles?: UserRole[];
    departmentId?: string;
    limit?: number;
  }): Promise<DirectoryUserDTO[]> {
    await this.ensureConnection();
    const limit = Math.min(50, Math.max(1, options.limit || 20));
    const filter: Record<string, unknown> = {
      status: 'active',
      authProviderId: { $exists: true, $ne: null },
    };

    // Exclude current caller (checks both ObjectId and authProviderId if non-ObjectId)
    if (options.currentUserId && options.currentUserId.trim()) {
      const trimmedId = options.currentUserId.trim();
      if (Types.ObjectId.isValid(trimmedId)) {
        filter._id = { $ne: new Types.ObjectId(trimmedId) };
      } else {
        filter.authProviderId = { $ne: trimmedId };
      }
    }

    // Role filter
    if (options.roles && options.roles.length > 0) {
      filter.role = { $in: options.roles };
    }

    // Department filter if provided
    if (options.departmentId && Types.ObjectId.isValid(options.departmentId)) {
      filter.departmentId = new Types.ObjectId(options.departmentId);
    }

    // Search query matching
    const q = options.query?.trim();
    if (q) {
      const cleanQ = q.replace(/^@/, '');
      const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      filter.$or = [
        { fullName: regex },
        { username: regex },
        { email: regex },
        { 'studentProfile.rollNumber': regex },
        { 'facultyProfile.employeeId': regex },
      ];
    }

    const users = await UserModel.find(filter)
      .populate('departmentId', 'name code')
      .sort({ role: 1, fullName: 1 })
      .limit(limit)
      .lean()
      .exec();

    return users.map((u) => {
      const dept = u.departmentId as unknown as { _id: Types.ObjectId; name?: string; code?: string } | null;
      return {
        id: u._id.toString(),
        fullName: u.fullName,
        username: u.username || null,
        email: u.email,
        role: u.role,
        adminSubRole: u.adminSubRole || null,
        avatarUrl: u.avatarUrl || null,
        departmentName: dept?.name || null,
        departmentId: dept?._id ? dept._id.toString() : (u.departmentId ? u.departmentId.toString() : null),
        rollNumber: u.studentProfile?.rollNumber || null,
        designation:
          u.role === 'faculty'
            ? u.facultyProfile?.designation || null
            : u.role === 'admin'
              ? u.adminProfile?.designation || (u.adminSubRole ? u.adminSubRole.toUpperCase() : null)
              : null,
      };
    });
  }
}

export default UserRepository;
