import type { Role } from '../api/types';

/** What each role may do on a board. The server enforces the same table; this one only decides what to show. */
export type Action = 'view' | 'task.create' | 'task.edit' | 'task.delete' | 'task.assign' | 'board.manage' | 'team.manage';

const ALL: Action[] = ['view', 'task.create', 'task.edit', 'task.delete', 'task.assign', 'board.manage', 'team.manage'];

const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  owner: ALL,
  admin: ALL,
  editor: ['view', 'task.create', 'task.edit', 'task.assign'],
  viewer: ['view'],
};

export const can = (role: Role, action: Action) => ROLE_ACTIONS[role].includes(action);

export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };
export const ROLE_HINT: Record<Exclude<Role, 'owner'>, string> = {
  admin: 'Everything: tasks, statuses, priorities and the team',
  editor: 'Create, edit, move and assign tasks (cannot delete)',
  viewer: 'Look at the board only',
};
