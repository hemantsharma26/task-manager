import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, resetDb, signedInAgent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
beforeEach(resetDb);
afterAll(stopDb);

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];

const make = async (agent: Agent, body: Record<string, unknown>) => {
  const res = await agent.post('/api/tasks').send(body);
  expect(res.status).toBe(201);
  return res.body.task as { id: string; [k: string]: unknown };
};

describe('task CRUD', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/tasks')).status).toBe(401);
    expect((await request(app).post('/api/tasks').send({ title: 'x' })).status).toBe(401);
  });

  it('creates a task with sensible defaults', async () => {
    const { agent } = await signedInAgent();
    const task = await make(agent, { title: '  Write the report  ' });
    expect(task).toMatchObject({ title: 'Write the report', status: 'todo', priority: 'medium', dueDate: null, description: '' });
    expect(task.completedAt).toBeNull();
  });

  it('validates input', async () => {
    const { agent } = await signedInAgent();
    const bad = await agent.post('/api/tasks').send({ title: '', dueDate: '2026-02-31' });
    expect(bad.status).toBe(400);
    const fields = bad.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['dueDate', 'title']);
  });

  it('refuses a priority the user does not have', async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post('/api/tasks').send({ title: 'x', priority: 'urgent' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/no priority "urgent"/);
  });

  it('updates fields and keeps completedAt in step with status', async () => {
    const { agent } = await signedInAgent();
    const task = await make(agent, { title: 'Ship it' });

    const done = await agent.patch(`/api/tasks/${task.id}`).send({ status: 'done' });
    expect(done.status).toBe(200);
    expect(done.body.task.status).toBe('done');
    expect(done.body.task.completedAt).not.toBeNull();

    const reopened = await agent.patch(`/api/tasks/${task.id}`).send({ status: 'in_progress', title: 'Ship it today' });
    expect(reopened.body.task).toMatchObject({ status: 'in_progress', title: 'Ship it today', completedAt: null });
  });

  it('can clear a due date and rejects an empty patch', async () => {
    const { agent } = await signedInAgent();
    const task = await make(agent, { title: 'Dated', dueDate: '2026-12-01' });
    const cleared = await agent.patch(`/api/tasks/${task.id}`).send({ dueDate: null });
    expect(cleared.body.task.dueDate).toBeNull();
    expect((await agent.patch(`/api/tasks/${task.id}`).send({})).status).toBe(400);
  });

  it('deletes a task and then 404s', async () => {
    const { agent } = await signedInAgent();
    const task = await make(agent, { title: 'Temp' });
    expect((await agent.delete(`/api/tasks/${task.id}`)).status).toBe(204);
    expect((await agent.get(`/api/tasks/${task.id}`)).status).toBe(404);
    expect((await agent.delete(`/api/tasks/${task.id}`)).status).toBe(404);
  });

  it('treats a malformed id as not found rather than a server error', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.get('/api/tasks/not-an-id')).status).toBe(404);
  });
});

describe('ownership', () => {
  it("never exposes or lets you change another user's tasks", async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const task = await make(alice.agent, { title: "Alice's secret" });

    expect((await bob.agent.get(`/api/tasks/${task.id}`)).status).toBe(404);
    expect((await bob.agent.patch(`/api/tasks/${task.id}`).send({ title: 'hacked' })).status).toBe(404);
    expect((await bob.agent.delete(`/api/tasks/${task.id}`)).status).toBe(404);
    expect((await bob.agent.get('/api/tasks')).body.total).toBe(0);

    const still = await alice.agent.get(`/api/tasks/${task.id}`);
    expect(still.body.task.title).toBe("Alice's secret");
  });
});

