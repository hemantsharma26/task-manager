// The same rules the server enforces (the server is the authority and also checks a deny-list of common passwords and
// personal data). These run as you type, so nobody has to submit the form to learn what a good password needs.
export const PASSWORD_MIN = 10;
export const PASSPHRASE_LENGTH = 16;

export interface PasswordRule {
  id: 'length' | 'mix';
  label: string;
  ok: boolean;
}

const classes = (p: string) => [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((rx) => rx.test(p)).length;

export function passwordRules(password: string): PasswordRule[] {
  const length = [...password].length;
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN} characters`, ok: length >= PASSWORD_MIN },
    { id: 'mix', label: `Three of: lowercase, uppercase, number, symbol (or ${PASSPHRASE_LENGTH}+ characters)`, ok: length >= PASSPHRASE_LENGTH || classes(password) >= 3 },
  ];
}

export const meetsPasswordRules = (password: string) => passwordRules(password).every((r) => r.ok);

/** 0 (nothing typed) to 4. Only a visual hint: length and variety, not a promise of strength. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const length = [...password].length;
  let score = 0;
  if (length >= PASSWORD_MIN) score++;
  if (length >= PASSPHRASE_LENGTH) score++;
  if (classes(password) >= 3) score++;
  if (classes(password) === 4 && length >= 12) score++;
  return Math.max(1, score) as 1 | 2 | 3 | 4;
}

export const STRENGTH_LABEL = ['', 'Too weak', 'Getting there', 'Good', 'Strong'] as const;

export interface PasswordChangeProblems {
  current?: string;
  next?: string;
  confirm?: string;
}

/**
 * What is wrong with a "change password" form, field by field. Nothing is reported for a field the person has not touched yet,
 * but `valid` is only true when every field is right, which is what turns the button on.
 */
export function passwordChangeProblems(form: { current?: string; next: string; confirm: string }): PasswordChangeProblems & { valid: boolean } {
  const problems: PasswordChangeProblems = {};
  if (form.current !== undefined && !form.current) problems.current = 'Enter your current password';
  if (!meetsPasswordRules(form.next)) problems.next = 'The new password does not meet the rules yet';
  else if (form.current !== undefined && form.next === form.current) problems.next = 'The new password must be different from the current one';
  if (form.confirm !== form.next) problems.confirm = form.confirm ? 'The two passwords do not match' : 'Type the new password again to confirm it';
  return { ...problems, valid: Object.keys(problems).length === 0 };
}
