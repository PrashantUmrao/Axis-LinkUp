/**
 * PassportShare Repository (Data Access Layer - DAL).
 * Manages revocable, rotatable public recruiter portfolio tokens (MOD-15 / Phase 5.12).
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import connectToDatabase from '@/lib/db/mongodb';
import { PassportShareModel } from '@/lib/db/models/passport-share.model';
import type { IPassportShare } from '@/types/passport';

export class PassportShareRepository {
  private static async ensureConnection(): Promise<void> {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    }
  }

  /**
   * Generates a cryptographically random URL-safe 32-hex share token.
   */
  public static generateShareToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Finds a student's PassportShare record by student ObjectId.
   */
  public static async findByStudentId(
    studentId: string | Types.ObjectId
  ): Promise<IPassportShare | null> {
    await this.ensureConnection();
    if (!Types.ObjectId.isValid(String(studentId))) return null;
    return await PassportShareModel.findOne({
      studentId: new Types.ObjectId(String(studentId)),
    }).exec();
  }

  /**
   * Finds a PassportShare record by public shareToken.
   */
  public static async findByShareToken(shareToken: string): Promise<IPassportShare | null> {
    await this.ensureConnection();
    if (!shareToken || !shareToken.trim()) return null;
    return await PassportShareModel.findOne({
      shareToken: shareToken.trim(),
    }).exec();
  }

  /**
   * Creates or updates a student's public share settings, supporting token rotation.
   */
  public static async upsertByStudentId(
    studentId: string | Types.ObjectId,
    options: {
      isEnabled?: boolean;
      headline?: string | null;
      rotateToken?: boolean;
    }
  ): Promise<IPassportShare> {
    await this.ensureConnection();
    const stuObjId = new Types.ObjectId(String(studentId));
    const existing = await this.findByStudentId(stuObjId);

    if (!existing) {
      const doc = new PassportShareModel({
        studentId: stuObjId,
        shareToken: this.generateShareToken(),
        isEnabled: options.isEnabled ?? false,
        headline: options.headline ?? null,
        viewCount: 0,
        lastRotatedAt: new Date(),
      });
      return await doc.save();
    }

    const setFields: Record<string, unknown> = {};
    if (options.isEnabled !== undefined) setFields.isEnabled = options.isEnabled;
    if (options.headline !== undefined) setFields.headline = options.headline;
    if (options.rotateToken) {
      setFields.shareToken = this.generateShareToken();
      setFields.lastRotatedAt = new Date();
    }

    const updated = await PassportShareModel.findOneAndUpdate(
      { studentId: stuObjId },
      { $set: setFields },
      { new: true, runValidators: true }
    ).exec();

    return updated || existing;
  }

  /**
   * Atomically increments the public view counter on recruiter visits.
   */
  public static async incrementViewCount(shareToken: string): Promise<IPassportShare | null> {
    await this.ensureConnection();
    return await PassportShareModel.findOneAndUpdate(
      { shareToken: shareToken.trim(), isEnabled: true },
      { $inc: { viewCount: 1 } },
      { new: true }
    ).exec();
  }
}
