import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb, signedInAgent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
beforeEach(resetDb);
afterAll(stopDb);

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];
const make = async (agent: Agent, body: Record<string, unknown>) => (await agent.post('/api/tasks').send(body)).body.task as { id: string; dueDate: string | null; dueTime: string | null };

describe('due time', () => {
  it('is saved with the date and returned as HH:MM', async () => {
    const { agent } = await signedInAgent();
    const t = await make(agent, { title: 'a', dueDate: '2026-11-20', dueTime: '17:30' });
    expect(t).toMatchObject({ dueDate: '2026-11-20', dueTime: '17:30' });
    expect((await agent.get(`/api/tasks/${t.id}`)).body.task.dueTime).toBe('17:30');
  });

  it.each(['24:00', '9:30', '12:60', '12:5', 'noon', '12:30:00', ''])('refuses the time "%s"', async (time) => {
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').send({ title: 'a', dueDate: '2026-11-20', dueTime: time })).status).toBe(400);
  });

  it('refuses a time without a date, on create and on update', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').send({ title: 'a', dueTime: '10:00' })).status).toBe(400);
    const t = await make(agent, { title: 'b' });
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ dueTime: '10:00' })).status).toBe(400);
  });

  it('can be changed or cleared on its own, and clearing the date clears the time too', async () => {
    const { agent } = await signedInAgent();
    const t = await make(agent, { title: 'a', dueDate: '2026-11-20', dueTime: '17:30' });
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ dueTime: '08:15' })).body.task.dueTime).toBe('08:15');
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ dueTime: null })).body.task).toMatchObject({ dueDate: '2026-11-20', dueTime: null });
    await agent.patch(`/api/tasks/${t.id}`).send({ dueTime: '08:15' });
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ dueDate: null })).body.task).toMatchObject({ dueDate: null, dueTime: null });
  });

  it('keeps the time when only the date is moved', async () => {
    const { agent } = await signedInAgent();
    const t = await make(agent, { title: 'a', dueDate: '2026-11-20', dueTime: '17:30' });
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ dueDate: '2026-11-25' })).body.task).toMatchObject({ dueDate: '2026-11-25', dueTime: '17:30' });
  });
});

describe('overdue, with the time of day', () => {
  const titles = async (agent: Agent, qs: string) => ((await agent.get(`/api/tasks?due=overdue&sort=title&order=asc&${qs}`)).body.items as { title: string }[]).map((t) => t.title);

  it('counts a task due today as overdue once its time has passed, and not before', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'morning', dueDate: '2026-11-20', dueTime: '09:00' });
    await make(agent, { title: 'evening', dueDate: '2026-11-20', dueTime: '18:00' });
    await make(agent, { title: 'no time', dueDate: '2026-11-20' });
    await make(agent, { title: 'yesterday', dueDate: '2026-11-19', dueTime: '23:59' });
    await make(agent, { title: 'tomorrow', dueDate: '2026-11-21', dueTime: '00:01' });

    expect(await titles(agent, 'today=2026-11-20&nowTime=08:00')).toEqual(['yesterday']);
    expect(await titles(agent, 'today=2026-11-20&nowTime=09:00')).toEqual(['yesterday']); // exactly on time is not late yet
    expect(await titles(agent, 'today=2026-11-20&nowTime=09:01')).toEqual(['morning', 'yesterday']);
    expect(await titles(agent, 'today=2026-11-20&nowTime=18:30')).toEqual(['evening', 'morning', 'yesterday']);
    // without the client's time, only whole days count (the earlier behaviour)
    expect(await titles(agent, 'today=2026-11-20')).toEqual(['yesterday']);
  });

  it('never calls a finished task overdue', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'done late', status: 'done', dueDate: '2026-11-20', dueTime: '01:00' });
    expect(await titles(agent, 'today=2026-11-20&nowTime=23:00')).toEqual([]);
  });

  it('uses the same rule for the overdue count', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'a', dueDate: '2026-11-20', dueTime: '09:00' });
    await make(agent, { title: 'b', dueDate: '2026-11-19' });
    expect((await agent.get('/api/tasks/stats?today=2026-11-20&nowTime=08:00')).body.overdue).toBe(1);
    expect((await agent.get('/api/tasks/stats?today=2026-11-20&nowTime=10:00')).body.overdue).toBe(2);
  });

  it('combines with search: the search and the overdue rule must both hold', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'pay rent', dueDate: '2026-11-19' });
    await make(agent, { title: 'call mom', dueDate: '2026-11-19' });
    expect(await titles(agent, 'today=2026-11-20&q=rent')).toEqual(['pay rent']);
  });

  it('refuses a malformed nowTime', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.get('/api/tasks?due=overdue&nowTime=25:00')).status).toBe(400);
  });
});
