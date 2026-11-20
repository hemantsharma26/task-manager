import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Task } from '../src/modules/tasks/task.model.js';
import { app, resetDb, signedInAgent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
beforeEach(resetDb);
afterAll(stopDb);

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];
type T = { id: string; key: string; number: number; status: string; title: string; completedAt?: string | null };

const make = async (agent: Agent, body: Record<string, unknown>) => (await agent.post('/api/tasks').send(body)).body.task as T;
const column = async (agent: Agent, status: string) =>
  ((await agent.get(`/api/tasks?status=${status}&sort=rank&order=asc&limit=50`)).body.items as T[]).map((t) => t.title);
const move = (agent: Agent, id: string, status: string, afterId?: string | null) =>
  agent.post(`/api/tasks/${id}/move`).send({ status, afterId });

describe('issue keys', () => {
  it('numbers tasks per user starting at 1', async () => {
    const a = await signedInAgent();
    const b = await signedInAgent();
    expect((await make(a.agent, { title: 'one' })).key).toBe('TM-1');
    expect((await make(a.agent, { title: 'two' })).key).toBe('TM-2');
    expect((await make(b.agent, { title: 'other user' })).key).toBe('TM-1');
  });

  it('never hands out the same number twice under concurrent creates', async () => {
    const { agent } = await signedInAgent();
    const created = await Promise.all(Array.from({ length: 15 }, (_, i) => make(agent, { title: `t${i}` })));
    expect(new Set(created.map((t) => t.number)).size).toBe(15);
  });

  it('does not reuse a number after a delete', async () => {
    const { agent } = await signedInAgent();
    const first = await make(agent, { title: 'a' });
    await agent.delete(`/api/tasks/${first.id}`);
    expect((await make(agent, { title: 'b' })).key).toBe('TM-2');
  });
});

describe('board ordering', () => {
  it('puts new tasks at the bottom of their column', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'a' });
    await make(agent, { title: 'b' });
    await make(agent, { title: 'c', status: 'in_progress' });
    expect(await column(agent, 'todo')).toEqual(['a', 'b']);
    expect(await column(agent, 'in_progress')).toEqual(['c']);
  });

  it('moves a card to another column below a given card', async () => {
    const { agent } = await signedInAgent();
    const a = await make(agent, { title: 'a' });
    const x = await make(agent, { title: 'x', status: 'in_progress' });
    await make(agent, { title: 'y', status: 'in_progress' });

    const res = await move(agent, a.id, 'in_progress', x.id);
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
    expect(await column(agent, 'in_progress')).toEqual(['x', 'a', 'y']);
    expect(await column(agent, 'todo')).toEqual([]);
  });

  it('moves to the top when no card is given, and reorders inside a column', async () => {
    const { agent } = await signedInAgent();
    const a = await make(agent, { title: 'a' });
    await make(agent, { title: 'b' });
    const c = await make(agent, { title: 'c' });

    await move(agent, c.id, 'todo', null);
    expect(await column(agent, 'todo')).toEqual(['c', 'a', 'b']);
    await move(agent, c.id, 'todo', a.id);
    expect(await column(agent, 'todo')).toEqual(['a', 'c', 'b']);
  });

  it('sets and clears completedAt when a card is dragged into and out of Done', async () => {
    const { agent } = await signedInAgent();
    const a = await make(agent, { title: 'a' });
    expect((await move(agent, a.id, 'done', null)).body.task.completedAt).not.toBeNull();
    expect((await move(agent, a.id, 'todo', null)).body.task.completedAt).toBeNull();
  });

  it('keeps the order correct after many drops into the same gap (forces a renumber)', async () => {
    const { agent } = await signedInAgent();
    const first = await make(agent, { title: 'first' });
    await make(agent, { title: 'last' });
    // Each new card goes right after "first", halving the gap every time until the column must be renumbered.
    const expected = ['first'];
    for (let i = 0; i < 45; i++) {
      const card = await make(agent, { title: `n${i}`, status: 'in_progress' });
      await move(agent, card.id, 'todo', first.id);
      expected.splice(1, 0, `n${i}`);
    }
    expect(await column(agent, 'todo')).toEqual([...expected, 'last']);
    const ranks = (await Task.find({ status: 'todo' }).sort({ rank: 1 }).lean()).map((t) => t.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  }, 60000);

  it('ignores a "below" card that is in another column and does not touch other users', async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const mine = await make(alice.agent, { title: 'mine' });
    const theirs = await make(bob.agent, { title: 'theirs' });

    expect((await move(bob.agent, mine.id, 'done', null)).status).toBe(404);
    const res = await move(alice.agent, mine.id, 'done', theirs.id);
    expect(res.status).toBe(200);
    expect(await column(alice.agent, 'done')).toEqual(['mine']);
    expect((await bob.agent.get(`/api/tasks/${theirs.id}`)).body.task.status).toBe('todo');
  });

  it('validates the move body', async () => {
    const { agent } = await signedInAgent();
    const a = await make(agent, { title: 'a' });
    expect((await move(agent, a.id, 'archived')).status).toBe(400);
    expect((await move(agent, a.id, 'todo', 'nope')).status).toBe(400);
  });

  it('a status change from the form lands at the bottom of the new column', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'existing', status: 'done' });
    const a = await make(agent, { title: 'a' });
    await agent.patch(`/api/tasks/${a.id}`).send({ status: 'done' });
    expect(await column(agent, 'done')).toEqual(['existing', 'a']);
  });
});

