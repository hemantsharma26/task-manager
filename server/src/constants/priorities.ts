// What every account starts with. The keys match the priorities tasks already used, so existing data needs no migration.
// The order matters: it is the order of importance, lowest first, and "sort by priority" follows it.
export const DEFAULT_PRIORITIES = [
  { key: 'low', name: 'Low', color: '#1d7afc' },
  { key: 'medium', name: 'Medium', color: '#e56910' },
  { key: 'high', name: 'High', color: '#c9372c' },
] as const;

export const DEFAULT_PRIORITY_KEY = 'medium';
export const MAX_PRIORITIES = 12;
export const PRIORITY_LIMITS = { NAME_MAX: 24, KEY_MAX: 30 } as const;
export const PRIORITY_KEY_FALLBACK = 'priority';
