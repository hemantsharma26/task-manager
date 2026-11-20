import { COLUMN_KEY_FALLBACK, COLUMN_KEY_SEPARATOR, COLUMN_LIMITS, PATTERN } from '../../constants/index.js';

export const escapeRegex = (s: string) => s.replace(PATTERN.REGEX_SPECIALS, '\\$&');

/** Turns a name into a key: "QA review!" -> "qa_review". */
export function slugify(name: string, fallback: string = COLUMN_KEY_FALLBACK): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(PATTERN.NON_ALPHANUMERIC_RUN, COLUMN_KEY_SEPARATOR)
    .replace(PATTERN.EDGE_UNDERSCORES, '')
    .slice(0, COLUMN_LIMITS.KEY_MAX);
  return slug || fallback;
}

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
