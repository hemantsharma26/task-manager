// Redis cache: key layout, lifetimes and connection settings.
export const CACHE_PREFIX = 'tm';
/** Bump when the shape of cached values changes, so old entries are simply never read again. */
export const CACHE_SCHEMA_VERSION = 'v1';
export const CACHE_KEY_SEPARATOR = ':';

export const CACHE_NAMESPACE = {
  USER: 'user',
  VERSION: 'version',
  TASK_LIST: 'tasks:list',
  TASK_STATS: 'tasks:stats',
  COLUMNS: 'columns',
} as const;

export const CACHE_TTL_SECONDS = {
  TASK_LIST: 60,
  TASK_STATS: 60,
  COLUMNS: 300,
} as const;

export const REDIS = {
  CONNECT_TIMEOUT_MS: 2000,
  MAX_RETRIES_PER_REQUEST: 1,
  COMMAND_TIMEOUT_MS: 1000,
  RETRY_DELAY_STEP_MS: 200,
  RETRY_DELAY_MAX_MS: 2000,
  SET_WITH_EXPIRY: 'EX',
} as const;

export const CACHE_STORE = { REDIS: 'redis', MEMORY: 'memory' } as const;
export const HASH = { ALGORITHM: 'sha1', ENCODING: 'hex', LENGTH: 16 } as const;
