import { Schema, model, type Types } from 'mongoose';

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
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    isDone: { type: Boolean, default: false },
    position: { type: Number, required: true },
  },
  { timestamps: true },
);

columnSchema.index({ owner: 1, key: 1 }, { unique: true });
columnSchema.index({ owner: 1, position: 1, _id: 1 });

export const Column = model<IColumn>('Column', columnSchema);

// What every account starts with. The keys match the statuses tasks already used, so existing data needs no migration.
export const DEFAULT_COLUMNS = [
  { key: 'todo', name: 'To do', isDone: false },
  { key: 'in_progress', name: 'In progress', isDone: false },
  { key: 'issue', name: 'Issue', isDone: false },
  { key: 'rework', name: 'Re-work', isDone: false },
  { key: 'done', name: 'Done', isDone: true },
] as const;

export const MAX_COLUMNS = 12;
