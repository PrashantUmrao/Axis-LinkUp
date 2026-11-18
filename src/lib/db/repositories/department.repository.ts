/**
 * Department Repository (Data Access Layer).
 * Encapsulates Mongoose database interactions for the 'departments' collection.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import DepartmentModel from '@/lib/db/models/department.model';
import type { IDepartment, IDepartmentProgram } from '@/types/department';

export const DEFAULT_DEPARTMENTS = [
  {
    code: 'CSE',
    name: 'Computer Science & Engineering',
    establishedYear: 2010,
    programs: [
      { code: 'BTECH_CSE', name: 'B.Tech in Computer Science & Engineering', isActive: true },
      { code: 'BTECH_AIML', name: 'B.Tech in Artificial Intelligence & Machine Learning', isActive: true },
      { code: 'BCA', name: 'Bachelor of Computer Applications', isActive: false }, // Pending project-owner resolution
      { code: 'MCA', name: 'Master of Computer Applications', isActive: false }, // Pending project-owner resolution
      { code: 'MTECH_CSE', name: 'M.Tech in Computer Science & Engineering', isActive: false }, // Unconfirmed
    ],
  },
  {
    code: 'ECE',
    name: 'Electronics & Communication Engineering',
    establishedYear: 2010,
    programs: [
      { code: 'BTECH_ECE', name: 'B.Tech in Electronics & Communication Engineering', isActive: true },
    ],
  },
  {
    code: 'ME',
    name: 'Mechanical Engineering',
    establishedYear: 2010,
    programs: [
      { code: 'BTECH_ME', name: 'B.Tech in Mechanical Engineering', isActive: true },
    ],
  },
  {
    code: 'CE',
    name: 'Civil Engineering',
    establishedYear: 2012,
    programs: [
      { code: 'BTECH_CE', name: 'B.Tech in Civil Engineering', isActive: true },
    ],
  },
  {
    code: 'EE',
    name: 'Electrical Engineering',
    establishedYear: 2011,
    programs: [
      { code: 'BTECH_EE', name: 'B.Tech in Electrical Engineering', isActive: true },
    ],
  },
  {
    code: 'IT',
    name: 'Information Technology',
    establishedYear: 2014,
    programs: [
      { code: 'BTECH_IT', name: 'B.Tech in Information Technology', isActive: true },
    ],
  },
  {
    code: 'ASH',
    name: 'Applied Sciences & Humanities',
    establishedYear: 2010,
    programs: [
      // Supporting foundational department; does not independently enroll degree/diploma students
      { code: 'DIPLOMA_AS', name: 'Diploma in Applied Sciences & Humanities', isActive: false },
    ],
  },
];

export class DepartmentRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Finds a department by internal MongoDB ObjectId.
   */
  public static async findById(id: string): Promise<IDepartment | null> {
    await this.ensureConnection();
    if (!id || !Types.ObjectId.isValid(id)) return null;
    return DepartmentModel.findById(id).exec();
  }

  /**
   * Finds a department by official institutional code (e.g. "CSE").
   */
  public static async findByCode(code: string): Promise<IDepartment | null> {
    await this.ensureConnection();
    if (!code || !code.trim()) return null;
    return DepartmentModel.findOne({
      code: code.toUpperCase().trim(),
      isActive: true,
    }).exec();
  }

  /**
   * Resolves a department by either its 24-character hex ObjectId or its code.
   */
  public static async findActiveByIdOrCode(identifier: string): Promise<IDepartment | null> {
    await this.ensureConnection();
    if (!identifier || !identifier.trim()) return null;

    const trimmed = identifier.trim();
    if (Types.ObjectId.isValid(trimmed)) {
      const byId = await DepartmentModel.findOne({ _id: trimmed, isActive: true }).exec();
      if (byId) return byId;
    }

    return DepartmentModel.findOne({
      code: trimmed.toUpperCase(),
      isActive: true,
    }).exec();
  }

  /**
   * Retrieves all active collegiate departments.
   */
  public static async findAllActive(): Promise<IDepartment[]> {
    await this.ensureConnection();
    return DepartmentModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  /**
   * Validates whether a program code is active and approved for a given department.
   */
  public static async isProgramApprovedForDepartment(
    departmentIdOrCode: string,
    programCode: string
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!departmentIdOrCode || !departmentIdOrCode.trim()) {
      return { valid: false, reason: 'Department identifier is required' };
    }
    if (!programCode || !programCode.trim()) {
      return { valid: false, reason: 'Program code is required' };
    }

    const dept = await this.findActiveByIdOrCode(departmentIdOrCode);
    if (!dept) {
      return { valid: false, reason: `Department "${departmentIdOrCode}" was not found or is inactive.` };
    }

    if (!Array.isArray(dept.programs) || dept.programs.length === 0) {
      return { valid: false, reason: `Department "${dept.code}" has no approved programs configured.` };
    }

    const normalizedCode = programCode.toUpperCase().trim();
    const program = dept.programs.find(
      (p) => p.code.toUpperCase() === normalizedCode
    );

    if (!program) {
      return {
        valid: false,
        reason: `Program "${normalizedCode}" is not approved for Department "${dept.code}".`,
      };
    }

    if (!program.isActive) {
      return {
        valid: false,
        reason: `Program "${normalizedCode}" is currently inactive in Department "${dept.code}".`,
      };
    }

    return { valid: true };
  }

  /**
   * Adds an approved academic program entry to a department, ensuring no duplicate codes.
   */
  public static async addProgramToDepartment(
    departmentIdOrCode: string,
    program: { code: string; name: string; isActive?: boolean }
  ): Promise<IDepartment | null> {
    const dept = await this.findActiveByIdOrCode(departmentIdOrCode);
    if (!dept) return null;

    const normalizedCode = program.code.toUpperCase().trim();
    const existingIndex = dept.programs.findIndex((p) => p.code.toUpperCase() === normalizedCode);

    if (existingIndex >= 0) {
      throw new Error(`Program code "${normalizedCode}" is already configured in Department "${dept.code}".`);
    }

    dept.programs.push({
      code: normalizedCode,
      name: program.name.trim(),
      isActive: program.isActive ?? true,
    });

    return dept.save();
  }

  /**
   * Activates or deactivates an existing program within a department.
   */
  public static async setProgramStatus(
    departmentIdOrCode: string,
    programCode: string,
    isActive: boolean
  ): Promise<IDepartment | null> {
    const dept = await this.findActiveByIdOrCode(departmentIdOrCode);
    if (!dept) return null;

    const normalizedCode = programCode.toUpperCase().trim();
    const prog = dept.programs.find((p) => p.code.toUpperCase() === normalizedCode);
    if (!prog) return null;

    prog.isActive = isActive;
    return dept.save();
  }

  /**
   * Creates a new academic department document.
   */
  public static async create(data: {
    code: string;
    name: string;
    establishedYear?: number;
    hodId?: string;
    programs?: IDepartmentProgram[];
  }): Promise<IDepartment> {
    await this.ensureConnection();
    const doc = new DepartmentModel({
      code: data.code.toUpperCase().trim(),
      name: data.name.trim(),
      establishedYear: data.establishedYear ?? 2010,
      hodId: data.hodId && Types.ObjectId.isValid(data.hodId) ? new Types.ObjectId(data.hodId) : null,
      programs: data.programs ?? [],
      isActive: true,
    });
    return doc.save();
  }

  /**
   * Seeds standard institutional departments and programs if the collection is empty.
   */
  public static async ensureDefaultDepartments(): Promise<void> {
    await this.ensureConnection();
    const count = await DepartmentModel.countDocuments().exec();
    if (count > 0) return;

    for (const d of DEFAULT_DEPARTMENTS) {
      await DepartmentModel.updateOne(
        { code: d.code },
        { $setOnInsert: { ...d, isActive: true } },
        { upsert: true }
      ).exec();
    }
  }
}

export default DepartmentRepository;
