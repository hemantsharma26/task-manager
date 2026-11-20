import { isValidObjectId, type Types } from 'mongoose';
import { MAX_SESSIONS_LISTED } from '../../constants/index.js';
import { Session } from './session.model.js';

export interface NewSession {
  user: string;
  tokenHash: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  ip: string;
  userAgent: string;
}

export const sessionRepository = {
  create: (data: NewSession) => Session.create({ ...data, lastUsedAt: new Date() }),

  findById: (id: string) => Session.findOne({ _id: id, revokedAt: null }),
  findByTokenHash: (tokenHash: string) => Session.findOne({ tokenHash }),
  findByPreviousTokenHash: (previousTokenHash: string) => Session.findOne({ previousTokenHash }),

  /**
   * Swap the refresh token, but only if nobody else swapped it first. The `tokenHash` in the filter makes this an
   * atomic compare-and-swap: of two requests presenting the same token, exactly one gets a document back.
   */
  rotate: (id: Types.ObjectId, currentHash: string, update: { tokenHash: string; expiresAt: Date; ip: string; userAgent: string }) =>
    Session.findOneAndUpdate(
      { _id: id, tokenHash: currentHash, revokedAt: null },
      { $set: { ...update, previousTokenHash: currentHash, rotatedAt: new Date(), lastUsedAt: new Date() } },
      { returnDocument: 'after' },
    ),

  revoke: (id: Types.ObjectId | string, reason: string) => Session.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } }),

  revokeAllForUser: (userId: string, reason: string, exceptId?: Types.ObjectId | string) =>
    Session.updateMany({ user: userId, revokedAt: null, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, { $set: { revokedAt: new Date(), revokedReason: reason } }),

  listActive: (userId: string) =>
    Session.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ lastUsedAt: -1 })
      .limit(MAX_SESSIONS_LISTED)
      .lean(),

  async findOwned(userId: string, id: string) {
    if (!isValidObjectId(id)) return null;
    return Session.findOne({ _id: id, user: userId });
  },
};
