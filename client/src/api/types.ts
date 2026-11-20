/** The key of one of the user's board columns. */
export type TaskStatus = string;

/** The key of one of the user's priorities. */
export type TaskPriority = string;

export interface User {
  id: string;
  name: string;
  email: string;
}

/** Someone a task can be assigned to. */
export interface Person {
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
  /** HH:MM (24 hour) on the due date, or null. */
  dueTime: string | null;
  /** Start of the window, HH:MM, or null. Always earlier than dueTime. */
  startTime: string | null;
  /** Hex colour of the card, or null for the default look. */
  color: string | null;
  /** Everyone the task is assigned to. */
  assignees: Person[];
  attachments: Attachment[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DueFilter = 'overdue' | 'today' | 'week' | 'none';
export type SortField = 'createdAt' | 'dueDate' | 'priority' | 'title' | 'rank';

/** What both the board and the list share. The board has no status filter: its columns are the statuses. */
export interface CommonFilters {
  priority?: TaskPriority;
  /** "me", "unassigned", or one person's id. */
  assignee?: string;
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
  /** Hex colour chosen by the user, or null for the default look. */
  color: string | null;
}

export interface TaskInput {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  startTime: string | null;
  color: string | null;
  /** Ids of the people it is assigned to. */
  assignees: string[];
}

/** A priority. Which ones exist, their names, colours and order are up to the user. */
export interface Priority {
  id: string;
  key: TaskPriority;
  name: string;
  /** Hex colour of the flag. */
  color: string;
}

export type AttachmentKind = 'image' | 'video' | 'pdf';

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  kind: AttachmentKind;
  size: number;
}

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';
export type MemberRole = Exclude<Role, 'owner'>;

/** A board the signed-in person can open: their own, or one they were invited to. */
export interface Workspace {
  id: string;
  name: string;
  role: Role;
}

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
  isOwner: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  createdAt: string;
}

/** What the link in an invitation email is for. */
export interface InvitationInfo {
  boardName: string;
  invitedBy: string;
  role: MemberRole;
  roleLabel: string;
  email: string;
}
