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

describe('time window (start and end on the due date)', () => {
  const win = async (agent: Agent, body: Record<string, unknown>) => agent.post('/api/tasks').send({ title: 'w', dueDate: '2026-11-20', ...body });

  it('saves a start and an end, and returns both', async () => {
    const { agent } = await signedInAgent();
    const res = await win(agent, { startTime: '09:00', dueTime: '11:30' });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({ dueDate: '2026-11-20', startTime: '09:00', dueTime: '11:30' });
  });

  it('refuses a start without an end, an end that is not after the start, and a malformed start', async () => {
    const { agent } = await signedInAgent();
    expect((await win(agent, { startTime: '09:00' })).status).toBe(400);
    expect((await win(agent, { startTime: '11:00', dueTime: '11:00' })).status).toBe(400);
    expect((await win(agent, { startTime: '12:00', dueTime: '09:00' })).status).toBe(400);
    expect((await win(agent, { startTime: '9am', dueTime: '10:00' })).status).toBe(400);
    expect((await win(agent, { startTime: '09:00', dueTime: '09:01' })).status).toBe(201);
  });

  it('keeps the window valid when only one end of it is changed', async () => {
    const { agent } = await signedInAgent();
    const t = (await win(agent, { startTime: '09:00', dueTime: '11:00' })).body.task as { id: string };
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ dueTime: '08:00' })).status).toBe(400); // end before the existing start
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ startTime: '11:30' })).status).toBe(400); // start after the existing end
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ dueTime: '13:00' })).body.task).toMatchObject({ startTime: '09:00', dueTime: '13:00' });
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ startTime: '10:00', dueTime: '10:30' })).body.task).toMatchObject({ startTime: '10:00', dueTime: '10:30' });
  });

  it('drops the start when the end is removed, and both when the date is removed', async () => {
    const { agent } = await signedInAgent();
    const a = (await win(agent, { startTime: '09:00', dueTime: '11:00' })).body.task as { id: string };
    expect((await agent.patch(`/api/tasks/${a.id}`).send({ dueTime: null })).body.task).toMatchObject({ startTime: null, dueTime: null, dueDate: '2026-11-20' });
    const b = (await win(agent, { startTime: '09:00', dueTime: '11:00' })).body.task as { id: string };
    expect((await agent.patch(`/api/tasks/${b.id}`).send({ dueDate: null })).body.task).toMatchObject({ startTime: null, dueTime: null, dueDate: null });
  });

  it('can set only the start of an existing deadline, and clear just the start', async () => {
    const { agent } = await signedInAgent();
    const t = (await win(agent, { dueTime: '11:00' })).body.task as { id: string };
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ startTime: '10:00' })).body.task.startTime).toBe('10:00');
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ startTime: null })).body.task).toMatchObject({ startTime: null, dueTime: '11:00' });
  });

  it('is overdue once the END of the window has passed, not the start', async () => {
    const { agent } = await signedInAgent();
    await agent.post('/api/tasks').send({ title: 'window', dueDate: '2026-11-20', startTime: '09:00', dueTime: '11:00' });
    const overdue = async (now: string) => (await agent.get(`/api/tasks?due=overdue&today=2026-11-20&nowTime=${now}`)).body.total;
    expect(await overdue('09:30')).toBe(0); // in the middle of the window
    expect(await overdue('11:00')).toBe(0); // exactly at the end
    expect(await overdue('11:01')).toBe(1); // past the end: red
  });

  it('puts the tasks of one day in time order, and tasks without a time last', async () => {
    const { agent } = await signedInAgent();
    const add = (title: string, extra: Record<string, unknown>) => agent.post('/api/tasks').send({ title, dueDate: '2026-11-20', ...extra });
    await add('afternoon', { startTime: '14:00', dueTime: '15:00' });
    await add('no time', {});
    await add('deadline only 10', { dueTime: '10:00' });
    await add('early', { startTime: '08:00', dueTime: '09:00' });
    await agent.post('/api/tasks').send({ title: 'next day', dueDate: '2026-11-21', startTime: '07:00', dueTime: '08:00' });
    const order = async (dir: string) => ((await agent.get(`/api/tasks?sort=dueDate&order=${dir}`)).body.items as { title: string }[]).map((t) => t.title);
    expect(await order('asc')).toEqual(['early', 'deadline only 10', 'afternoon', 'no time', 'next day']);
    expect(await order('desc')).toEqual(['next day', 'afternoon', 'deadline only 10', 'early', 'no time']);
  });
});
