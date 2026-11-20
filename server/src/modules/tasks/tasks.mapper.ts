import { issueKey } from '../../constants/index.js';
import { plainToHtml } from '../../shared/utils/html.js';
import type { ITask } from './task.model.js';

export type TaskLike = Omit<ITask, 'owner'> & { _id: unknown; owner: unknown };

export const toTaskDTO = (t: TaskLike) => ({
  id: String(t._id),
  number: t.number,
  key: issueKey(t.number),
  title: t.title,
  // Notes are stored as cleaned HTML, together with their visible text. A task with no text field is from before that:
  // its description is plain text, shown (escaped) as the paragraphs it always was. Nothing unclean is ever passed on.
  description: t.descriptionText === undefined && t.description ? plainToHtml(t.description) : t.description,
  color: t.color ?? null,
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate ?? null,
  dueTime: t.dueTime ?? null,
  completedAt: t.completedAt ?? null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});
