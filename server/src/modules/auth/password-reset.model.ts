import { Schema, model, type Types } from 'mongoose';
import { MODEL } from '../../constants/index.js';

// One row per "forgot password" request. Only a hash of the secret link token is stored, so a copy of the database cannot be used to reset anyone's password.
export interface IPasswordReset {
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const schema = new Schema<IPasswordReset>(
  {
    user: { type: Schema.Types.ObjectId, ref: MODEL.USER, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ tokenHash: 1 }, { unique: true });
schema.index({ user: 1, createdAt: -1 });
// Spent and expired requests tidy themselves away a day after they expire.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 3600 });

export const PasswordReset = model<IPasswordReset>(MODEL.PASSWORD_RESET, schema);
