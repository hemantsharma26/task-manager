import { z } from 'zod';
import { ASSIGNEE_FILTER, DUE_FILTERS, TEAM, ORDER, PAGINATION, PATTERN, RICH_TEXT_LIMITS, SORT, SORT_FIELDS, SORT_ORDERS, TASK_LIMITS, VALIDATION_MESSAGE } from '../../constants/index.js';
import { isRealIsoDate } from '../../shared/utils/dates.js';

/** YYYY-MM-DD that is also a real calendar date (rejects 2026-02-31). */
export const isoDate = z.string().regex(PATTERN.ISO_DATE, VALIDATION_MESSAGE.DATE_FORMAT).refine(isRealIsoDate, VALIDATION_MESSAGE.DATE_INVALID);

/** A time of day, HH:MM in 24 hour form. */
export const timeOfDay = z.string().regex(PATTERN.TIME_24H, VALIDATION_MESSAGE.TIME);

/** A priority key. Whether it exists is checked against the user's own priorities in the service. */
const priorityKey = z.string().trim().min(1).max(TASK_LIMITS.PRIORITY_KEY_MAX);

/** A column key. Whether it exists is checked against the user's own columns in the service. */
const columnKey = z.string().trim().min(1).max(TASK_LIMITS.COLUMN_KEY_MAX);
const objectId = z.string().regex(PATTERN.OBJECT_ID, VALIDATION_MESSAGE.INVALID_ID);

const title = z.string().trim().min(1, VALIDATION_MESSAGE.TITLE_REQUIRED).max(TASK_LIMITS.TITLE_MAX, VALIDATION_MESSAGE.TITLE_TOO_LONG(TASK_LIMITS.TITLE_MAX));
// The note arrives as HTML (or plain text). Its visible length is checked after cleaning, in the service.
const description = z.string().max(RICH_TEXT_LIMITS.HTML_MAX, VALIDATION_MESSAGE.DESCRIPTION_TOO_LONG(RICH_TEXT_LIMITS.HTML_MAX));
/** Who a task is assigned to: ids of people on the board's team (checked against the real team in the service). Duplicates collapse. */
const assignees = z
  .array(objectId, { error: VALIDATION_MESSAGE.ASSIGNEES })
  .max(TEAM.MAX_ASSIGNEES, VALIDATION_MESSAGE.TOO_MANY_ASSIGNEES(TEAM.MAX_ASSIGNEES))
  .transform((ids) => [...new Set(ids)]);
const cardColor = z.string().regex(PATTERN.HEX_COLOR, VALIDATION_MESSAGE.COLOR).transform((c) => c.toLowerCase());

export const createTaskSchema = z
  .object({
    title,
    description: description.default(''),
    // Left out = the first column on the board.
    status: columnKey.optional(),
    // Left out = the user's default (Medium, or the middle one if that was deleted).
    priority: priorityKey.optional(),
    dueDate: isoDate.nullable().default(null),
    dueTime: timeOfDay.nullable().default(null),
    startTime: timeOfDay.nullable().default(null),
    color: cardColor.nullable().default(null),
    assignees: assignees.default([]),
  })
  .refine((v) => v.dueTime === null || v.dueDate !== null, { path: ['dueTime'], message: VALIDATION_MESSAGE.TIME_NEEDS_DATE })
  .refine((v) => v.startTime === null || v.dueTime !== null, { path: ['startTime'], message: VALIDATION_MESSAGE.START_NEEDS_END })
  .refine((v) => v.startTime === null || v.dueTime === null || v.startTime < v.dueTime, { path: ['startTime'], message: VALIDATION_MESSAGE.END_AFTER_START });

export const updateTaskSchema = z
  .object({ title, description, status: columnKey, priority: priorityKey, dueDate: isoDate.nullable(), dueTime: timeOfDay.nullable(), startTime: timeOfDay.nullable(), color: cardColor.nullable(), assignees })
  .partial()
  .refine((v) => Object.keys(v).length > 0, VALIDATION_MESSAGE.NOTHING_TO_UPDATE);

// Drop a card into `status`, directly below `afterId`. No afterId means the top of the column.
export const moveTaskSchema = z.object({ status: columnKey, afterId: objectId.nullish() });

export const listQuerySchema = z.object({
  status: columnKey.optional(),
  priority: priorityKey.optional(),
  due: z.enum(DUE_FILTERS).optional(),
  q: z.string().trim().max(TASK_LIMITS.SEARCH_MAX).optional(),
  // Whose tasks: "me", "unassigned", or one person's id.
  assignee: z.union([z.enum([ASSIGNEE_FILTER.ME, ASSIGNEE_FILTER.UNASSIGNED]), objectId]).optional(),
  // The client sends its own local date so "overdue" respects the user's timezone.
  today: isoDate.optional(),
  // The client's current local time. With it, "overdue" also counts today's tasks whose time has passed.
  nowTime: timeOfDay.optional(),
  sort: z.enum(SORT_FIELDS).default(SORT.CREATED_AT),
  order: z.enum(SORT_ORDERS).default(ORDER.DESC),
  page: z.coerce.number().int().min(PAGINATION.FIRST_PAGE).default(PAGINATION.FIRST_PAGE),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

export const statsQuerySchema = z.object({ today: isoDate.optional(), nowTime: timeOfDay.optional() });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
