import { COMMON_PASSWORDS, PASSWORD, PATTERN } from '../../constants/index.js';

export type PasswordIssue = 'min' | 'max' | 'classes' | 'common' | 'personal' | 'repeated';

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

/** Lower-cased letters and digits only, with the usual look-alike substitutions undone: "P@ssw0rd!" -> "password". */
const simplify = (password: string) =>
  [...password.toLowerCase()]
    .map((ch) => LEET[ch] ?? ch)
    .join('')
    .replace(PATTERN.NON_ALPHANUMERIC, '');

/** "password2026!" -> "password": people add a year or a symbol to a bad word and call it a new password. */
const stripTrailingNonLetters = (s: string) => s.replace(/[^a-z]+$/i, '');

const countClasses = (password: string) => [PATTERN.LOWER, PATTERN.UPPER, PATTERN.DIGIT, PATTERN.SYMBOL].filter((rx) => rx.test(password)).length;

/** "aaaaaaaaaa", "abcdefghij", "9876543210": every step the same distance from the one before. */
function isTrivialRun(password: string) {
  const codes = [...password].map((c) => c.codePointAt(0)!);
  if (codes.length < 4) return false;
  const step = codes[1]! - codes[0]!;
  return Math.abs(step) <= 1 && codes.every((c, i) => i === 0 || c - codes[i - 1]! === step);
}

const wordsOf = (value: string | undefined) =>
  (value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= PASSWORD.MIN_PART_LENGTH_FOR_PERSONAL_CHECK);

/**
 * Everything wrong with a password, for the register form to show. The rules follow current guidance: length first,
 * a deny-list of known-bad passwords, no personal data, and a simple mix rule that a long passphrase is exempt from.
 */
export function checkPassword(password: string, who: { email?: string; name?: string } = {}): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  const length = [...password].length;

  if (length < PASSWORD.MIN) issues.push('min');
  if (length > PASSWORD.MAX) issues.push('max');
  if (length < PASSWORD.PASSPHRASE_LENGTH && countClasses(password) < PASSWORD.MIN_CLASSES) issues.push('classes');

  const lowered = password.toLowerCase();
  const candidates = [simplify(password), simplify(stripTrailingNonLetters(lowered)), lowered];
  if (candidates.some((c) => COMMON_PASSWORDS.has(c))) issues.push('common');
  if (isTrivialRun(password)) issues.push('repeated');

  const lower = password.toLowerCase();
  const personal = [...wordsOf(who.email?.split('@')[0]), ...wordsOf(who.name)];
  if (personal.some((word) => lower.includes(word))) issues.push('personal');

  return issues;
}
