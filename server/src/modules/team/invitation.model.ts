import { Schema, model, type Types } from 'mongoose';
import { MEMBER_ROLES, MODEL, type MemberRole } from '../../constants/index.js';

// An invitation to join a board, sent to an email address. Only a hash of the secret link token is stored.
export interface IInvitation {
  workspace: Types.ObjectId;
  email: string;
  role: MemberRole;
  invitedBy: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: MODEL.USER, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: MEMBER_ROLES, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: MODEL.USER, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

invitationSchema.index({ tokenHash: 1 }, { unique: true });
invitationSchema.index({ workspace: 1, email: 1 });
// Old invitations tidy themselves away a month after they expire.
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export const Invitation = model<IInvitation>(MODEL.INVITATION, invitationSchema);
