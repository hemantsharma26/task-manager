import { Schema, model, type Types } from 'mongoose';
import { MODEL, USER_AGENT_MAX_LENGTH } from '../../constants/index.js';

// One document per signed-in device. The refresh token itself is never stored, only its SHA-256.
export interface ISession {
  user: Types.ObjectId;
  /** SHA-256 of the current refresh token. */
  tokenHash: string;
  /** SHA-256 of the token this one replaced. Seeing it again later means a stolen copy is in use. */
  previousTokenHash: string | null;
  rotatedAt: Date | null;
  /** Idle expiry: pushed forward on every refresh, but never past absoluteExpiresAt. */
  expiresAt: Date;
  /** Hard limit: the session ends here no matter how active it is. */
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  ip: string;
  userAgent: string;
  lastUsedAt: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    user: { type: Schema.Types.ObjectId, ref: MODEL.USER, required: true },
    tokenHash: { type: String, required: true },
    previousTokenHash: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '', maxlength: USER_AGENT_MAX_LENGTH },
    lastUsedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ previousTokenHash: 1 }, { sparse: true });
sessionSchema.index({ user: 1, revokedAt: 1 });
// MongoDB deletes the document itself once the absolute limit has passed, so old sessions never pile up.
sessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<ISession>(MODEL.SESSION, sessionSchema);
