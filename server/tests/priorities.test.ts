import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, signedInAgent, startDb, stopDb } from './helpers.js';
import { Priority } from '../src/modules/priorities/priority.model.js';

beforeAll(startDb);
beforeEach(async () => {
  await resetDb();
  await Priority.deleteMany({});
});
afterAll(stopDb);

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];
type Prio = { id: string; key: string; name: string; color: string };

const list = async (agent: Agent) => (await agent.get('/api/priorities')).body.priorities as Prio[];
const keys = async (agent: Agent) => (await list(agent)).map((p) => p.key);
const add = (agent: Agent, name: string, color = '#7a3cff') => agent.post('/api/priorities').send({ name, color });
const task = async (agent: Agent, body: Record<string, unknown>) => (await agent.post('/api/tasks').send(body)).body.task as { id: string; title: string; priority: string };
const order = async (agent: Agent, sort = 'priority', dir = 'desc') =>
  ((await agent.get(`/api/tasks?sort=${sort}&order=${dir}&limit=50`)).body.items as { title: string }[]).map((t) => t.title);

describe('priorities', () => {
  it('start with Low, Medium and High, each with a colour, created on first use', async () => {
    const { agent } = await signedInAgent();
    const p = await list(agent);
    expect(p.map((x) => [x.key, x.name])).toEqual([['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]);
    expect(p.every((x) => /^#[0-9a-f]{6}$/.test(x.color))).toBe(true);
  });

  it('can be added with any name and colour, as many as the limit allows', async () => {
    const { agent } = await signedInAgent();
    const res = await add(agent, 'Blocker!', '#FF00AA');
    expect(res.status).toBe(201);
    expect((res.body.priorities as Prio[]).at(-1)).toMatchObject({ name: 'Blocker!', key: 'blocker', color: '#ff00aa' });
    for (let i = 0; i < 8; i++) expect((await add(agent, `Extra ${i}`)).status).toBe(201);
    const over = await add(agent, 'One too many');
    expect(over.status).toBe(400);
    expect(over.body.error.message).toMatch(/at most 12/);
  });

  it('validate the name and the colour, and refuse a duplicate name in any case', async () => {
    const { agent } = await signedInAgent();
    expect((await add(agent, '   ')).status).toBe(400);
    expect((await add(agent, 'x'.repeat(25))).status).toBe(400);
    expect((await add(agent, 'Fine', 'red')).status).toBe(400);
    expect((await add(agent, 'Fine', '#12345')).status).toBe(400);
    expect((await add(agent, 'Fine', 'javascript:alert(1)')).status).toBe(400);
    expect((await add(agent, 'HIGH')).status).toBe(409);
  });

  it('can be renamed and recoloured without losing the tasks that use them', async () => {
    const { agent } = await signedInAgent();
    const t = await task(agent, { title: 'a', priority: 'high' });
    const high = (await list(agent)).find((p) => p.key === 'high')!;
    const res = await agent.patch(`/api/priorities/${high.id}`).send({ name: 'Critical', color: '#000000' });
    expect((res.body.priorities as Prio[]).find((p) => p.key === 'high')).toMatchObject({ name: 'Critical', color: '#000000' });
    expect((await agent.get(`/api/tasks/${t.id}`)).body.task.priority).toBe('high');
  });

  it('give new tasks Medium by default, or the middle one if Medium is gone', async () => {
    const { agent } = await signedInAgent();
    expect((await task(agent, { title: 'a' })).priority).toBe('medium');
    const medium = (await list(agent)).find((p) => p.key === 'medium')!;
    await agent.delete(`/api/priorities/${medium.id}?moveTo=high`);
    expect((await task(agent, { title: 'b' })).priority).toBe('high'); // [low, high]: the middle is index 1
  });

  it('are used by tasks, and a task with an unknown priority is refused (create and update)', async () => {
    const { agent } = await signedInAgent();
    await add(agent, 'Urgent');
    const t = await task(agent, { title: 'a', priority: 'urgent' });
    expect(t.priority).toBe('urgent');
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ priority: 'nope' })).status).toBe(400);
    expect((await agent.get('/api/tasks?priority=urgent')).body.total).toBe(1);
  });

  it('decide how "sort by priority" works: it follows the order the user gave them', async () => {
    const { agent } = await signedInAgent();
    await add(agent, 'Urgent');
    await task(agent, { title: 'low one', priority: 'low' });
    await task(agent, { title: 'high one', priority: 'high' });
    await task(agent, { title: 'urgent one', priority: 'urgent' });
    expect(await order(agent, 'priority', 'desc')).toEqual(['urgent one', 'high one', 'low one']);
    expect(await order(agent, 'priority', 'asc')).toEqual(['low one', 'high one', 'urgent one']);

    // Move "Urgent" to the very bottom (least important): the same tasks now sort differently.
    const urgent = (await list(agent)).find((p) => p.key === 'urgent')!;
    await agent.post(`/api/priorities/${urgent.id}/move`).send({ afterId: null });
    expect(await keys(agent)).toEqual(['urgent', 'low', 'medium', 'high']);
    expect(await order(agent, 'priority', 'desc')).toEqual(['high one', 'low one', 'urgent one']);
  });

  it('survive many reorders into the same gap (forces a renumber)', async () => {
    const { agent } = await signedInAgent();
    await add(agent, 'Last');
    const first = (await list(agent))[0]!;
    for (let i = 0; i < 40; i++) {
      const last = (await list(agent)).at(-1)!;
      await agent.post(`/api/priorities/${last.id}/move`).send({ afterId: first.id });
    }
    const positions = (await Priority.find({}).sort({ position: 1 }).lean()).map((p) => p.position);
    expect(new Set(positions).size).toBe(positions.length);
  }, 60000);

  it('refuse deletion while tasks use them, until you say where those tasks go', async () => {
    const { agent } = await signedInAgent();
    await task(agent, { title: 'a', priority: 'high' });
    await task(agent, { title: 'b', priority: 'high' });
    const high = (await list(agent)).find((p) => p.key === 'high')!;

    const refused = await agent.delete(`/api/priorities/${high.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toMatch(/2 tasks use this priority/);
    expect((await agent.delete(`/api/priorities/${high.id}?moveTo=high`)).status).toBe(400);
    expect((await agent.delete(`/api/priorities/${high.id}?moveTo=ghost`)).status).toBe(400);

    expect((await agent.delete(`/api/priorities/${high.id}?moveTo=low`)).status).toBe(200);
    expect((await agent.get('/api/tasks?priority=low')).body.total).toBe(2);
    expect(await keys(agent)).toEqual(['low', 'medium']);
  });

  it('never remove the last one', async () => {
    const { agent } = await signedInAgent();
    let rows = await list(agent);
    while (rows.length > 1) rows = (await agent.delete(`/api/priorities/${rows[0]!.id}`)).body.priorities as Prio[];
    expect((await agent.delete(`/api/priorities/${rows[0]!.id}`)).status).toBe(400);
  });

  it('belong to one user: another user gets 404 and never sees them', async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    await add(alice.agent, 'Alice only');
    expect((await list(bob.agent)).map((p) => p.name)).not.toContain('Alice only');
    const row = (await list(alice.agent)).find((p) => p.name === 'Alice only')!;
    expect((await bob.agent.patch(`/api/priorities/${row.id}`).send({ name: 'hacked' })).status).toBe(404);
    expect((await bob.agent.delete(`/api/priorities/${row.id}`)).status).toBe(404);
    expect((await bob.agent.post('/api/tasks').send({ title: 'x', priority: 'alice_only' })).status).toBe(400);
  });

  it('are cached, and every change invalidates the cache', async () => {
    const { agent } = await signedInAgent();
    await list(agent);
    expect((await agent.get('/api/priorities')).headers['x-cache']).toBe('HIT');
    // The write refills the cache with the fresh list while answering, so the next read is a hit that already has the change.
    const created = await add(agent, 'New one');
    expect(created.headers['x-cache']).toBe('MISS');
    const after = await agent.get('/api/priorities');
    expect(after.headers['x-cache']).toBe('HIT');
    expect((after.body.priorities as Prio[]).map((p) => p.name)).toContain('New one');
  });
});

describe('column colours', () => {
  it('can be set when adding a column, changed, cleared, and are validated', async () => {
    const { agent } = await signedInAgent();
    const created = await agent.post('/api/columns').send({ name: 'Review', color: '#8270DB' });
    const review = (created.body.columns as { id: string; key: string; color: string | null }[]).find((c) => c.key === 'review')!;
    expect(review.color).toBe('#8270db');

    const changed = await agent.patch(`/api/columns/${review.id}`).send({ color: '#00aa00' });
    expect((changed.body.columns as { key: string; color: string }[]).find((c) => c.key === 'review')!.color).toBe('#00aa00');
    const cleared = await agent.patch(`/api/columns/${review.id}`).send({ color: null });
    expect((cleared.body.columns as { key: string; color: string | null }[]).find((c) => c.key === 'review')!.color).toBeNull();

    expect((await agent.patch(`/api/columns/${review.id}`).send({ color: 'blue' })).status).toBe(400);
    expect((await agent.post('/api/columns').send({ name: 'Bad', color: '#12' })).status).toBe(400);
  });

  it('default columns have no colour of their own', async () => {
    const { agent } = await signedInAgent();
    expect(((await agent.get('/api/columns')).body.columns as { color: string | null }[]).every((c) => c.color === null)).toBe(true);
  });
});
