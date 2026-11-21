import { Schema, model, type Types } from 'mongoose';
import { MEMBER_ROLES, MODEL, type MemberRole } from '../../constants/index.js';

export interface IMembership {
  /** The board: the owner's user id. */
  workspace: Types.ObjectId;
  user: Types.ObjectId;
  role: MemberRole;
  createdAt: Date;
}

const membershipSchema = new Schema<IMembership>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: MODEL.USER, required: true },
    user: { type: Schema.Types.ObjectId, ref: MODEL.USER, required: true },
    role: { type: String, enum: MEMBER_ROLES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

membershipSchema.index({ workspace: 1, user: 1 }, { unique: true });
membershipSchema.index({ user: 1 });

export const Membership = model<IMembership>(MODEL.MEMBERSHIP, membershipSchema);
