import { z } from 'zod';
import { EMAIL_LIMITS, NAME_LIMITS, PASSWORD, PATTERN, VALIDATION_MESSAGE } from '../../constants/index.js';
import { checkPassword, type PasswordIssue } from './password.policy.js';

const ISSUE_MESSAGE: Record<PasswordIssue, string> = {
  min: VALIDATION_MESSAGE.PASSWORD_MIN(PASSWORD.MIN),
  max: VALIDATION_MESSAGE.PASSWORD_MAX(PASSWORD.MAX),
  classes: VALIDATION_MESSAGE.PASSWORD_CLASSES,
  common: VALIDATION_MESSAGE.PASSWORD_COMMON,
  personal: VALIDATION_MESSAGE.PASSWORD_PERSONAL,
  repeated: VALIDATION_MESSAGE.PASSWORD_REPEATED,
};

// Normalised before anything else sees it: Unicode look-alikes (full-width letters, etc.) fold to plain ones, so
// "ＡＤＭＩＮ@x.com" and "admin@x.com" cannot be registered as two different accounts.
const email = z
  .string()
  .max(EMAIL_LIMITS.MAX, VALIDATION_MESSAGE.EMAIL_TOO_LONG(EMAIL_LIMITS.MAX))
  .transform((v) => v.normalize('NFKC').trim().toLowerCase())
  .pipe(z.email(VALIDATION_MESSAGE.EMAIL))
  .refine((v) => !PATTERN.CONTROL_CHARS.test(v), VALIDATION_MESSAGE.EMAIL);

const name = z
  .string()
  .transform((v) => v.normalize('NFKC').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1, VALIDATION_MESSAGE.NAME_REQUIRED).max(NAME_LIMITS.MAX))
  .refine((v) => !PATTERN.CONTROL_CHARS.test(v), VALIDATION_MESSAGE.NAME_CONTROL_CHARS);

// A string, nothing else: an object like { "$ne": "" } where a password should be is a type error, not a query.
const newPassword = z.string().max(PASSWORD.MAX * 4, VALIDATION_MESSAGE.PASSWORD_MAX(PASSWORD.MAX));

export const registerSchema = z
  .object({ name, email, password: newPassword })
  .superRefine((v, ctx) => {
    for (const issue of checkPassword(v.password, { email: v.email, name: v.name })) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: ISSUE_MESSAGE[issue] });
    }
  });

export const loginSchema = z.object({
  email,
  // No policy here: an old or weak password must still be able to sign in. Only a size cap.
  password: z.string().min(1, VALIDATION_MESSAGE.PASSWORD_REQUIRED).max(PASSWORD.MAX * 4),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, VALIDATION_MESSAGE.PASSWORD_REQUIRED).max(PASSWORD.MAX * 4),
  newPassword,
});

export const passwordIssueMessage = (issue: PasswordIssue) => ISSUE_MESSAGE[issue];

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
