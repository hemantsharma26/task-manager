import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface ITask {
  owner: Types.ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Calendar date as YYYY-MM-DD. Deliberately not a Date, see README ("Decisions"). */
  dueDate: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    dueDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Every query is scoped by owner first, so every index starts with it.
taskSchema.index({ owner: 1, createdAt: -1 });
taskSchema.index({ owner: 1, status: 1, dueDate: 1 });

// Keep completedAt in step with status. Tasks are always changed through load + save()
// (never findOneAndUpdate), so this hook cannot be bypassed.
taskSchema.pre('save', function () {
  if (!this.isModified('status')) return;
  this.completedAt = this.status === 'done' ? new Date() : null;
});

export type TaskDoc = HydratedDocument<ITask>;
export const Task = model<ITask>('Task', taskSchema);
