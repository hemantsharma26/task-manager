import { Schema, model, type Types } from 'mongoose';
import { COLUMN_LIMITS, MODEL } from '../../constants/index.js';

export interface IColumn {
  owner: Types.ObjectId;
  /** Stable identifier stored on every task (task.status). Set once from the first name and never changed. */
  key: string;
  name: string;
  /** Tasks in a "done" column are finished: they get a completedAt and are never overdue. */
  isDone: boolean;
  /** Sparse number, same idea as a task's rank: lower is further left. */
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

const columnSchema = new Schema<IColumn>(
  {
    owner: { type: Schema.Types.ObjectId, ref: MODEL.USER, required: true },
    key: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: COLUMN_LIMITS.NAME_MAX },
    isDone: { type: Boolean, default: false },
    position: { type: Number, required: true },
  },
  { timestamps: true },
);

columnSchema.index({ owner: 1, key: 1 }, { unique: true });
columnSchema.index({ owner: 1, position: 1, _id: 1 });

export const Column = model<IColumn>(MODEL.COLUMN, columnSchema);
