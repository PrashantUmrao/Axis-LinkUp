/**
 * OTP Repository (Data Access Layer).
 * Encapsulates Mongoose database interactions for the 'otps' collection.
 */

import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import OtpModel from '@/lib/db/models/otp.model';
import type { IOtpDocument, OtpPurpose } from '@/types/otp';

export interface CreateOtpParams {
  email: string;
  hashedOtp: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  resendAvailableAt: Date;
  userId?: string;
  maxAttempts?: number;
}

export class OtpRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Persists a new hashed OTP record.
   * Atomically invalidates any prior unconsumed OTPs for the same email and purpose.
   */
  public static async createOtp(params: CreateOtpParams): Promise<IOtpDocument> {
    await this.ensureConnection();
    const normalizedEmail = params.email.toLowerCase().trim();

    // Invalidate existing active OTPs for this email and purpose to enforce single active OTP
    await OtpModel.updateMany(
      {
        email: normalizedEmail,
        purpose: params.purpose,
        isConsumed: false,
      },
      {
        $set: {
          isConsumed: true,
          consumedAt: new Date(),
        },
      }
    ).exec();

    const otpDoc = new OtpModel({
      email: normalizedEmail,
      hashedOtp: params.hashedOtp,
      purpose: params.purpose,
      expiresAt: params.expiresAt,
      resendAvailableAt: params.resendAvailableAt,
      userId: params.userId && Types.ObjectId.isValid(params.userId) ? new Types.ObjectId(params.userId) : null,
      maxAttempts: params.maxAttempts ?? 5,
      attempts: 0,
      isConsumed: false,
    });

    return otpDoc.save();
  }

  /**
   * Finds the active, unconsumed OTP for a given email and purpose.
   */
  public static async findActiveOtp(
    email: string,
    purpose: OtpPurpose
  ): Promise<IOtpDocument | null> {
    await this.ensureConnection();
    if (!email || !email.trim()) return null;
    return OtpModel.findOne({
      email: email.toLowerCase().trim(),
      purpose,
      isConsumed: false,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Finds the latest unconsumed OTP (regardless of expiration) to accurately diagnose expired codes.
   */
  public static async findLatestUnconsumedOtp(
    email: string,
    purpose: OtpPurpose
  ): Promise<IOtpDocument | null> {
    await this.ensureConnection();
    if (!email || !email.trim()) return null;
    return OtpModel.findOne({
      email: email.toLowerCase().trim(),
      purpose,
      isConsumed: false,
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Increments the verification attempt counter on an OTP document.
   */
  public static async incrementAttempts(id: string): Promise<IOtpDocument | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    return OtpModel.findByIdAndUpdate(
      id,
      { $inc: { attempts: 1 } },
      { new: true }
    ).exec();
  }

  /**
   * Consumes an OTP atomically, preventing any replay or concurrent reuse.
   */
  public static async consumeOtp(id: string): Promise<IOtpDocument | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    return OtpModel.findOneAndUpdate(
      { _id: id, isConsumed: false },
      {
        $set: {
          isConsumed: true,
          consumedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Associates an HMAC verification proof token hash with an OTP document
   * and atomically extends expiresAt so MongoDB's TTL index keeps the document
   * alive for the full 15-minute password-recovery proof window (AUD-C10).
   */
  public static async setVerificationProof(
    id: string,
    proofTokenHash: string,
    proofExpiresAt?: Date
  ): Promise<IOtpDocument | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id) || !proofTokenHash) return null;
    const updateFields: Record<string, unknown> = { proofTokenHash };
    if (proofExpiresAt instanceof Date && !Number.isNaN(proofExpiresAt.getTime())) {
      updateFields.expiresAt = proofExpiresAt;
    }
    return OtpModel.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Finds an OTP record by its associated verification proof token hash.
   */
  public static async findByProofTokenHash(
    proofTokenHash: string
  ): Promise<IOtpDocument | null> {
    await this.ensureConnection();
    if (!proofTokenHash || !proofTokenHash.trim()) return null;
    return OtpModel.findOne({ proofTokenHash: proofTokenHash.trim() }).exec();
  }

  /**
   * Consumes a verification proof token atomically, enforcing single-use recovery,
   * unexpired deadline, and concurrent race condition defense.
   */
  public static async consumeVerificationProof(
    id: string
  ): Promise<IOtpDocument | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return null;
    return OtpModel.findOneAndUpdate(
      {
        _id: id,
        isProofConsumed: false,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          isProofConsumed: true,
          proofConsumedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    ).exec();
  }

  /**
   * Deletes an OTP by ID (used in testing cleanup).
   */
  public static async deleteById(id: string): Promise<boolean> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(id)) return false;
    const res = await OtpModel.findByIdAndDelete(id).exec();
    return !!res;
  }
}

export default OtpRepository;

