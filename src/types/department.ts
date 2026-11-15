/**
 * Master Academic Department Type Definitions.
 * Conforms to Axis LinkUp Collection Design (DOC-DATA-005, Collection 1.2)
 * and Department Gap Analysis (Phase 5.1).
 */

import type { Types, Document } from 'mongoose';
import type { DepartmentCode } from '@/config/constants';

export interface IDepartmentProgram {
  code: string;
  name: string;
  isActive: boolean;
}

export interface DepartmentProgramDTO {
  code: string;
  name: string;
  isActive: boolean;
}

export interface IDepartment extends Document {
  _id: Types.ObjectId;
  code: DepartmentCode | string;
  name: string;
  hodId?: Types.ObjectId | null;
  establishedYear: number;
  isActive: boolean;
  programs: IDepartmentProgram[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentDTO {
  id: string;
  code: string;
  name: string;
  hodId: string | null;
  establishedYear: number;
  isActive: boolean;
  programs: DepartmentProgramDTO[];
  createdAt: string;
  updatedAt: string;
}
