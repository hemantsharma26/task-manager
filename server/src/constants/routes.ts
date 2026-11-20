// Every URL path the API serves. Routers use the relative parts, app.ts mounts the bases.
export const ROUTE = {
  API: '/api',
  HEALTH: '/health',
  AUTH: {
    BASE: '/auth',
    REGISTER: '/register',
    LOGIN: '/login',
    LOGOUT: '/logout',
    LOGOUT_ALL: '/logout-all',
    REFRESH: '/refresh',
    ME: '/me',
    PASSWORD: '/password',
    SESSIONS: '/sessions',
    SESSION_BY_ID: '/sessions/:id',
  },
  TASKS: {
    BASE: '/tasks',
    ROOT: '/',
    STATS: '/stats',
    BY_ID: '/:id',
    MOVE: '/:id/move',
    ATTACHMENTS: '/:id/attachments',
    ATTACHMENT_BY_ID: '/:id/attachments/:attachmentId',
  },
  COLUMNS: { BASE: '/columns', ROOT: '/', BY_ID: '/:id', MOVE: '/:id/move' },
  PRIORITIES: { BASE: '/priorities', ROOT: '/', BY_ID: '/:id', MOVE: '/:id/move' },
  TEAM: { BASE: '/team', MEMBERS: '/members', MEMBER_BY_ID: '/members/:userId', INVITATIONS: '/invitations', INVITATION_BY_ID: '/invitations/:invitationId' },
  INVITATIONS: { BASE: '/invitations', BY_TOKEN: '/:token', ACCEPT: '/:token/accept' },
  WORKSPACES: { BASE: '/workspaces' },
} as const;

export const ROUTE_PARAM = { ID: 'id', ATTACHMENT_ID: 'attachmentId', USER_ID: 'userId', INVITATION_ID: 'invitationId', TOKEN: 'token' } as const;

export const HEALTH_STATUS = { OK: 'ok' } as const;
