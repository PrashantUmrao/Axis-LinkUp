/**
 * Mongoose Department Model Definition.
 * Conforms to Axis LinkUp Collection Design (DOC-DATA-005, Collection 1.2)
 * and Indexing Strategy (DOC-DATA-007, Section 2.2).
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type { IDepartment, IDepartmentProgram, DepartmentDTO } from '@/types/department';

/**
 * Embedded Approved Academic Program schema for departments.
 */
const DepartmentProgramSchema = new Schema<IDepartmentProgram>(
  {
    code: {
      type: String,
      required: [true, 'Program code is required'],
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    name: {
      type: String,
      required: [true, 'Program name is required'],
      trim: true,
      maxlength: 150,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const DepartmentSchema = new Schema<IDepartment>(
  {
    code: {
      type: String,
      required: [true, 'Department code is required'],
      trim: true,
      uppercase: true,
      maxlength: 10,
    },
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: 100,
    },
    hodId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    establishedYear: {
      type: Number,
      required: [true, 'Established year is required'],
      min: 1950,
      max: 2050,
      default: 2010,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    programs: {
      type: [DepartmentProgramSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'departments',
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

DepartmentSchema.index({ code: 1 }, { unique: true });
DepartmentSchema.index({ hodId: 1 }, { sparse: true });
DepartmentSchema.index({ isActive: 1 });
DepartmentSchema.index({ 'programs.code': 1 });

export function toDepartmentDTO(dept: IDepartment): DepartmentDTO {
  return {
    id: dept._id.toString(),
    code: dept.code,
    name: dept.name,
    hodId: dept.hodId ? dept.hodId.toString() : null,
    establishedYear: dept.establishedYear,
    isActive: dept.isActive,
    programs: Array.isArray(dept.programs)
      ? dept.programs.map((p) => ({
          code: p.code,
          name: p.name,
          isActive: Boolean(p.isActive),
        }))
      : [],
    createdAt: dept.createdAt.toISOString(),
    updatedAt: dept.updatedAt.toISOString(),
  };
}

export const DepartmentModel: Model<IDepartment> =
  (mongoose.models.Department as Model<IDepartment>) ||
  mongoose.model<IDepartment>('Department', DepartmentSchema);

export default DepartmentModel;
