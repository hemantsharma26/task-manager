import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Column } from '../src/models/Column.js';
import { Task } from '../src/models/Task.js';
import { resetDb, signedInAgent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
beforeEach(async () => {
  await resetDb();
  await Column.deleteMany({});
});
afterAll(stopDb);

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];
type Col = { id: string; key: string; name: string; isDone: boolean };

const list = async (agent: Agent) => (await agent.get('/api/columns')).body.columns as Col[];
const names = async (agent: Agent) => (await list(agent)).map((c) => c.name);
const add = (agent: Agent, name: string, isDone = false) => agent.post('/api/columns').send({ name, isDone });
const task = async (agent: Agent, body: Record<string, unknown>) => (await agent.post('/api/tasks').send(body)).body.task as { id: string; status: string; completedAt: string | null };

describe('columns', () => {
  it('start with the default five, in order, created on first use', async () => {
    const { agent } = await signedInAgent();
    expect(await names(agent)).toEqual(['To do', 'In progress', 'Issue', 'Re-work', 'Done']);
    expect((await list(agent)).map((c) => c.isDone)).toEqual([false, false, false, false, true]);
  });

  it('do not create the defaults twice when two requests race', async () => {
    const { agent } = await signedInAgent();
    await Promise.all([list(agent), list(agent), agent.get('/api/tasks'), agent.get('/api/tasks/stats')]);
    expect(await names(agent)).toHaveLength(5);
  });

  it('can be added, get a stable key, and show up at the end', async () => {
    const { agent } = await signedInAgent();
    const res = await add(agent, 'QA review!');
    expect(res.status).toBe(201);
    const cols = res.body.columns as Col[];
    expect(cols.at(-1)).toMatchObject({ name: 'QA review!', key: 'qa_review', isDone: false });
  });

  it('reject a duplicate name (any case) and more than the maximum', async () => {
    const { agent } = await signedInAgent();
    expect((await add(agent, 'done')).status).toBe(409);
    for (let i = 0; i < 7; i++) expect((await add(agent, `Extra ${i}`)).status).toBe(201);
    const over = await add(agent, 'One too many');
    expect(over.status).toBe(400);
    expect(over.body.error.message).toMatch(/at most 12/);
  });

  it('validate the name', async () => {
    const { agent } = await signedInAgent();
    expect((await add(agent, '   ')).status).toBe(400);
    expect((await add(agent, 'x'.repeat(31))).status).toBe(400);
  });

  it('give a re-created name a fresh key if the old one is still taken', async () => {
    const { agent } = await signedInAgent();
    await add(agent, 'Blocked');
    await agent.patch(`/api/columns/${(await list(agent)).find((c) => c.name === 'Blocked')!.id}`).send({ name: 'Waiting' });
    const res = await add(agent, 'Blocked');
    expect((res.body.columns as Col[]).map((c) => c.key)).toContain('blocked_2');
  });

  it('keep their tasks when renamed, because tasks point at the key', async () => {
    const { agent } = await signedInAgent();
    await add(agent, 'Review');
    const t = await task(agent, { title: 'a', status: 'review' });
    const col = (await list(agent)).find((c) => c.key === 'review')!;
    await agent.patch(`/api/columns/${col.id}`).send({ name: 'Code review' });
    expect((await agent.get(`/api/tasks/${t.id}`)).body.task.status).toBe('review');
    expect(await names(agent)).toContain('Code review');
  });

  it('let tasks be created, moved and counted in a custom column', async () => {
    const { agent } = await signedInAgent();
    await add(agent, 'Review');
    const a = await task(agent, { title: 'a', status: 'review' });
    expect(a.status).toBe('review');
    const stats = (await agent.get('/api/tasks/stats')).body;
    expect(stats.byStatus.review).toBe(1);
    const moved = await agent.post(`/api/tasks/${a.id}/move`).send({ status: 'todo', afterId: null });
    expect(moved.body.task.status).toBe('todo');
  });

  it('refuse a task for a column that does not exist', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').send({ title: 'x', status: 'nope' })).status).toBe(400);
  });

  it('treat a custom "done" column as finished: completedAt set, never overdue', async () => {
    const { agent } = await signedInAgent();
    await add(agent, 'Shipped', true);
    const t = await task(agent, { title: 'old', status: 'shipped', dueDate: '2026-01-01' });
    expect(t.completedAt).not.toBeNull();
    const stats = (await agent.get('/api/tasks/stats?today=2026-11-20')).body;
    expect(stats.overdue).toBe(0);
    const overdueList = await agent.get('/api/tasks?due=overdue&today=2026-11-20');
    expect(overdueList.body.total).toBe(0);
  });

  it('finish or reopen the tasks already in a column when its "done" flag is toggled', async () => {
    const { agent } = await signedInAgent();
    await add(agent, 'Review');
    const t = await task(agent, { title: 'a', status: 'review' });
    const col = (await list(agent)).find((c) => c.key === 'review')!;

    await agent.patch(`/api/columns/${col.id}`).send({ isDone: true });
    expect((await agent.get(`/api/tasks/${t.id}`)).body.task.completedAt).not.toBeNull();

    await agent.patch(`/api/columns/${col.id}`).send({ isDone: false });
    expect((await agent.get(`/api/tasks/${t.id}`)).body.task.completedAt).toBeNull();
  });

  it('can be reordered, and the order is kept', async () => {
    const { agent } = await signedInAgent();
    const cols = await list(agent);
    const done = cols.find((c) => c.key === 'done')!;
    const res = await agent.post(`/api/columns/${done.id}/move`).send({ afterId: null });
    expect((res.body.columns as Col[]).map((c) => c.key)).toEqual(['done', 'todo', 'in_progress', 'issue', 'rework']);
    const again = await agent.post(`/api/columns/${done.id}/move`).send({ afterId: cols.find((c) => c.key === 'issue')!.id });
    expect((again.body.columns as Col[]).map((c) => c.key)).toEqual(['todo', 'in_progress', 'issue', 'done', 'rework']);
  });

  it('survive many reorders into the same gap (forces a renumber)', async () => {
    const { agent } = await signedInAgent();
    await add(agent, 'A');
    const first = (await list(agent))[0]!;
    for (let i = 0; i < 40; i++) {
      const cols = await list(agent);
      const last = cols.at(-1)!;
      await agent.post(`/api/columns/${last.id}/move`).send({ afterId: first.id });
    }
    expect(await list(agent)).toHaveLength(6);
    const positions = (await Column.find({}).sort({ position: 1 }).lean()).map((c) => c.position);
    expect(new Set(positions).size).toBe(positions.length);
  }, 60000);
});

