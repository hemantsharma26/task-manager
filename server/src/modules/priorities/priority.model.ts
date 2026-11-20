import { Schema, model, type Types } from 'mongoose';
import { MODEL, PATTERN, PRIORITY_LIMITS } from '../../constants/index.js';

export interface IPriority {
  owner: Types.ObjectId;
  /** Stable identifier stored on every task (task.priority). Set once from the first name and never changed. */
  key: string;
  name: string;
  /** Hex colour of the flag shown on cards and in lists. */
  color: string;
  /** Sparse number like a task's rank: lower is less important. */
  position: number;
}

const prioritySchema = new Schema<IPriority>({
  owner: { type: Schema.Types.ObjectId, ref: MODEL.USER, required: true },
  key: { type: String, required: true },
  name: { type: String, required: true, trim: true, maxlength: PRIORITY_LIMITS.NAME_MAX },
  color: { type: String, required: true, match: PATTERN.HEX_COLOR },
  position: { type: Number, required: true },
});

prioritySchema.index({ owner: 1, key: 1 }, { unique: true });
prioritySchema.index({ owner: 1, position: 1, _id: 1 });

export const Priority = model<IPriority>(MODEL.PRIORITY, prioritySchema);
