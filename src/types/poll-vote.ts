/**
 * Poll Vote & Ballot Type Definitions (Phase 5.4).
 * Enforces one-vote-per-identity and cryptographically anonymous ballot protection.
 */

import type { Types } from 'mongoose';

export interface IPollVote {
  _id: Types.ObjectId;
  pollId: Types.ObjectId;
  voterIdentifier: string; // HMAC-SHA256 hash if anonymous, or userId string if identified
  selectedOptionIds: Types.ObjectId[];
  votedAt: Date;
  createdAt: Date;
}

export interface CastVoteInput {
  selectedOptionIds: string[];
}

export interface CastVoteResultDTO {
  pollId: string;
  hasVoted: true;
  selectedOptionIds: string[];
  votedAt: string;
  updatedOptions?: {
    id: string;
    text: string;
    voteCount: number;
    percentage: number;
  }[];
  totalVotes?: number;
}

