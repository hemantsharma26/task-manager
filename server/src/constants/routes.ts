// Every URL path the API serves. Routers use the relative parts, app.ts mounts the bases.
export const ROUTE = {
  API: '/api',
  HEALTH: '/health',
  AUTH: { BASE: '/auth', REGISTER: '/register', LOGIN: '/login', LOGOUT: '/logout', ME: '/me' },
  TASKS: { BASE: '/tasks', ROOT: '/', STATS: '/stats', BY_ID: '/:id', MOVE: '/:id/move' },
  COLUMNS: { BASE: '/columns', ROOT: '/', BY_ID: '/:id', MOVE: '/:id/move' },
} as const;

export const ROUTE_PARAM = { ID: 'id' } as const;

export const HEALTH_STATUS = { OK: 'ok' } as const;
