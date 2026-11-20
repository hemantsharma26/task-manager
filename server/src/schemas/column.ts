import { z } from 'zod';

const name = z.string().trim().min(1, 'Give the column a name').max(30, 'Keep the name under 30 characters');

export const createColumnSchema = z.object({ name, isDone: z.boolean().default(false) });

export const updateColumnSchema = z
  .object({ name, isDone: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to update');

// Place the column directly after `afterId`; no afterId means the far left.
export const moveColumnSchema = z.object({ afterId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id').nullish() });

// Required only when the column still holds tasks.
export const deleteColumnQuerySchema = z.object({ moveTo: z.string().min(1).max(40).optional() });

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;
