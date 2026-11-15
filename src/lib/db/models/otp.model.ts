/**
 * Mongoose Schema and Model for One-Time Passcodes (OTP).
 * Conforms to Phase 5.2.6 specifications:
 * Stores only cryptographic SHA-256 hashes of 6-digit OTPs.
 * Includes MongoDB TTL index for automatic cleanup of expired tokens.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import type { IOtpDocument, OtpPurpose } from '@/types/otp';

export const OTP_PURPOSES: OtpPurpose[] = [
  'email_verification',
  'account_activation',
  'password_recovery',
];

const OtpSchema = new Schema<IOtpDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
    },
    hashedOtp: {
      type: String,
      required: [true, 'Hashed OTP is required'],
    },
    purpose: {
      type: String,
      required: [true, 'OTP verification purpose is required'],
      enum: {
        values: OTP_PURPOSES,
        message: 'Invalid OTP purpose: {VALUE}',
      },
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration timestamp is required'],
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    resendAvailableAt: {
      type: Date,
      required: [true, 'Resend cooldown timestamp is required'],
    },
    isConsumed: {
      type: Boolean,
      default: false,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    proofTokenHash: {
      type: String,
      default: null,
      index: true,
    },
    isProofConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
    proofConsumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'otps',
  }
);

// Indexes
// 1. Fast lookup for unconsumed OTP matching email and purpose
OtpSchema.index({ email: 1, purpose: 1, isConsumed: 1 });

// 2. MongoDB TTL index: automatically deletes document once expiresAt is reached
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 3. User association index
OtpSchema.index({ userId: 1, purpose: 1 }, { sparse: true });

// 4. Verification proof lookup index
OtpSchema.index({ proofTokenHash: 1, isProofConsumed: 1 }, { sparse: true });

export const OtpModel: Model<IOtpDocument> =
  mongoose.models.Otp || mongoose.model<IOtpDocument>('Otp', OtpSchema);

export default OtpModel;

