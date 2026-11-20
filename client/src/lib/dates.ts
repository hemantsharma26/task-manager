// Due dates are calendar dates ("YYYY-MM-DD"), not instants. Comparing them as strings
// avoids every timezone/DST pitfall that new Date("2026-11-20") has.

const pad = (n: number) => String(n).padStart(2, '0');

/** Today in the user's own timezone, as YYYY-MM-DD. */
export function todayLocal(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export const isOverdue = (due: string | null, done: boolean, today: string) => !!due && !done && due < today;

const fmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtYear = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(date: string, today: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const local = new Date(y, m - 1, d);
  return date.slice(0, 4) === today.slice(0, 4) ? fmt.format(local) : fmtYear.format(local);
}

/** Human wording for a due date, e.g. "Due tomorrow" or "Overdue by 3 days". */
export function describeDue(due: string, done: boolean, today: string): string {
  const diff = daysBetween(today, due);
  if (done) return `Was due ${formatDate(due, today)}`;
  if (diff < 0) return `Overdue by ${-diff} ${-diff === 1 ? 'day' : 'days'}`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due ${formatDate(due, today)}`;
}
