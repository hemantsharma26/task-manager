export const NODE_ENV = { DEVELOPMENT: 'development', TEST: 'test', PRODUCTION: 'production' } as const;
export type NodeEnv = (typeof NODE_ENV)[keyof typeof NODE_ENV];

export const SERVER = {
  DEFAULT_PORT: 4100,
  JSON_BODY_LIMIT: '50kb',
  SHUTDOWN_TIMEOUT_MS: 10_000,
  TRUST_PROXY_HOPS: 1,
  DB_SERVER_SELECTION_TIMEOUT_MS: 8000,
  // Slow-client protection: a request that dribbles in forever ties up a connection.
  HEADERS_TIMEOUT_MS: 15_000,
  REQUEST_TIMEOUT_MS: 30_000,
  KEEP_ALIVE_TIMEOUT_MS: 5_000,
  AUTH_JSON_BODY_LIMIT: '4kb',
} as const;

export const SIGNAL = { SIGTERM: 'SIGTERM', SIGINT: 'SIGINT' } as const;

export const DEFAULTS = {
  CLIENT_ORIGIN: 'http://localhost:5173',
  JWT_SECRET_MIN_LENGTH: 32,
  PEPPER_MIN_LENGTH: 32,
  /** Values copied from .env.example must never be used in production. */
  PLACEHOLDER_SECRET_PREFIX: 'change-me',
  LOG_TIME_FORMAT: 'HH:MM:ss',
  LOGGER_PRETTY_TARGET: 'pino-pretty',
} as const;

export const BOOLEAN_ENV = { TRUE: 'true', FALSE: 'false' } as const;

export const CLIENT_BUILD = { DIR: '../../client/dist', INDEX: 'index.html', ASSETS_DIR: 'assets', API_PREFIX_PATTERN: /^(?!\/api).*/ } as const;
