export const DUE_FILTERS = ['overdue', 'today', 'week', 'none'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];
export const DUE = { OVERDUE: 'overdue', TODAY: 'today', WEEK: 'week', NONE: 'none' } as const satisfies Record<string, DueFilter>;
/** "Next 7 days" means today plus six more. */
export const WEEK_SPAN_DAYS = 6;

export const SORT_FIELDS = ['createdAt', 'dueDate', 'priority', 'title', 'rank'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export const SORT = { CREATED_AT: 'createdAt', DUE_DATE: 'dueDate', PRIORITY: 'priority', TITLE: 'title', RANK: 'rank' } as const satisfies Record<string, SortField>;

export const SORT_ORDERS = ['asc', 'desc'] as const;
export const ORDER = { ASC: 'asc', DESC: 'desc' } as const;

export const ISSUE_KEY_PREFIX = 'TM';
export const issueKey = (number: number) => `${ISSUE_KEY_PREFIX}-${number}`;

export const TASK_LIMITS = { TITLE_MAX: 120, DESCRIPTION_MAX: 2000, COLUMN_KEY_MAX: 40, PRIORITY_KEY_MAX: 40, SEARCH_MAX: 100 } as const;
export const PAGINATION = { DEFAULT_LIMIT: 10, MAX_LIMIT: 50, FIRST_PAGE: 1 } as const;

// Helper fields the list aggregation adds to sort by, and then removes again.
export const COMPUTED_FIELD = { PRIORITY_WEIGHT: '_priorityRank', NO_DUE_DATE: '_noDueDate', TITLE_LOWER: '_titleLower', TIME_OF_DAY: '_timeOfDay', NO_TIME: '_noTime' } as const;
/** Sorts after every real time of day, so tasks without a time come last within their date. */
export const NO_TIME_SORT_KEY = '99:99';

export const DEFAULT_COLUMN_FALLBACK_KEY = 'todo';
export const TASK_FIELD = { STATUS: 'status', OWNER: 'owner', RANK: 'rank' } as const;

// Ordering inside a column (and of the columns themselves): sparse ranks, midpoint on insert.
export const RANK_STEP = 1000;
export const RANK_MIN_GAP = 1e-6;
