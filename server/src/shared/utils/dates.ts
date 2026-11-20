/** Today in UTC as YYYY-MM-DD. The client normally sends its own local date; this is the fallback. */
export const todayUtc = () => new Date().toISOString().slice(0, 10);

const ISO_TIME_SUFFIX = 'T00:00:00Z';

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}${ISO_TIME_SUFFIX}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True for a real calendar date: rejects 2026-02-31, which Date would roll into March. */
export function isRealIsoDate(value: string): boolean {
  const d = new Date(`${value}${ISO_TIME_SUFFIX}`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}
