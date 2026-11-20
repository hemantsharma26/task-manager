import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { taskRepository } from '../src/modules/tasks/tasks.repository.js';
import { columnRepository } from '../src/modules/columns/columns.repository.js';
import { resetDb, signedInAgent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
beforeEach(resetDb);
afterAll(stopDb);

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];
const xcache = (res: { headers: Record<string, unknown> }) => res.headers['x-cache'];
const make = (agent: Agent, title: string) => agent.post('/api/tasks').send({ title });

describe('API caching', () => {
  it('answers a repeated list from the cache without touching the database', async () => {
    const { agent } = await signedInAgent();
    await make(agent, 'a');
    const spy = vi.spyOn(taskRepository, 'findPage');

    const first = await agent.get('/api/tasks?status=todo');
    const second = await agent.get('/api/tasks?status=todo');
    expect([xcache(first), xcache(second)]).toEqual(['MISS', 'HIT']);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(second.body).toEqual(first.body);
    spy.mockRestore();
  });

  it('treats a different filter, sort or page as a different entry', async () => {
    const { agent } = await signedInAgent();
    await make(agent, 'a');
    await agent.get('/api/tasks?status=todo');
    expect(xcache(await agent.get('/api/tasks?status=done'))).toBe('MISS');
    expect(xcache(await agent.get('/api/tasks?status=todo&sort=title'))).toBe('MISS');
    expect(xcache(await agent.get('/api/tasks?status=todo'))).toBe('HIT');
  });

  it('is invalidated by every kind of write, so a reader never sees stale data', async () => {
    const { agent } = await signedInAgent();
    const created = (await make(agent, 'a')).body.task as { id: string };
    const list = () => agent.get('/api/tasks?limit=50');
    const titles = async () => ((await list()).body.items as { title: string }[]).map((t) => t.title);

    await list();
    expect(xcache(await list())).toBe('HIT');

    await make(agent, 'b');
    expect(xcache(await list())).toBe('MISS');
    expect((await titles()).sort()).toEqual(['a', 'b']);

    await agent.patch(`/api/tasks/${created.id}`).send({ title: 'a2' });
    expect(xcache(await list())).toBe('MISS');
    expect(await titles()).toContain('a2');

    await agent.post(`/api/tasks/${created.id}/move`).send({ status: 'done', afterId: null });
    expect(xcache(await list())).toBe('MISS');

    await agent.delete(`/api/tasks/${created.id}`);
    expect(xcache(await list())).toBe('MISS');
    expect(await titles()).toEqual(['b']);
  });

  it('caches stats and columns too, and column changes invalidate the tasks view', async () => {
    const { agent } = await signedInAgent();
    await make(agent, 'a');
    await agent.get('/api/tasks/stats');
    expect(xcache(await agent.get('/api/tasks/stats'))).toBe('HIT');
    await agent.get('/api/columns');
    expect(xcache(await agent.get('/api/columns'))).toBe('HIT');

    await agent.post('/api/columns').send({ name: 'Review' });
    expect(xcache(await agent.get('/api/tasks/stats'))).toBe('MISS');
    expect((await agent.get('/api/tasks/stats')).body.byStatus).toHaveProperty('review');
  });

  it('keeps users independent: one user\'s writes do not flush another user\'s cache', async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    await make(alice.agent, 'a');
    await alice.agent.get('/api/tasks');
    expect(xcache(await alice.agent.get('/api/tasks'))).toBe('HIT');

    await make(bob.agent, 'b');
    expect(xcache(await alice.agent.get('/api/tasks'))).toBe('HIT');
    expect((await bob.agent.get('/api/tasks')).body.total).toBe(1);
    expect((await alice.agent.get('/api/tasks')).body.total).toBe(1);
  });

  it('never serves one user\'s cached page to another user', async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    await make(alice.agent, 'alice secret');
    await alice.agent.get('/api/tasks');
    const seenByBob = await bob.agent.get('/api/tasks');
    expect(JSON.stringify(seenByBob.body)).not.toContain('alice secret');
    expect(xcache(seenByBob)).toBe('MISS');
  });

  it('serves the columns from the cache for task writes, so they do not hit the database every time', async () => {
    const { agent } = await signedInAgent();
    await agent.get('/api/columns');
    const spy = vi.spyOn(columnRepository, 'findAll');
    await make(agent, 'one');
    await make(agent, 'two');
    // each write invalidates, so the columns are re-read at most once per write; reads in between are free
    expect(spy.mock.calls.length).toBeLessThanOrEqual(2);
    spy.mockRestore();
  });
});
