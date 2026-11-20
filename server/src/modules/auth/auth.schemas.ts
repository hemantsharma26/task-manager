import { z } from 'zod';
import { NAME_LIMITS, PASSWORD_LIMITS, VALIDATION_MESSAGE } from '../../constants/index.js';

const email = z.string().trim().toLowerCase().pipe(z.email(VALIDATION_MESSAGE.EMAIL));

export const registerSchema = z.object({
  name: z.string().trim().min(1, VALIDATION_MESSAGE.NAME_REQUIRED).max(NAME_LIMITS.MAX),
  email,
  password: z.string().min(PASSWORD_LIMITS.MIN, VALIDATION_MESSAGE.PASSWORD_MIN).max(PASSWORD_LIMITS.MAX),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, VALIDATION_MESSAGE.PASSWORD_REQUIRED).max(PASSWORD_LIMITS.MAX),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
