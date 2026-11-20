import { z } from 'zod';
import { COLUMN_LIMITS, PATTERN, TASK_LIMITS, VALIDATION_MESSAGE } from '../../constants/index.js';

const name = z.string().trim().min(1, VALIDATION_MESSAGE.COLUMN_NAME_REQUIRED).max(COLUMN_LIMITS.NAME_MAX, VALIDATION_MESSAGE.COLUMN_NAME_TOO_LONG(COLUMN_LIMITS.NAME_MAX));

export const createColumnSchema = z.object({ name, isDone: z.boolean().default(false) });

export const updateColumnSchema = z
  .object({ name, isDone: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, VALIDATION_MESSAGE.NOTHING_TO_UPDATE);

// Place the column directly after `afterId`; no afterId means the far left.
export const moveColumnSchema = z.object({ afterId: z.string().regex(PATTERN.OBJECT_ID, VALIDATION_MESSAGE.INVALID_ID).nullish() });

// Required only when the column still holds tasks.
export const deleteColumnQuerySchema = z.object({ moveTo: z.string().min(1).max(TASK_LIMITS.COLUMN_KEY_MAX).optional() });

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;
