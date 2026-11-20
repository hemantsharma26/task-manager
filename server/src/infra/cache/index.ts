import { cacheEnabled, env } from '../../config/env.js';
import { LOG_MESSAGE } from '../../constants/index.js';
import { logger } from '../logger.js';
import { CacheService } from './cache.service.js';
import type { CacheStore } from './cache.types.js';
import { MemoryStore } from './memory.store.js';
import { RedisStore } from './redis.store.js';

export { cacheKeys } from './cache.keys.js';
export { CacheService, type Cached } from './cache.service.js';
export type { CacheStore } from './cache.types.js';
export { MemoryStore } from './memory.store.js';
export { RedisStore } from './redis.store.js';

/** Redis when REDIS_URL is set, otherwise a private in-process store. */
function createStore(): CacheStore {
  return env.REDIS_URL ? new RedisStore(env.REDIS_URL) : new MemoryStore();
}

// With caching switched off every read misses and nothing is stored: the same code path, just no benefit.
class DisabledStore implements CacheStore {
  readonly kind = 'disabled';
  async get() {
    return null;
  }
  async set() {}
  async increment() {
    return 0;
  }
  async delete() {}
  async close() {}
}

export const cache = new CacheService(cacheEnabled ? createStore() : new DisabledStore(), logger);

logger.info(LOG_MESSAGE.CACHE_STORE(cache.kind));
