/**
 * Mongoose Model & Schema for Poll Votes (Phase 5.4).
 * Enforces one-vote-per-identity via database unique constraint and anonymous privacy.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type { IPollVote } from '@/types/poll-vote';

const PollVoteSchema = new Schema<IPollVote>(
  {
    pollId: {
      type: Schema.Types.ObjectId,
      ref: 'Poll',
      required: [true, 'Poll reference is required'],
      index: true,
    },
    voterIdentifier: {
      type: String,
      required: [true, 'Voter identifier is required'],
      trim: true,
    },
    selectedOptionIds: [
      {
        type: Schema.Types.ObjectId,
        required: [true, 'Selected option identifier is required'],
      },
    ],
    votedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One Ballot Per Identity Compound Unique Constraint
PollVoteSchema.index(
  { pollId: 1, voterIdentifier: 1 },
  { unique: true, name: 'uniq_poll_voter_ballot' }
);

// Timeline Query Index
PollVoteSchema.index(
  { pollId: 1, votedAt: -1 },
  { name: 'idx_poll_ballot_timeline' }
);

export const PollVoteModel: Model<IPollVote> =
  mongoose.models.PollVote ||
  mongoose.model<IPollVote>('PollVote', PollVoteSchema, 'poll_votes');

