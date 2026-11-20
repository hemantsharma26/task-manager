// What every account starts with. The keys match the statuses tasks already used, so existing data needs no migration.
export const DEFAULT_COLUMNS = [
  { key: 'todo', name: 'To do', isDone: false },
  { key: 'in_progress', name: 'In progress', isDone: false },
  { key: 'issue', name: 'Issue', isDone: false },
  { key: 'rework', name: 'Re-work', isDone: false },
  { key: 'done', name: 'Done', isDone: true },
] as const;

export const MAX_COLUMNS = 12;
export const COLUMN_LIMITS = { NAME_MAX: 30, KEY_MAX: 30 } as const;
export const COLUMN_KEY_FALLBACK = 'column';
export const COLUMN_KEY_SEPARATOR = '_';
