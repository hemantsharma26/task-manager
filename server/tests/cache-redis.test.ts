import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// The whole API against a REAL Redis (a throwaway redis-server started by the test setup).
// Skipped when redis-server is not installed. REDIS_URL must be set before the app is first imported.
const redisUrl = process.env.REDIS_TEST_URL;
if (redisUrl) process.env.REDIS_URL = redisUrl;

describe.skipIf(!redisUrl)('API with Redis', () => {
  let h: typeof import('./helpers.js');
  let cacheMod: typeof import('../src/infra/cache/index.js');

  beforeAll(async () => {
    h = await import('./helpers.js');
    cacheMod = await import('../src/infra/cache/index.js');
    await h.startDb();
  });
  beforeEach(async () => h.resetDb());
  afterAll(async () => {
    await h.stopDb();
    await cacheMod.cache.close();
  });

  it('uses the Redis store', () => {
    expect(cacheMod.cache.kind).toBe('redis');
  });

  it('serves MISS then HIT, and a write invalidates', async () => {
    const { agent } = await h.signedInAgent();
    await agent.post('/api/tasks').send({ title: 'a' });
    expect((await agent.get('/api/tasks')).headers['x-cache']).toBe('MISS');
    expect((await agent.get('/api/tasks')).headers['x-cache']).toBe('HIT');
    await agent.post('/api/tasks').send({ title: 'b' });
    const after = await agent.get('/api/tasks');
    expect(after.headers['x-cache']).toBe('MISS');
    expect(after.body.total).toBe(2);
  });

  it('writes keys in the documented layout with a TTL, and the version counter without one', async () => {
    const { Redis } = await import('ioredis');
    const raw = new Redis(redisUrl!);
    const { agent, user } = await h.signedInAgent();
    await agent.post('/api/tasks').send({ title: 'a' });
    await agent.get('/api/tasks');

    const keys = await raw.keys(`tm:v1:user:${user.id}:*`);
    expect(keys).toContain(`tm:v1:user:${user.id}:version`);
    const listKey = keys.find((k) => k.includes(':tasks:list:'))!;
    expect(listKey).toMatch(new RegExp(`^tm:v1:user:${user.id}:v\\d+:tasks:list:[0-9a-f]{16}$`));
    expect(await raw.ttl(listKey)).toBeGreaterThan(0);
    expect(await raw.ttl(`tm:v1:user:${user.id}:version`)).toBe(-1);
    await raw.quit();
  });
});