describe('listing', () => {
  it('filters by status, priority and search text', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'Pay rent', priority: 'high' });
    await make(agent, { title: 'Buy milk', description: 'and eggs', status: 'done' });
    await make(agent, { title: 'Plan trip', priority: 'high', status: 'in_progress' });

    expect((await agent.get('/api/tasks?status=done')).body.items.map((t: { title: string }) => t.title)).toEqual(['Buy milk']);
    expect((await agent.get('/api/tasks?priority=high')).body.total).toBe(2);
    expect((await agent.get('/api/tasks?q=EGGS')).body.items).toHaveLength(1);
    // Regex characters in the search are literal, not an injection point.
    expect((await agent.get('/api/tasks?q=.*')).body.total).toBe(0);
  });

  it('paginates', async () => {
    const { agent } = await signedInAgent();
    for (let i = 1; i <= 5; i++) await make(agent, { title: `Task ${i}` });
    const page2 = await agent.get('/api/tasks?limit=2&page=2&sort=createdAt&order=asc');
    expect(page2.body).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(page2.body.items.map((t: { title: string }) => t.title)).toEqual(['Task 3', 'Task 4']);
  });

  it('sorts priority low < medium < high', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'm', priority: 'medium' });
    await make(agent, { title: 'h', priority: 'high' });
    await make(agent, { title: 'l', priority: 'low' });
    const desc = await agent.get('/api/tasks?sort=priority&order=desc');
    expect(desc.body.items.map((t: { priority: string }) => t.priority)).toEqual(['high', 'medium', 'low']);
    const asc = await agent.get('/api/tasks?sort=priority&order=asc');
    expect(asc.body.items.map((t: { priority: string }) => t.priority)).toEqual(['low', 'medium', 'high']);
  });

  it('sorts by due date with undated tasks last in both directions', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'none' });
    await make(agent, { title: 'later', dueDate: '2026-12-20' });
    await make(agent, { title: 'sooner', dueDate: '2026-12-01' });
    const titles = async (order: string) =>
      (await agent.get(`/api/tasks?sort=dueDate&order=${order}`)).body.items.map((t: { title: string }) => t.title);
    expect(await titles('asc')).toEqual(['sooner', 'later', 'none']);
    expect(await titles('desc')).toEqual(['later', 'sooner', 'none']);
  });

  it('sorts titles case-insensitively', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'banana' });
    await make(agent, { title: 'Apple' });
    await make(agent, { title: 'cherry' });
    const res = await agent.get('/api/tasks?sort=title&order=asc');
    expect(res.body.items.map((t: { title: string }) => t.title)).toEqual(['Apple', 'banana', 'cherry']);
  });

  it('applies due filters using the date the client sends', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'old', dueDate: '2026-11-10' });
    await make(agent, { title: 'old but done', dueDate: '2026-11-10', status: 'done' });
    await make(agent, { title: 'today', dueDate: '2026-11-20' });
    await make(agent, { title: 'in 3 days', dueDate: '2026-11-23' });
    await make(agent, { title: 'next month', dueDate: '2026-12-25' });
    await make(agent, { title: 'undated' });

    const titles = async (qs: string) =>
      (await agent.get(`/api/tasks?${qs}&today=2026-11-20&sort=title&order=asc`)).body.items.map((t: { title: string }) => t.title);

    expect(await titles('due=overdue')).toEqual(['old']);
    expect(await titles('due=today')).toEqual(['today']);
    expect(await titles('due=week')).toEqual(['in 3 days', 'today']);
    expect(await titles('due=none')).toEqual(['undated']);
  });

  it('reports stats including overdue', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'a', dueDate: '2026-11-01' });
    await make(agent, { title: 'b', status: 'in_progress' });
    await make(agent, { title: 'c', status: 'done', dueDate: '2026-11-01' });
    const res = await agent.get('/api/tasks/stats?today=2026-11-20');
    expect(res.body).toEqual({ byStatus: { todo: 1, in_progress: 1, issue: 0, rework: 0, done: 1 }, total: 3, overdue: 1 });
  });

  it('rejects bad query params instead of ignoring them', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.get('/api/tasks?limit=1000')).status).toBe(400);
    expect((await agent.get('/api/tasks?sort=password')).status).toBe(400);
    expect((await agent.get('/api/tasks?today=yesterday')).status).toBe(400);
  });
});

describe('misc', () => {
  it('answers health checks and unknown API routes in the standard error shape', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('answers malformed JSON with 400, not 500', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
  });
});
