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

/** The user's current time as HH:MM (24 hour), in their own timezone. */
export function nowTimeLocal(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** "17:30" -> "5:30 PM". */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * Past its due date, or due today at a time that has already passed. A task due today with no time is not overdue until
 * the day is over, which matches what the server counts for the same request.
 */
export function isOverdue(due: string | null, done: boolean, today: string, time: string | null = null, nowTime: string = nowTimeLocal()): boolean {
  if (!due || done) return false;
  if (due < today) return true;
  return due === today && time !== null && time < nowTime;
}

const fmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtYear = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(date: string, today: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const local = new Date(y, m - 1, d);
  return date.slice(0, 4) === today.slice(0, 4) ? fmt.format(local) : fmtYear.format(local);
}

/** Human wording for a due date, e.g. "Due tomorrow, 5:30 PM" or "Overdue by 3 days". */
export function describeDue(due: string, done: boolean, today: string, time: string | null = null, nowTime: string = nowTimeLocal()): string {
  const diff = daysBetween(today, due);
  const at = time ? `, ${formatTime(time)}` : '';
  if (done) return `Was due ${formatDate(due, today)}${at}`;
  if (diff < 0) return `Overdue by ${-diff} ${-diff === 1 ? 'day' : 'days'}`;
  if (diff === 0) return time && time < nowTime ? `Overdue since ${formatTime(time)}` : `Due today${at}`;
  if (diff === 1) return `Due tomorrow${at}`;
  return `Due ${formatDate(due, today)}${at}`;
}
