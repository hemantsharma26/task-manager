import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../models/Task.js';

/** YYYY-MM-DD that is also a real calendar date (rejects 2026-02-31). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Not a valid calendar date');

const title = z.string().trim().min(1, 'Title is required').max(120, 'Title is too long (max 120)');
const description = z.string().trim().max(2000, 'Description is too long (max 2000)');

export const createTaskSchema = z.object({
  title,
  description: description.default(''),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  dueDate: isoDate.nullable().default(null),
});

export const updateTaskSchema = z
  .object({
    title,
    description,
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    dueDate: isoDate.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

export const DUE_FILTERS = ['overdue', 'today', 'week', 'none'] as const;
export const SORT_FIELDS = ['createdAt', 'dueDate', 'priority', 'title', 'rank'] as const;

export const listQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  due: z.enum(DUE_FILTERS).optional(),
  q: z.string().trim().max(100).optional(),
  // The client sends its own local date so "overdue" respects the user's timezone.
  today: isoDate.optional(),
  sort: z.enum(SORT_FIELDS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

// Drop a card into `status`, directly below `afterId`. No afterId means the top of the column.
export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  afterId: objectId.nullish(),
});

export const statsQuerySchema = z.object({ today: isoDate.optional() });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
