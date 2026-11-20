import { z } from 'zod';
import { DUE_FILTERS, PAGINATION, PATTERN, SORT, SORT_FIELDS, SORT_ORDERS, ORDER, TASK_LIMITS, TASK_PRIORITIES, VALIDATION_MESSAGE } from '../../constants/index.js';
import { isRealIsoDate } from '../../shared/utils/dates.js';

/** YYYY-MM-DD that is also a real calendar date (rejects 2026-02-31). */
export const isoDate = z.string().regex(PATTERN.ISO_DATE, VALIDATION_MESSAGE.DATE_FORMAT).refine(isRealIsoDate, VALIDATION_MESSAGE.DATE_INVALID);

/** A column key. Whether it exists is checked against the user's own columns in the service. */
const columnKey = z.string().trim().min(1).max(TASK_LIMITS.COLUMN_KEY_MAX);
const objectId = z.string().regex(PATTERN.OBJECT_ID, VALIDATION_MESSAGE.INVALID_ID);

const title = z.string().trim().min(1, VALIDATION_MESSAGE.TITLE_REQUIRED).max(TASK_LIMITS.TITLE_MAX, VALIDATION_MESSAGE.TITLE_TOO_LONG(TASK_LIMITS.TITLE_MAX));
const description = z.string().trim().max(TASK_LIMITS.DESCRIPTION_MAX, VALIDATION_MESSAGE.DESCRIPTION_TOO_LONG(TASK_LIMITS.DESCRIPTION_MAX));

export const createTaskSchema = z.object({
  title,
  description: description.default(''),
  // Left out = the first column on the board.
  status: columnKey.optional(),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  dueDate: isoDate.nullable().default(null),
});

export const updateTaskSchema = z
  .object({ title, description, status: columnKey, priority: z.enum(TASK_PRIORITIES), dueDate: isoDate.nullable() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, VALIDATION_MESSAGE.NOTHING_TO_UPDATE);

// Drop a card into `status`, directly below `afterId`. No afterId means the top of the column.
export const moveTaskSchema = z.object({ status: columnKey, afterId: objectId.nullish() });

export const listQuerySchema = z.object({
  status: columnKey.optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  due: z.enum(DUE_FILTERS).optional(),
  q: z.string().trim().max(TASK_LIMITS.SEARCH_MAX).optional(),
  // The client sends its own local date so "overdue" respects the user's timezone.
  today: isoDate.optional(),
  sort: z.enum(SORT_FIELDS).default(SORT.CREATED_AT),
  order: z.enum(SORT_ORDERS).default(ORDER.DESC),
  page: z.coerce.number().int().min(PAGINATION.FIRST_PAGE).default(PAGINATION.FIRST_PAGE),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

export const statsQuerySchema = z.object({ today: isoDate.optional() });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
