import { z } from 'zod';
import { PATTERN, PRIORITY_LIMITS, TASK_LIMITS, VALIDATION_MESSAGE } from '../../constants/index.js';

const name = z.string().trim().min(1, VALIDATION_MESSAGE.PRIORITY_NAME_REQUIRED).max(PRIORITY_LIMITS.NAME_MAX, VALIDATION_MESSAGE.PRIORITY_NAME_TOO_LONG(PRIORITY_LIMITS.NAME_MAX));
export const colorSchema = z.string().regex(PATTERN.HEX_COLOR, VALIDATION_MESSAGE.COLOR).transform((c) => c.toLowerCase());

export const createPrioritySchema = z.object({ name, color: colorSchema });

export const updatePrioritySchema = z
  .object({ name, color: colorSchema })
  .partial()
  .refine((v) => Object.keys(v).length > 0, VALIDATION_MESSAGE.NOTHING_TO_UPDATE);

// Place it directly after `afterId`; no afterId means "least important".
export const movePrioritySchema = z.object({ afterId: z.string().regex(PATTERN.OBJECT_ID, VALIDATION_MESSAGE.INVALID_ID).nullish() });

// Required only when tasks still use the priority.
export const deletePriorityQuerySchema = z.object({ moveTo: z.string().min(1).max(TASK_LIMITS.PRIORITY_KEY_MAX).optional() });

export type CreatePriorityInput = z.infer<typeof createPrioritySchema>;
export type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>;
export type MovePriorityInput = z.infer<typeof movePrioritySchema>;
