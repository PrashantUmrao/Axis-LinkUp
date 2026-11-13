/**
 * User Repository (Data Access Layer).
 * Encapsulates Mongoose database interactions for the 'users' collection.
 */

import { Types } from 'mongoose';
import UserModel from '@/lib/db/models/user.model';
import type {
  IUser,
  CreateUserInput,
  UpdateUserProfileInput,
  UserRole,
  UserStatus,
} from '@/types/user';

export class UserRepository {
  /**
   * Finds a user document by internal MongoDB ObjectId.
   */
  public static async findById(id: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return UserModel.findById(id).exec();
  }

  /**
   * Finds a user by unique institutional email.
   */
  public static async findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  /**
   * Finds a user by external authentication provider identifier (e.g., Clerk user ID).
   */
  public static async findByAuthProviderId(providerId: string): Promise<IUser | null> {
    if (!providerId) return null;
    return UserModel.findOne({ authProviderId: providerId.trim() }).exec();
  }

  /**
   * Finds a student by their institutional roll number.
   */
  public static async findByRollNumber(rollNumber: string): Promise<IUser | null> {
    if (!rollNumber) return null;
    return UserModel.findOne({
      'studentProfile.rollNumber': rollNumber.toUpperCase().trim(),
    }).exec();
  }

  /**
   * Finds a faculty member by their unique employee identifier.
   */
  public static async findByEmployeeId(employeeId: string): Promise<IUser | null> {
    if (!employeeId) return null;
    return UserModel.findOne({
      'facultyProfile.employeeId': employeeId.toUpperCase().trim(),
    }).exec();
  }

  /**
   * Creates and persists a new user document.
   */
  public static async create(input: CreateUserInput): Promise<IUser> {
    const user = new UserModel({
      ...input,
      email: input.email.toLowerCase().trim(),
      departmentId: input.departmentId ? new Types.ObjectId(input.departmentId) : null,
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
    if (!Types.ObjectId.isValid(id)) return null;

    const setFields: Record<string, unknown> = {};

    if (updateData.fullName !== undefined) setFields.fullName = updateData.fullName;
    if (updateData.phoneNumber !== undefined) setFields.phoneNumber = updateData.phoneNumber;
    if (updateData.avatarUrl !== undefined) setFields.avatarUrl = updateData.avatarUrl;

    if (updateData.studentProfile?.section) {
      setFields['studentProfile.section'] = updateData.studentProfile.section;
    }

    if (updateData.facultyProfile?.cabinRoom !== undefined) {
      setFields['facultyProfile.cabinRoom'] = updateData.facultyProfile.cabinRoom;
    }

    if (updateData.facultyProfile?.officeHours) {
      setFields['facultyProfile.officeHours'] = updateData.facultyProfile.officeHours;
    }

    return UserModel.findByIdAndUpdate(
      id,
      { $set: setFields },
      { new: true, runValidators: true }
    ).exec();
  }

  /**
   * Updates user role (Protected Administrative Gate).
   */
  public static async updateRole(id: string, role: UserRole): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return UserModel.findByIdAndUpdate(id, { $set: { role } }, { new: true }).exec();
  }

  /**
   * Updates account lifecycle status (Protected Administrative Gate).
   */
  public static async updateStatus(id: string, status: UserStatus): Promise<IUser | null> {
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
    }
  ): Promise<IUser | null> {
    if (!authProviderId) return null;
    return UserModel.findOneAndUpdate(
      { authProviderId: authProviderId.trim() },
      { $set: data },
      { new: true }
    ).exec();
  }

  /**
   * Links an external auth provider ID to an existing pre-provisioned user record by email.
   */
  public static async linkAuthProviderId(
    email: string,
    authProviderId: string
  ): Promise<IUser | null> {
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
    if (!Types.ObjectId.isValid(departmentId)) return [];
    const query: Record<string, unknown> = {
      departmentId: new Types.ObjectId(departmentId),
    };
    if (role) query.role = role;
    return UserModel.find(query).exec();
  }

  /**
   * Counts active users by role.
   */
  public static async countByRole(role: UserRole): Promise<number> {
    return UserModel.countDocuments({ role, status: 'active' }).exec();
  }

  /**
   * Deletes a user by internal ID (Super Admin only).
   */
  public static async deleteById(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const result = await UserModel.findByIdAndDelete(id).exec();
    return !!result;
  }
}

export default UserRepository;
