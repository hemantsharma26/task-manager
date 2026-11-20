// Calendar arithmetic on "YYYY-MM-DD" strings. Everything is done in UTC on purpose: a calendar date has no time zone,
// and local-time maths would skip or repeat a day around daylight-saving changes.

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

export const parseDate = (s: string): { y: number; m: number; d: number } => {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return { y, m, d };
};

export const toDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

const utc = (s: string) => {
  const { y, m, d } = parseDate(s);
  return Date.UTC(y, m - 1, d);
};

const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (s: string, days: number) => fromUtc(utc(s) + days * DAY_MS);

/** Same day of the month `delta` months away, clamped (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: string, delta: number): string {
  const { y, m, d } = parseDate(s);
  const index = y * 12 + (m - 1) + delta;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return toDate(ny, nm, Math.min(d, last));
}

/** 0 = Monday ... 6 = Sunday. */
export const weekdayMonFirst = (s: string) => (new Date(utc(s)).getUTCDay() + 6) % 7;

/** The 42 days (six weeks, Monday first) shown for a month, including the tail of the previous and the head of the next. */
export function monthGrid(year: number, month: number): string[] {
  const first = toDate(year, month, 1);
  const start = addDays(first, -weekdayMonFirst(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const monthOf = (s: string) => s.slice(0, 7);

const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const formatMonthTitle = (s: string) => monthName.format(new Date(utc(s)));

const longDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const formatLongDate = (s: string) => longDate.format(new Date(utc(s)));

export const WEEKDAYS_MON_FIRST = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/** The next Monday strictly after `s` (so "next Monday" on a Monday is a week away). */
export const nextMonday = (s: string) => addDays(s, 7 - weekdayMonFirst(s));
