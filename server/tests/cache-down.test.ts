import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Redis is configured but unreachable. The app must keep working, just without the speed-up.
process.env.REDIS_URL = 'redis://127.0.0.1:1';

describe('API when Redis is down', () => {
  let h: typeof import('./helpers.js');
  let cacheMod: typeof import('../src/infra/cache/index.js');

  beforeAll(async () => {
    h = await import('./helpers.js');
    cacheMod = await import('../src/infra/cache/index.js');
    await h.startDb();
  }, 30000);
  beforeEach(async () => h.resetDb());
  afterAll(async () => {
    await h.stopDb();
    await cacheMod.cache.close();
  });

  it('still creates, lists, moves and deletes, and every read is a miss', async () => {
    const { agent } = await h.signedInAgent();
    const created = await agent.post('/api/tasks').send({ title: 'works without a cache' });
    expect(created.status).toBe(201);

    const list = await agent.get('/api/tasks');
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.headers['x-cache']).toBe('MISS');
    expect((await agent.get('/api/tasks')).headers['x-cache']).toBe('MISS');

    expect((await agent.post(`/api/tasks/${created.body.task.id}/move`).send({ status: 'done', afterId: null })).status).toBe(200);
    expect((await agent.delete(`/api/tasks/${created.body.task.id}`)).status).toBe(204);
  }, 60000);
});
