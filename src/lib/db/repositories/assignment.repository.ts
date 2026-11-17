/**
 * Assignment Repository (Phase 5.7).
 * Encapsulates MongoDB persistence, filtering, and aggregation for coursework assignments.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { AssignmentModel } from '@/lib/db/models/assignment.model';
import { SubmissionModel } from '@/lib/db/models/submission.model';
import type { IAssignment } from '@/types/assignment';

export class AssignmentRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Persists a new assignment document.
   */
  public static async create(data: Partial<IAssignment>): Promise<IAssignment> {
    await this.ensureConnection();
    const assignment = await AssignmentModel.create(data);
    return assignment.toObject();
  }

  /**
   * Finds an assignment by its ObjectId.
   */
  public static async findById(id: string): Promise<IAssignment | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;

    const assignment = await AssignmentModel.findById(id).lean();
    return assignment as IAssignment | null;
  }

  /**
   * Updates an assignment by its ObjectId.
   */
  public static async update(
    id: string,
    updates: Partial<IAssignment>
  ): Promise<IAssignment | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;

    const updated = await AssignmentModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return updated as IAssignment | null;
  }

  /**
   * Permanently removes a draft assignment if permitted.
   */
  public static async delete(id: string): Promise<boolean> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return false;

    const res = await AssignmentModel.deleteOne({ _id: new Types.ObjectId(id) });
    return res.deletedCount > 0;
  }

  /**
   * Queries paginated assignments matching filter criteria.
   */
  public static async findAssignments(
    filter: Record<string, unknown>,
    limit = 50,
    cursor?: string
  ): Promise<{ assignments: IAssignment[]; hasMore: boolean; nextCursor?: string }> {
    await this.ensureConnection();

    const query = { ...filter };
    if (cursor && Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const docs = await AssignmentModel.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const assignments = hasMore ? (docs.slice(0, limit) as unknown as IAssignment[]) : (docs as unknown as IAssignment[]);
    const nextCursor = hasMore && assignments.length > 0 ? assignments[assignments.length - 1]!._id.toString() : undefined;

    return { assignments, hasMore, nextCursor };
  }

  /**
   * Counts submissions for an assignment.
   */
  public static async countSubmissions(assignmentId: string): Promise<number> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(assignmentId)) return 0;

    return SubmissionModel.countDocuments({
      assignmentId: new Types.ObjectId(assignmentId),
    });
  }

  /**
   * Counts graded submissions for an assignment.
   */
  public static async countGradedSubmissions(assignmentId: string): Promise<number> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(assignmentId)) return 0;

    return SubmissionModel.countDocuments({
      assignmentId: new Types.ObjectId(assignmentId),
      'evaluation.isGraded': true,
    });
  }

  /**
   * Fetches submission counts for a batch of assignment IDs.
   */
  public static async getBatchCounts(
    assignmentIds: string[]
  ): Promise<Map<string, { total: number; graded: number }>> {
    await this.ensureConnection();
    const result = new Map<string, { total: number; graded: number }>();
    if (assignmentIds.length === 0) return result;

    const objectIds = assignmentIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const pipeline = [
      { $match: { assignmentId: { $in: objectIds } } },
      {
        $group: {
          _id: '$assignmentId',
          total: { $sum: 1 },
          graded: {
            $sum: {
              $cond: [{ $eq: ['$evaluation.isGraded', true] }, 1, 0],
            },
          },
        },
      },
    ];

    const aggregated = await SubmissionModel.aggregate(pipeline);
    for (const item of aggregated) {
      result.set(item._id.toString(), {
        total: item.total,
        graded: item.graded,
      });
    }

    return result;
  }
}
