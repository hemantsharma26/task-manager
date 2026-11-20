import type { Logger } from 'pino';
import { CACHE_STATUS, LOG_MESSAGE, type CacheStatus } from '../../constants/index.js';
import { cacheKeys } from './cache.keys.js';
import type { CacheStore } from './cache.types.js';

export interface Cached<T> {
  value: T;
  /** Whether this came from the cache or had to be loaded. Sent to the client as the X-Cache header. */
  status: CacheStatus;
}

/**
 * Read-through cache with per-user versioning.
 *
 * The cache can only ever make the app faster, never break it: every failure (Redis down, a slow
 * command, a corrupt entry) is logged and treated as a miss, so the request is answered from MongoDB.
 */
export class CacheService {
  constructor(
    private readonly store: CacheStore,
    private readonly log: Logger,
  ) {}

  get kind() {
    return this.store.kind;
  }

  /** The cached value under `key`, or whatever `load` returns (which is then cached for `ttlSeconds`). */
  async remember<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<Cached<T>> {
    try {
      const raw = await this.store.get(key);
      if (raw !== null) return { value: JSON.parse(raw) as T, status: CACHE_STATUS.HIT };
    } catch (err) {
      this.log.warn({ err: (err as Error).message }, LOG_MESSAGE.CACHE_READ_FAILED);
    }

    const value = await load();
    try {
      await this.store.set(key, JSON.stringify(value), ttlSeconds);
    } catch (err) {
      this.log.warn({ err: (err as Error).message }, LOG_MESSAGE.CACHE_WRITE_FAILED);
    }
    return { value, status: CACHE_STATUS.MISS };
  }

  /** The user's current version, part of every key of theirs. 0 when nothing has been written yet or on any error. */
  async versionOf(userId: string): Promise<number> {
    try {
      return Number((await this.store.get(cacheKeys.version(userId))) ?? 0);
    } catch (err) {
      this.log.warn({ err: (err as Error).message }, LOG_MESSAGE.CACHE_READ_FAILED);
      return 0;
    }
  }

  /**
   * Forgets everything cached for a user by moving them to a new version. Call it AFTER the database write
   * has committed, so a reader that misses afterwards is guaranteed to load the new data.
   */
  async invalidateUser(userId: string): Promise<void> {
    try {
      await this.store.increment(cacheKeys.version(userId));
    } catch (err) {
      this.log.warn({ err: (err as Error).message }, LOG_MESSAGE.CACHE_INVALIDATE_FAILED);
    }
  }

  // Small helpers for short-lived security state. Unlike `remember`, these are used for decisions, so the
  // caller chooses what a failure means (see each use in the auth module).
  getRaw(key: string) {
    return this.store.get(key);
  }
  setRaw(key: string, value: string, ttlSeconds: number) {
    return this.store.set(key, value, ttlSeconds);
  }
  incrementWithin(key: string, ttlSeconds: number) {
    return this.store.increment(key, ttlSeconds);
  }
  secondsLeft(key: string) {
    return this.store.ttl(key);
  }
  deleteKeys(...keys: string[]) {
    return this.store.delete(...keys);
  }

  close() {
    return this.store.close();
  }
}
