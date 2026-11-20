import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { MODEL, PATTERN, RICH_TEXT_LIMITS, TASK_LIMITS } from '../../constants/index.js';

/** The key of one of the user's board columns (see the columns module). */
export type TaskStatus = string;

export interface ITask {
  owner: Types.ObjectId;
  /** Per-user issue number, shown as TM-<number>. */
  number: number;
  /** Position inside its status column (lower = higher up). Gaps let a drag reorder with one write. */
  rank: number;
  title: string;
  /** The note: sanitised HTML (older tasks may still hold plain text; the API shows both as HTML). */
  description: string;
  /** The note's visible text, for searching. */
  descriptionText?: string;
  /** Hex colour of the card, or null for the default look. */
  color: string | null;
  status: TaskStatus;
  /** The key of one of the user's priorities (see the priorities module). */
  priority: string;
  /** Calendar date as YYYY-MM-DD. Deliberately not a Date: it must mean the same day in every timezone. */
  dueDate: string | null;
  /** Wall-clock time on the due date, HH:MM (24 hour). Like the date it means the same hour for everybody. Only set together with a dueDate. */
  dueTime: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    owner: { type: Schema.Types.ObjectId, ref: MODEL.USER, required: true },
    number: { type: Number, required: true },
    rank: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: TASK_LIMITS.TITLE_MAX },
    description: { type: String, trim: true, maxlength: RICH_TEXT_LIMITS.HTML_MAX, default: '' },
    // No default on purpose: its absence marks a task from before notes were rich text, whose description is plain text.
    descriptionText: { type: String, maxlength: RICH_TEXT_LIMITS.TEXT_MAX },
    color: { type: String, default: null, match: PATTERN.HEX_COLOR },
    status: { type: String, required: true },
    priority: { type: String, required: true, maxlength: TASK_LIMITS.PRIORITY_KEY_MAX },
    dueDate: { type: String, default: null, match: PATTERN.ISO_DATE },
    dueTime: { type: String, default: null, match: PATTERN.TIME_24H },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Every query is scoped by owner first, so every index starts with it.
// The sorts always end in _id (a stable tiebreaker for paging), so the indexes must end in _id too,
// otherwise MongoDB reads the matches and sorts them in memory.
taskSchema.index({ owner: 1, number: 1 }, { unique: true });
taskSchema.index({ owner: 1, status: 1, rank: 1, _id: 1 }); // board columns
taskSchema.index({ owner: 1, createdAt: -1, _id: -1 }); // list view, newest first
taskSchema.index({ owner: 1, status: 1, dueDate: 1 }); // overdue / due filters

export type TaskDoc = HydratedDocument<ITask>;
export const Task = model<ITask>(MODEL.TASK, taskSchema);
