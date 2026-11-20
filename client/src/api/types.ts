export const STATUSES = ['todo', 'in_progress', 'done'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;

export type TaskStatus = (typeof STATUSES)[number];
export type TaskPriority = (typeof PRIORITIES)[number];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

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
  todo: number;
  in_progress: number;
  done: number;
  total: number;
  overdue: number;
}

export interface TaskInput {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
}
