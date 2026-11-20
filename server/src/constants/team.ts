// A board belongs to one person (its owner). Other people join it through an invitation and get a role, which decides what
// they may do. The owner always can do everything.
export const ROLE = { OWNER: 'owner', ADMIN: 'admin', EDITOR: 'editor', VIEWER: 'viewer' } as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];

/** Roles that can be given to a member (the owner is not a member, they are the board's owner). */
export const MEMBER_ROLES = [ROLE.ADMIN, ROLE.EDITOR, ROLE.VIEWER] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };
export const ROLE_DESCRIPTION: Record<MemberRole, string> = {
  admin: 'Everything: tasks, statuses, priorities, and the team',
  editor: 'Create, edit, move, assign and comment on tasks (cannot delete)',
  viewer: 'Look at the board only',
};

export const ACTION = {
  VIEW: 'view',
  CREATE_TASK: 'task.create',
  EDIT_TASK: 'task.edit', // edit, move, attach files
  DELETE_TASK: 'task.delete',
  ASSIGN: 'task.assign',
  MANAGE_BOARD: 'board.manage', // statuses and priorities
  MANAGE_TEAM: 'team.manage', // invite, change roles, remove
} as const;
export type Action = (typeof ACTION)[keyof typeof ACTION];

const ALL: readonly Action[] = Object.values(ACTION);
export const ROLE_ACTIONS: Readonly<Record<Role, readonly Action[]>> = {
  [ROLE.OWNER]: ALL,
  [ROLE.ADMIN]: ALL,
  [ROLE.EDITOR]: [ACTION.VIEW, ACTION.CREATE_TASK, ACTION.EDIT_TASK, ACTION.ASSIGN],
  [ROLE.VIEWER]: [ACTION.VIEW],
};

export const TEAM = {
  INVITE_TTL_DAYS: 7,
  MAX_MEMBERS: 50,
  MAX_PENDING_INVITES: 50,
  MAX_ASSIGNEES: 20,
  TOKEN_BYTES: 32,
  BOARD_SUFFIX: "'s tasks",
} as const;

export const TEAM_HEADER = { WORKSPACE_ID: 'X-Workspace-Id' } as const;
/** The same thing as a query parameter, for links the browser loads by itself (images, videos, PDFs). */
export const TEAM_QUERY = { WORKSPACE_ID: 'workspace' } as const;
export const ASSIGNEE_FILTER = { ME: 'me', UNASSIGNED: 'unassigned' } as const;

export const TEAM_EVENT = {
  INVITED: 'team.invited',
  JOINED: 'team.joined',
  ROLE_CHANGED: 'team.role_changed',
  REMOVED: 'team.member_removed',
  INVITE_REVOKED: 'team.invitation_revoked',
} as const;
