/**
 * Submission Repository (Phase 5.7).
 * Encapsulates MongoDB persistence, version history recording, and grading queries.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { SubmissionModel } from '@/lib/db/models/submission.model';
import type {
  ISubmission,
  ISubmissionHistorySubdoc,
  ISubmissionEvaluationSubdoc,
  IAssignmentAttachmentSubdoc,
} from '@/types/assignment';

export class SubmissionRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Persists an initial submission document.
   */
  public static async create(data: Partial<ISubmission>): Promise<ISubmission> {
    await this.ensureConnection();
    const submission = await SubmissionModel.create(data);
    return submission.toObject();
  }

  /**
   * Finds a submission by its ObjectId.
   */
  public static async findById(id: string): Promise<ISubmission | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;

    const submission = await SubmissionModel.findById(id).lean();
    return submission as ISubmission | null;
  }

  /**
   * Finds a student's active submission for an assignment.
   */
  public static async findByAssignmentAndStudent(
    assignmentId: string,
    studentId: string
  ): Promise<ISubmission | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(assignmentId) || !Types.ObjectId.isValid(studentId)) {
      return null;
    }

    const submission = await SubmissionModel.findOne({
      assignmentId: new Types.ObjectId(assignmentId),
      studentId: new Types.ObjectId(studentId),
    }).lean();

    return submission as ISubmission | null;
  }

  /**
   * Queries paginated submissions for an assignment.
   */
  public static async findSubmissionsByAssignment(
    assignmentId: string,
    filter: Record<string, unknown> = {},
    limit = 50,
    cursor?: string
  ): Promise<{ submissions: ISubmission[]; hasMore: boolean; nextCursor?: string }> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(assignmentId)) {
      return { submissions: [], hasMore: false };
    }

    const query: Record<string, unknown> = {
      ...filter,
      assignmentId: new Types.ObjectId(assignmentId),
    };

    if (cursor && Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const docs = await SubmissionModel.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const submissions = hasMore
      ? (docs.slice(0, limit) as unknown as ISubmission[])
      : (docs as unknown as ISubmission[]);
    const nextCursor =
      hasMore && submissions.length > 0
        ? submissions[submissions.length - 1]!._id.toString()
        : undefined;

    return { submissions, hasMore, nextCursor };
  }

  /**
   * Records a resubmission: pushes the current state into history, increments version, and updates active fields.
   */
  public static async recordResubmission(
    submissionId: string,
    params: {
      priorHistoryEntry: ISubmissionHistorySubdoc;
      newVersion: number;
      submissionText?: string;
      attachments: IAssignmentAttachmentSubdoc[];
      submittedAt: Date;
      isLate: boolean;
    }
  ): Promise<ISubmission | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(submissionId)) return null;

    const updated = await SubmissionModel.findByIdAndUpdate(
      submissionId,
      {
        $push: { history: params.priorHistoryEntry },
        $set: {
          version: params.newVersion,
          submissionText: params.submissionText,
          attachments: params.attachments,
          submittedAt: params.submittedAt,
          status: 'resubmitted',
          isLate: params.isLate,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    return updated as ISubmission | null;
  }

  /**
   * Updates evaluation marks and faculty feedback.
   */
  public static async updateEvaluation(
    submissionId: string,
    evaluation: ISubmissionEvaluationSubdoc
  ): Promise<ISubmission | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(submissionId)) return null;

    const updated = await SubmissionModel.findByIdAndUpdate(
      submissionId,
      {
        $set: {
          evaluation,
          status: 'graded',
        },
      },
      { new: true, runValidators: true }
    ).lean();

    return updated as ISubmission | null;
  }

  /**
   * Batch fetches a student's submissions for a list of assignment IDs.
   */
  public static async findStudentSubmissionsForAssignments(
    studentId: string,
    assignmentIds: string[]
  ): Promise<Map<string, ISubmission>> {
    await this.ensureConnection();
    const result = new Map<string, ISubmission>();
    if (!Types.ObjectId.isValid(studentId) || assignmentIds.length === 0) return result;

    const validAssignObjIds = assignmentIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const docs = await SubmissionModel.find({
      studentId: new Types.ObjectId(studentId),
      assignmentId: { $in: validAssignObjIds },
    }).lean();

    for (const doc of docs) {
      result.set(doc.assignmentId.toString(), doc as unknown as ISubmission);
    }

    return result;
  }
}
