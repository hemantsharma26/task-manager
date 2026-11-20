import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CacheService, MemoryStore, RedisStore, type CacheStore } from '../src/infra/cache/index.js';
import { CACHE_STATUS } from '../src/constants/index.js';
import { cacheKeys } from '../src/infra/cache/cache.keys.js';
import { logger } from '../src/infra/logger.js';

// The same behaviour must hold for the in-process store and for Redis, so one suite runs against both.
const redisUrl = process.env.REDIS_TEST_URL;

function contract(name: string, make: () => CacheStore, supportsFakeClock = false) {
  describe(`${name} store`, () => {
    let store: CacheStore;
    beforeAll(() => {
      store = make();
    });
    afterAll(() => store.close());

    it('stores and returns a value, and returns null for an unknown key', async () => {
      await store.set('t:a', 'hello', 30);
      expect(await store.get('t:a')).toBe('hello');
      expect(await store.get('t:missing')).toBeNull();
    });

    it('deletes keys', async () => {
      await store.set('t:d1', '1', 30);
      await store.set('t:d2', '2', 30);
      await store.delete('t:d1', 't:d2');
      expect(await store.get('t:d1')).toBeNull();
      expect(await store.get('t:d2')).toBeNull();
    });

    it('increments atomically, starting from 1', async () => {
      const results = await Promise.all(Array.from({ length: 20 }, () => store.increment('t:counter')));
      expect([...results].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      expect(await store.get('t:counter')).toBe('20');
    });

    it.skipIf(supportsFakeClock)('expires a value after its TTL', async () => {
      await store.set('t:ttl', 'x', 1);
      await new Promise((r) => setTimeout(r, 1300));
      expect(await store.get('t:ttl')).toBeNull();
    });
  });
}

contract('Memory', () => new MemoryStore());
describe.skipIf(!redisUrl)('Redis', () => contract('Redis (real server)', () => new RedisStore(redisUrl!)));

describe('MemoryStore expiry with a fake clock', () => {
  it('expires entries exactly at their TTL and never expires counters', async () => {
    let now = 1_000_000;
    const store = new MemoryStore(() => now);
    await store.set('k', 'v', 10);
    await store.increment('c');
    now += 9_999;
    expect(await store.get('k')).toBe('v');
    now += 2;
    expect(await store.get('k')).toBeNull();
    expect(await store.get('c')).toBe('1');
  });
});

describe('CacheService', () => {
  const make = (store: CacheStore = new MemoryStore()) => new CacheService(store, logger);

  it('loads once, then serves from the cache', async () => {
    const cache = make();
    let loads = 0;
    const load = async () => ({ n: ++loads, when: new Date('2026-11-20T00:00:00Z') });

    const first = await cache.remember('k', 60, load);
    const second = await cache.remember('k', 60, load);
    expect([first.status, second.status]).toEqual([CACHE_STATUS.MISS, CACHE_STATUS.HIT]);
    expect(loads).toBe(1);
    // A hit comes back through JSON, which is exactly what the HTTP response would have contained anyway.
    expect(JSON.stringify(second.value)).toBe(JSON.stringify(first.value));
  });

  it('keeps users apart: invalidating one user changes only that user\'s version', async () => {
    const cache = make();
    expect(await cache.versionOf('alice')).toBe(0);
    await cache.invalidateUser('alice');
    await cache.invalidateUser('alice');
    expect(await cache.versionOf('alice')).toBe(2);
    expect(await cache.versionOf('bob')).toBe(0);
  });

  it('after an invalidation the old entries are unreachable, because the version is part of the key', async () => {
    const cache = make();
    let loads = 0;
    const read = async () => {
      const v = await cache.versionOf('alice');
      return cache.remember(cacheKeys.taskList('alice', v, { page: 1 }), 60, async () => ++loads);
    };
    expect((await read()).status).toBe(CACHE_STATUS.MISS);
    expect((await read()).status).toBe(CACHE_STATUS.HIT);
    await cache.invalidateUser('alice');
    expect((await read()).status).toBe(CACHE_STATUS.MISS);
    expect(loads).toBe(2);
  });

  it('fails open: a broken store only means every read is a miss', async () => {
    const broken: CacheStore = {
      kind: 'broken',
      get: async () => { throw new Error('connection lost'); },
      set: async () => { throw new Error('connection lost'); },
      increment: async () => { throw new Error('connection lost'); },
      delete: async () => { throw new Error('connection lost'); },
      close: async () => {},
    };
    const cache = make(broken);
    const result = await cache.remember('k', 60, async () => 'fresh from the database');
    expect(result).toEqual({ value: 'fresh from the database', status: CACHE_STATUS.MISS });
    expect(await cache.versionOf('alice')).toBe(0);
    await expect(cache.invalidateUser('alice')).resolves.toBeUndefined();
  });

  it('treats a corrupt entry as a miss instead of crashing', async () => {
    const store = new MemoryStore();
    await store.set('k', '{not json', 60);
    const result = await make(store).remember('k', 60, async () => 42);
    expect(result).toEqual({ value: 42, status: CACHE_STATUS.MISS });
  });
});

describe('cache keys', () => {
  it('are namespaced, versioned and independent of property order', () => {
    const a = cacheKeys.taskList('u1', 3, { page: 1, sort: 'rank' });
    const b = cacheKeys.taskList('u1', 3, { sort: 'rank', page: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^tm:v1:user:u1:v3:tasks:list:[0-9a-f]{16}$/);
    expect(cacheKeys.taskList('u1', 3, { page: 2 })).not.toBe(a);
    expect(cacheKeys.taskList('u1', 4, { page: 1, sort: 'rank' })).not.toBe(a);
    expect(cacheKeys.taskList('u2', 3, { page: 1, sort: 'rank' })).not.toBe(a);
    expect(cacheKeys.version('u1')).toBe('tm:v1:user:u1:version');
    expect(cacheKeys.columns('u1', 2)).toBe('tm:v1:user:u1:v2:columns');
  });
});
