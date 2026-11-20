// Board columns, left to right.
export const PRIORITIES = ['low', 'medium', 'high'] as const;

/** The key of one of the user's board columns. */
export type TaskStatus = string;
export type TaskPriority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  /** Per-user issue number, shown as the key (TM-12). */
  number: number;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** YYYY-MM-DD or null */
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DueFilter = 'overdue' | 'today' | 'week' | 'none';
export type SortField = 'createdAt' | 'dueDate' | 'priority' | 'title' | 'rank';

/** What both the board and the list share. The board has no status filter: its columns are the statuses. */
export interface CommonFilters {
  priority?: TaskPriority;
  due?: DueFilter;
  q: string;
}

export interface ListFilters extends CommonFilters {
  status?: TaskStatus;
  sort: SortField;
  order: 'asc' | 'desc';
  page: number;
}

export interface TaskPage {
  items: Task[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TaskStats {
  byStatus: Record<TaskStatus, number>;
  total: number;
  overdue: number;
}

/** A board column. Which columns exist, and in what order, is up to the user. */
export interface Column {
  id: string;
  key: TaskStatus;
  name: string;
  /** Tasks in a "done" column are finished: struck through, and never overdue. */
  isDone: boolean;
}

export interface TaskInput {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
}