describe('deleting a column', () => {
  it('works straight away when it is empty', async () => {
    const { agent } = await signedInAgent();
    const issue = (await list(agent)).find((c) => c.key === 'issue')!;
    const res = await agent.delete(`/api/columns/${issue.id}`);
    expect(res.status).toBe(200);
    expect((res.body.columns as Col[]).map((c) => c.key)).not.toContain('issue');
  });

  it('refuses while it holds tasks, until you say where they go', async () => {
    const { agent } = await signedInAgent();
    await task(agent, { title: 'a', status: 'issue' });
    const issue = (await list(agent)).find((c) => c.key === 'issue')!;
    const refused = await agent.delete(`/api/columns/${issue.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toMatch(/1 task/);
    expect(await names(agent)).toContain('Issue');
  });

  it('moves the tasks, in order, below the target column\'s own tasks, and finishes them if the target is done', async () => {
    const { agent } = await signedInAgent();
    await task(agent, { title: 'already done', status: 'done' });
    await task(agent, { title: 'i1', status: 'issue' });
    await task(agent, { title: 'i2', status: 'issue' });
    const issue = (await list(agent)).find((c) => c.key === 'issue')!;

    const res = await agent.delete(`/api/columns/${issue.id}?moveTo=done`);
    expect(res.status).toBe(200);

    const done = (await agent.get('/api/tasks?status=done&sort=rank&order=asc')).body.items as { title: string; completedAt: string | null }[];
    expect(done.map((t) => t.title)).toEqual(['already done', 'i1', 'i2']);
    expect(done.every((t) => t.completedAt)).toBe(true);
    expect(await Task.countDocuments({ status: 'issue' })).toBe(0);
  });

  it('rejects moving tasks into the column being deleted or into a column that does not exist', async () => {
    const { agent } = await signedInAgent();
    await task(agent, { title: 'a', status: 'issue' });
    const issue = (await list(agent)).find((c) => c.key === 'issue')!;
    expect((await agent.delete(`/api/columns/${issue.id}?moveTo=issue`)).status).toBe(400);
    expect((await agent.delete(`/api/columns/${issue.id}?moveTo=ghost`)).status).toBe(400);
  });

  it('never removes the last column', async () => {
    const { agent } = await signedInAgent();
    let cols = await list(agent);
    while (cols.length > 1) {
      cols = ((await agent.delete(`/api/columns/${cols[0]!.id}`)).body.columns as Col[]);
    }
    expect((await agent.delete(`/api/columns/${cols[0]!.id}`)).status).toBe(400);
  });
});

describe('column ownership', () => {
  it('keeps each user\'s columns separate and hides other users\' ids behind a 404', async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    await add(alice.agent, 'Alice only');
    expect(await names(bob.agent)).not.toContain('Alice only');

    const aliceCol = (await list(alice.agent)).find((c) => c.name === 'Alice only')!;
    expect((await bob.agent.patch(`/api/columns/${aliceCol.id}`).send({ name: 'hacked' })).status).toBe(404);
    expect((await bob.agent.delete(`/api/columns/${aliceCol.id}`)).status).toBe(404);
    expect((await bob.agent.post(`/api/columns/${aliceCol.id}/move`).send({ afterId: null })).status).toBe(404);
    expect((await bob.agent.post('/api/tasks').send({ title: 'x', status: 'alice_only' })).status).toBe(400);
  });

  it('requires a session', async () => {
    const { agent } = await signedInAgent();
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/columns')).status).toBe(401);
  });
});
