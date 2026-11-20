// Mongoose model names, in one place so refs and registrations never drift apart.
export const MODEL = { USER: 'User', TASK: 'Task', COLUMN: 'Column', COUNTER: 'Counter', SESSION: 'Session', PRIORITY: 'Priority', MEMBERSHIP: 'Membership', INVITATION: 'Invitation' } as const;

export const MONGO = { DUPLICATE_KEY_CODE: 11000 } as const;
export const SORT_DIRECTION = { ASC: 1, DESC: -1 } as const;
