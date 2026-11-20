import { Redis } from 'ioredis';
import { CACHE_STORE, LOG_MESSAGE, REDIS } from '../../constants/index.js';
import { logger } from '../logger.js';
import type { CacheStore } from './cache.types.js';

export class RedisStore implements CacheStore {
  readonly kind = CACHE_STORE.REDIS;
  readonly client: Redis;

  constructor(url: string) {
    this.client = new Redis(url, {
      connectTimeout: REDIS.CONNECT_TIMEOUT_MS,
      commandTimeout: REDIS.COMMAND_TIMEOUT_MS,
      // Fail a command quickly instead of queueing it: a slow cache is worse than no cache.
      maxRetriesPerRequest: REDIS.MAX_RETRIES_PER_REQUEST,
      retryStrategy: (attempt) => Math.min(attempt * REDIS.RETRY_DELAY_STEP_MS, REDIS.RETRY_DELAY_MAX_MS),
    });
    // Without a listener an unreachable Redis would crash the process with an unhandled 'error' event.
    this.client.on('error', (err) => logger.warn({ err: err.message }, LOG_MESSAGE.CACHE_REDIS_ERROR));
  }

  get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.client.set(key, value, REDIS.SET_WITH_EXPIRY, ttlSeconds);
  }

  async increment(key: string, ttlSeconds?: number) {
    const value = await this.client.incr(key);
    // Only the first increment starts the clock, so later attempts do not push the window forward.
    if (value === 1 && ttlSeconds) await this.client.expire(key, ttlSeconds);
    return value;
  }

  async ttl(key: string) {
    return Math.max(0, await this.client.ttl(key));
  }

  async delete(...keys: string[]) {
    if (keys.length) await this.client.del(...keys);
  }

  async close() {
    await this.client.quit().catch(() => this.client.disconnect());
  }
}
