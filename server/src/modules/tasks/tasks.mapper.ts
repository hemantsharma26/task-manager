import { issueKey } from '../../constants/index.js';
import type { ITask } from './task.model.js';

export type TaskLike = Omit<ITask, 'owner'> & { _id: unknown; owner: unknown };

export const toTaskDTO = (t: TaskLike) => ({
  id: String(t._id),
  number: t.number,
  key: issueKey(t.number),
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate ?? null,
  completedAt: t.completedAt ?? null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});
