import rateLimit, { ipKeyGenerator, type Store } from 'express-rate-limit';
import { RedisStore as RateLimitRedisStore } from 'rate-limit-redis';
import { env, rateLimitingEnabled } from '../../config/env.js';
import { ERROR_CODE, ERROR_MESSAGE, HTTP_METHOD, RATE_LIMIT_HEADERS_DRAFT, REDIS, ROUTE, SAFE_METHODS } from '../../constants/index.js';
import { sharedRedis } from '../../infra/cache/index.js';

const rateLimited = (message: string) => ({ error: { code: ERROR_CODE.RATE_LIMITED, message } });

/**
 * With Redis, every instance counts in the same place, so a client cannot get N times the limit by being sent to
 * N servers. Without it each process counts for itself, which is fine for a single instance.
 */
function storeFor(name: string): Store | undefined {
  const redis = sharedRedis;
  if (!redis) return undefined;
  return new RateLimitRedisStore({ prefix: `${REDIS.RATE_LIMIT_PREFIX}${name}:`, sendCommand: (...args: string[]) => redis.call(args[0]!, ...args.slice(1)) as never });
}

const common = {
  standardHeaders: RATE_LIMIT_HEADERS_DRAFT,
  legacyHeaders: false,
  // If the shared store is unreachable, let the request through rather than failing every request.
  passOnStoreError: true,
} as const;

/** A generous ceiling per client for the whole API. */
export const apiRateLimit = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_API_WINDOW_SECONDS * 1000,
  limit: env.RATE_LIMIT_API_MAX,
  store: storeFor('api'),
  skip: (req) => !rateLimitingEnabled || req.path === ROUTE.HEALTH,
  message: rateLimited(ERROR_MESSAGE.TOO_MANY_REQUESTS),
});

/** Much stricter, for sign in, register, refresh and password change. */
export const authRateLimit = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_SECONDS * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  store: storeFor('auth'),
  skip: () => !rateLimitingEnabled,
  message: rateLimited(ERROR_MESSAGE.TOO_MANY_AUTH_ATTEMPTS),
});

/** Per signed-in USER, for writes: one account cannot hammer the database however many addresses it uses. */
export const writeRateLimit = rateLimit({
  ...common,
  windowMs: env.RATE_LIMIT_WRITE_WINDOW_SECONDS * 1000,
  limit: env.RATE_LIMIT_WRITE_MAX,
  store: storeFor('write'),
  skip: (req) => !rateLimitingEnabled || SAFE_METHODS.includes(req.method) || req.method === HTTP_METHOD.GET,
  // A signed-in user is counted as themselves; anyone else by address (with IPv6 addresses grouped by /64 so one
  // person cannot dodge the limit by rotating through the addresses of their own prefix).
  keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip ?? ''),
  message: rateLimited(ERROR_MESSAGE.TOO_MANY_REQUESTS),
});