describe('http caching and compression', () => {
  it('marks API reads as private and revalidated, and answers an unchanged list with a 304', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'a' });

    const first = await agent.get('/api/tasks');
    expect(first.headers['cache-control']).toBe('private, no-cache');
    expect(first.headers.vary).toMatch(/Cookie/i);
    expect(first.headers.etag).toBeTruthy();

    const again = await agent.get('/api/tasks').set('If-None-Match', first.headers.etag!);
    expect(again.status).toBe(304);
    expect(again.text).toBe('');

    await make(agent, { title: 'b' });
    const changed = await agent.get('/api/tasks').set('If-None-Match', first.headers.etag!);
    expect(changed.status).toBe(200);
    expect(changed.body.total).toBe(2);
  });

  it('does not cache writes or the health check', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').send({ title: 'a' })).headers['cache-control']).toBeUndefined();
    expect((await request(app).get('/api/health')).headers['cache-control']).toBeUndefined();
  });

  it('compresses large responses', async () => {
    const { agent } = await signedInAgent();
    for (let i = 0; i < 12; i++) await make(agent, { title: `A reasonably long task title number ${i}`, description: 'x'.repeat(400) });
    const res = await agent.get('/api/tasks?limit=50').set('Accept-Encoding', 'gzip');
    expect(res.headers['content-encoding']).toBe('gzip');
  });
});

type Explain = { queryPlanner: { winningPlan: unknown } };
const winningPlan = (explain: unknown) => JSON.stringify((explain as Explain).queryPlanner.winningPlan);

describe('index usage', () => {
  it('serves a board column from the (owner, status, rank) index without an in-memory sort', async () => {
    const { agent, user } = await signedInAgent();
    for (let i = 0; i < 5; i++) await make(agent, { title: `t${i}` });
    await Task.init();
    const plan = await Task.find({ owner: user.id, status: 'todo' }).sort({ rank: 1, _id: 1 }).limit(20).explain('queryPlanner');
    const winning = winningPlan(plan);
    expect(winning).toContain('IXSCAN');
    expect(winning).not.toContain('"stage":"SORT"');
  });
});

describe('list index usage', () => {
  it('serves the default list (newest first) from an index without a sort stage', async () => {
    const { agent, user } = await signedInAgent();
    for (let i = 0; i < 3; i++) await make(agent, { title: `t${i}` });
    await Task.init();
    const plan = await Task.find({ owner: user.id }).sort({ createdAt: -1, _id: -1 }).limit(10).explain('queryPlanner');
    expect(winningPlan(plan)).not.toContain('"stage":"SORT"');
  });
});

describe('issue and re-work columns', () => {
  it('accepts the two extra statuses on create, update and move', async () => {
    const { agent } = await signedInAgent();
    const a = await make(agent, { title: 'a', status: 'issue' });
    const b = await make(agent, { title: 'b' });
    expect(a.status).toBe('issue');

    expect((await agent.patch(`/api/tasks/${b.id}`).send({ status: 'rework' })).body.task.status).toBe('rework');
    expect((await move(agent, a.id, 'rework', b.id)).body.task.status).toBe('rework');
    expect(await column(agent, 'rework')).toEqual(['b', 'a']);
    expect(await column(agent, 'issue')).toEqual([]);
  });

  it('only "done" counts as finished: issue and re-work cards stay open and can be overdue', async () => {
    const { agent } = await signedInAgent();
    const a = await make(agent, { title: 'a', status: 'rework', dueDate: '2026-11-01' });
    expect(a.completedAt ?? null).toBeNull();
    const stats = (await agent.get('/api/tasks/stats?today=2026-11-20')).body;
    expect(stats).toMatchObject({ byStatus: { rework: 1, issue: 0 }, total: 1, overdue: 1 });
  });

  it('sends a task through the whole flow and sets completedAt only at the end', async () => {
    const { agent } = await signedInAgent();
    const t = await make(agent, { title: 'flow' });
    for (const status of ['in_progress', 'issue', 'rework']) {
      expect((await move(agent, t.id, status, null)).body.task.completedAt).toBeNull();
    }
    expect((await move(agent, t.id, 'done', null)).body.task.completedAt).not.toBeNull();
  });
});
