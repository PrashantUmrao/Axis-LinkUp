/**
 * Poll & Voting Repository (Phase 5.4).
 * Encapsulates MongoDB persistence, atomic ballot transactions, and duplicate vote prevention.
 */

import mongoose, { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { PollModel } from '@/lib/db/models/poll.model';
import { PollVoteModel } from '@/lib/db/models/poll-vote.model';
import type { IPoll } from '@/types/poll';
import type { IPollVote } from '@/types/poll-vote';
import { ConflictError, AppError } from '@/lib/errors/app-error';

export class PollRepository {
  /**
   * Persists a new poll document.
   */
  public static async create(pollData: Partial<IPoll>): Promise<IPoll> {
    await connectToDatabase();
    const poll = await PollModel.create(pollData);
    return poll.toObject();
  }

  /**
   * Finds a poll by its ObjectId (excluding soft-deleted records).
   */
  public static async findById(id: string): Promise<IPoll | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(id)) return null;

    const poll = await PollModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
    }).lean();

    return poll as IPoll | null;
  }

  /**
   * Updates a poll by its ObjectId.
   */
  public static async update(id: string, updates: Partial<IPoll>): Promise<IPoll | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(id)) return null;

    const updated = await PollModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), isDeleted: false },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return updated as IPoll | null;
  }

  /**
   * Soft deletes a poll.
   */
  public static async softDelete(id: string, deletedById: string): Promise<boolean> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(id)) return false;

    const res = await PollModel.updateOne(
      { _id: new Types.ObjectId(id), isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: new Types.ObjectId(deletedById),
        },
      }
    );

    return res.modifiedCount > 0;
  }

  /**
   * Fetches paginated polls matching audience filters.
   */
  public static async findFeed(
    filterQuery: Record<string, unknown>,
    limit = 20,
    cursor?: string
  ): Promise<{ polls: IPoll[]; nextCursor: string | null; hasMore: boolean }> {
    await connectToDatabase();

    const query: Record<string, unknown> = {
      ...filterQuery,
      isDeleted: false,
    };

    if (cursor && Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const effectiveLimit = Math.min(100, Math.max(1, limit));
    const docs = await PollModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(effectiveLimit + 1)
      .lean();

    const hasMore = docs.length > effectiveLimit;
    const polls = (hasMore ? docs.slice(0, effectiveLimit) : docs) as IPoll[];
    const lastPoll = polls[polls.length - 1];
    const nextCursor = hasMore && lastPoll ? lastPoll._id.toString() : null;

    return {
      polls,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Finds an existing ballot cast by a voter.
   */
  public static async findVote(pollId: string, voterIdentifier: string): Promise<IPollVote | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(pollId)) return null;

    const vote = await PollVoteModel.findOne({
      pollId: new Types.ObjectId(pollId),
      voterIdentifier,
    }).lean();

    return vote as IPollVote | null;
  }

  /**
   * Batch fetches ballot status for a voter across multiple poll IDs.
   */
  public static async findVotesForUser(
    voterIdentifier: string,
    pollIds: string[]
  ): Promise<Map<string, string[]>> {
    await connectToDatabase();
    const map = new Map<string, string[]>();

    if (!voterIdentifier || pollIds.length === 0) return map;

    const validPollObjectIds = pollIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const votes = await PollVoteModel.find({
      voterIdentifier,
      pollId: { $in: validPollObjectIds },
    }).lean();

    for (const v of votes) {
      map.set(
        v.pollId.toString(),
        v.selectedOptionIds.map((optId) => optId.toString())
      );
    }

    return map;
  }

  /**
   * Records a ballot and atomically updates option vote tallies.
   * Enforces one-vote-per-identity via database unique index { pollId: 1, voterIdentifier: 1 }.
   */
  public static async recordVote(
    pollId: string,
    voterIdentifier: string,
    optionIds: string[]
  ): Promise<{ updatedPoll: IPoll; vote: IPollVote }> {
    await connectToDatabase();

    const pollObjectId = new Types.ObjectId(pollId);
    const optionObjectIds = optionIds.map((id) => new Types.ObjectId(id));

    // Check if replica set session is supported
    const mongoClient = typeof (mongoose.connection as unknown as { getClient?: () => { topology?: { description?: { type?: string } } } }).getClient === 'function'
      ? (mongoose.connection as unknown as { getClient: () => { topology?: { description?: { type?: string } } } }).getClient()
      : (mongoose.connection as unknown as { client?: { topology?: { description?: { type?: string } } } }).client;
    const isReplicaSet = mongoClient?.topology?.description?.type === 'ReplicaSetWithPrimary';
    let session: mongoose.ClientSession | null = null;

    if (isReplicaSet) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
      } catch {
        // Fall back to sequential atomic execution if session allocation fails
        session = null;
      }
    }

    try {
      // 1. Insert vote document (Unique compound index blocks duplicate voter)
      let createdVoteDoc: IPollVote;
      try {
        if (session) {
          const created = await PollVoteModel.create(
            [
              {
                pollId: pollObjectId,
                voterIdentifier,
                selectedOptionIds: optionObjectIds,
                votedAt: new Date(),
              },
            ],
            { session }
          );
          const vote = created[0];
          if (!vote) {
            throw new Error('Failed to record ballot');
          }
          createdVoteDoc = vote.toObject();
        } else {
          const vote = await PollVoteModel.create({
            pollId: pollObjectId,
            voterIdentifier,
            selectedOptionIds: optionObjectIds,
            votedAt: new Date(),
          });
          createdVoteDoc = vote.toObject();
        }
      } catch (err: unknown) {
        const error = err as { code?: number; name?: string };
        if (error.code === 11000 || error.name === 'MongoServerError') {
          throw new ConflictError('You have already cast a ballot in this poll. Votes are immutable.');
        }
        throw err;
      }

      // 2. Atomically increment option tallies and totalVotes count
      // Using arrayFilters to increment each matching option atomically in one round-trip
      const updatedPoll = await PollModel.findOneAndUpdate(
        { _id: pollObjectId, isDeleted: false },
        {
          $inc: {
            'options.$[elem].voteCount': 1,
            totalVotes: 1,
          },
        },
        {
          arrayFilters: [{ 'elem._id': { $in: optionObjectIds } }],
          new: true,
          session: session ?? undefined,
        }
      ).lean();

      if (!updatedPoll) {
        throw new AppError('Failed to record ballot. Target poll not found or inactive.', 'NOT_FOUND', 404);
      }

      if (session) {
        await session.commitTransaction();
      }

      return {
        updatedPoll: updatedPoll as IPoll,
        vote: createdVoteDoc,
      };
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Manually closes an active poll.
   */
  public static async closePoll(id: string, closedById: string): Promise<IPoll | null> {
    await connectToDatabase();
    if (!Types.ObjectId.isValid(id)) return null;

    const closed = await PollModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), isDeleted: false },
      {
        $set: {
          status: 'closed',
          closedAt: new Date(),
          closedById: new Types.ObjectId(closedById),
        },
      },
      { new: true }
    ).lean();

    return closed as IPoll | null;
  }
}
