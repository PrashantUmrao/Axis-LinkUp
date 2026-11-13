/**
 * Mongoose User Model Definition.
 * Conforms to Axis LinkUp Collection Design (DOC-DATA-005, Collection 1.1)
 * and Indexing Strategy (DOC-DATA-007, Section 2.1).
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type { IUser, IStudentProfile, IFacultyProfile, IAdminProfile, UserDTO } from '@/types/user';
import { USER_ROLES } from '@/config/constants';

/**
 * Student profile subdocument schema.
 */
const StudentProfileSchema = new Schema<IStudentProfile>(
  {
    rollNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    enrollmentNumber: {
      type: String,
      trim: true,
      default: null,
    },
    batchYear: {
      type: Number,
      min: 2020,
      max: 2035,
    },
    currentSemester: {
      type: Number,
      min: 1,
      max: 8,
    },
    section: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 5,
    },
    academicMentorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    admissionType: {
      type: String,
      enum: ['regular', 'lateral_entry'],
      default: 'regular',
    },
  },
  { _id: false }
);

/**
 * Faculty profile subdocument schema.
 */
const FacultyProfileSchema = new Schema<IFacultyProfile>(
  {
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    qualifications: {
      type: [String],
      default: [],
    },
    cabinRoom: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null,
    },
    assignedCourses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
    officeHours: {
      start: { type: String, default: '10:00' },
      end: { type: String, default: '12:00' },
      isAcceptingDMs: { type: Boolean, default: true },
    },
  },
  { _id: false }
);

/**
 * Administrator profile subdocument schema.
 */
const AdminProfileSchema = new Schema<IAdminProfile>(
  {
    adminStaffId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    administrativeDomain: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    assignedQueueScopes: {
      type: [String],
      default: [],
    },
    emergencyOverridePermitted: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

/**
 * Primary User Schema representing the 'users' collection in MongoDB.
 */
const UserSchema = new Schema<IUser>(
  {
    authProviderId: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
        'Please provide a valid email address',
      ],
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must contain at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    role: {
      type: String,
      required: [true, 'User role is required'],
      enum: {
        values: USER_ROLES,
        message: 'Invalid role: {VALUE}',
      },
    },
    status: {
      type: String,
      required: true,
      enum: [
        'pending_verification',
        'active',
        'suspended',
        'deactivated',
        'graduated',
        'invited',
        'archived',
      ],
      default: 'pending_verification',
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: null,
    },
    studentProfile: {
      type: StudentProfileSchema,
      default: null,
    },
    facultyProfile: {
      type: FacultyProfileSchema,
      default: null,
    },
    adminProfile: {
      type: AdminProfileSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'users',
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes adhering strictly to DOC-DATA-007
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ authProviderId: 1 }, { unique: true, sparse: true });
UserSchema.index({ 'studentProfile.rollNumber': 1 }, { unique: true, sparse: true });
UserSchema.index({ 'facultyProfile.employeeId': 1 }, { unique: true, sparse: true });
UserSchema.index({ 'adminProfile.adminStaffId': 1 }, { unique: true, sparse: true });
UserSchema.index({ departmentId: 1, role: 1, status: 1 });
UserSchema.index({ 'studentProfile.batchYear': 1, departmentId: 1, 'studentProfile.section': 1 });
UserSchema.index({ status: 1 });

/**
 * Transforms an IUser Mongoose document into a sanitized, client-safe UserDTO.
 * All nested subdocuments are strictly mapped into plain JavaScript objects (POJOs)
 * to eliminate Mongoose internal circular references ($__parent) during React Server
 * Component (RSC) serialization across the Server/Client boundary.
 */
export function toUserDTO(user: IUser): UserDTO {
  let studentProfile: IStudentProfile | null = null;
  if (user.studentProfile) {
    studentProfile = {
      rollNumber: user.studentProfile.rollNumber,
      enrollmentNumber: user.studentProfile.enrollmentNumber,
      batchYear: user.studentProfile.batchYear,
      currentSemester: user.studentProfile.currentSemester,
      section: user.studentProfile.section,
      academicMentorId: user.studentProfile.academicMentorId
        ? String(user.studentProfile.academicMentorId)
        : undefined,
      admissionType: user.studentProfile.admissionType,
    };
  }

  let facultyProfile: IFacultyProfile | null = null;
  if (user.facultyProfile) {
    facultyProfile = {
      employeeId: user.facultyProfile.employeeId,
      designation: user.facultyProfile.designation,
      qualifications: user.facultyProfile.qualifications
        ? [...user.facultyProfile.qualifications]
        : [],
      cabinRoom: user.facultyProfile.cabinRoom,
      assignedCourses: user.facultyProfile.assignedCourses
        ? user.facultyProfile.assignedCourses.map((courseId) => String(courseId))
        : [],
      officeHours: user.facultyProfile.officeHours
        ? {
            start: user.facultyProfile.officeHours.start,
            end: user.facultyProfile.officeHours.end,
            isAcceptingDMs: user.facultyProfile.officeHours.isAcceptingDMs,
          }
        : undefined,
    };
  }

  let adminProfile: IAdminProfile | null = null;
  if (user.adminProfile) {
    adminProfile = {
      adminStaffId: user.adminProfile.adminStaffId,
      administrativeDomain: user.adminProfile.administrativeDomain,
      assignedQueueScopes: user.adminProfile.assignedQueueScopes
        ? [...user.adminProfile.assignedQueueScopes]
        : [],
      emergencyOverridePermitted: Boolean(user.adminProfile.emergencyOverridePermitted),
    };
  }

  return {
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    isProfileComplete: user.isProfileComplete,
    departmentId: user.departmentId ? user.departmentId.toString() : null,
    phoneNumber: user.phoneNumber ?? null,
    avatarUrl: user.avatarUrl ?? null,
    studentProfile,
    facultyProfile,
    adminProfile,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Hot-reload safe UserModel compilation.
 */
export const UserModel: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

export default UserModel;
