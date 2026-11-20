import { issueKey } from '../../constants/index.js';
import { plainToHtml } from '../../shared/utils/html.js';
import type { ITask } from './task.model.js';

export type TaskLike = Omit<ITask, 'owner'> & { _id: unknown; owner: unknown };

export interface PersonRef {
  id: string;
  name: string;
  email: string;
}

/** `people` resolves assignee ids to names; without it the ids are listed with no details. */
export const toTaskDTO = (t: TaskLike, people?: Map<string, PersonRef>) => ({
  id: String(t._id),
  number: t.number,
  key: issueKey(t.number),
  title: t.title,
  // Notes are stored as cleaned HTML, together with their visible text. A task with no text field is from before that:
  // its description is plain text, shown (escaped) as the paragraphs it always was. Nothing unclean is ever passed on.
  description: t.descriptionText === undefined && t.description ? plainToHtml(t.description) : t.description,
  color: t.color ?? null,
  assignees: (t.assignees ?? []).flatMap((id) => {
    const person = people?.get(String(id));
    return person ? [person] : [];
  }),
  attachments: (t.attachments ?? []).map((a) => ({ id: String(a._id), name: a.name, mime: a.mime, kind: a.kind, size: a.size })),
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate ?? null,
  dueTime: t.dueTime ?? null,
  startTime: t.startTime ?? null,
  completedAt: t.completedAt ?? null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});
