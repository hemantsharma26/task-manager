export const LOG_MESSAGE = {
  DB_CONNECTED: 'MongoDB connected',
  LISTENING: (port: number) => `API listening on http://localhost:${port}`,
  SHUTDOWN: (signal: string) => `${signal} received, shutting down`,
  START_FAILED: 'Failed to start',
  UNHANDLED_ERROR: 'Unhandled error',
  CACHE_STORE: (kind: string) => `Cache store: ${kind}`,
  CACHE_REDIS_ERROR: 'Redis error (the app keeps working without the cache)',
  CACHE_READ_FAILED: 'Cache read failed, loading from the database',
  CACHE_WRITE_FAILED: 'Cache write failed',
  SECURITY_PLACEHOLDER_SECRET: (name: string) => `${name} still has the placeholder value from .env.example. Set a real random secret before running in production.`,
  CACHE_INVALIDATE_FAILED: 'Cache invalidation failed; entries expire on their own within their TTL',
  ENV_INVALID: 'Invalid environment configuration:',
} as const;

export const LOG_LEVEL = { SILENT: 'silent', ERROR: 'error', WARN: 'warn', INFO: 'info', DEBUG: 'debug' } as const;
export const DEFAULT_LOG_LEVEL = { development: 'debug', test: 'silent', production: 'info' } as const;
export const CONFIG_LOADED = 'Configuration loaded';
export const LOG_REDACT = ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'] as const;
