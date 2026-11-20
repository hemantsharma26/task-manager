import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Task } from '../src/modules/tasks/task.model.js';
import { resetDb, signedInAgent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
beforeEach(resetDb);
afterAll(stopDb);

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];
const make = async (agent: Agent, body: Record<string, unknown>) => (await agent.post('/api/tasks').send(body)).body.task as { id: string; description: string; color: string | null };

describe('task notes', () => {
  it('stores a cleaned note, never what the client sent', async () => {
    const { agent } = await signedInAgent();
    const t = await make(agent, { title: 'a', description: '<p>Hi <strong>there</strong></p><script>alert(1)</script><img src=x onerror=alert(1)>' });
    expect(t.description).toBe('<p>Hi <strong>there</strong></p>');
    expect((await Task.findById(t.id).lean())!.description).toBe('<p>Hi <strong>there</strong></p>');
  });

  it('cleans on update too', async () => {
    const { agent } = await signedInAgent();
    const t = await make(agent, { title: 'a' });
    const res = await agent.patch(`/api/tasks/${t.id}`).send({ description: '<p onclick="x()">ok</p><a href="javascript:alert(1)">bad</a>' });
    expect(res.body.task.description).not.toMatch(/onclick|javascript:/);
    expect(res.body.task.description).toContain('ok');
  });

  it('shows older plain-text descriptions as paragraphs, escaped', async () => {
    const { agent } = await signedInAgent();
    const t = await make(agent, { title: 'a' });
    await Task.updateOne({ _id: t.id }, { description: 'first line\n<b>second</b> & third', $unset: { descriptionText: 1 } });
    const got = (await agent.get(`/api/tasks/${t.id}`)).body.task;
    expect(got.description).toBe('<p>first line</p><p>&lt;b&gt;second&lt;/b&gt; &amp; third</p>');
  });

  it('searches the visible text of notes, not their markup', async () => {
    const { agent } = await signedInAgent();
    await make(agent, { title: 'one', description: '<p>Call the <strong>plumber</strong></p>' });
    await make(agent, { title: 'two', description: '<p style="color:#ff0000">nothing here</p>' });
    expect((await agent.get('/api/tasks?q=plumber')).body.total).toBe(1);
    expect((await agent.get('/api/tasks?q=strong')).body.total).toBe(0);
    expect((await agent.get('/api/tasks?q=color')).body.total).toBe(0);
  });

  it('still finds older tasks (without a text field) by their plain description', async () => {
    const { agent } = await signedInAgent();
    const t = await make(agent, { title: 'legacy' });
    await Task.updateOne({ _id: t.id }, { description: 'remember the milk', $unset: { descriptionText: 1 } });
    expect((await agent.get('/api/tasks?q=milk')).body.total).toBe(1);
  });

  it('refuses a note that is too long, by visible text and by size', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').send({ title: 'a', description: `<p>${'x'.repeat(5001)}</p>` })).status).toBe(400);
    expect((await agent.post('/api/tasks').send({ title: 'a', description: 'y'.repeat(20_001) })).status).toBe(400);
    expect((await agent.post('/api/tasks').send({ title: 'a', description: `<p>${'x'.repeat(4000)}</p>` })).status).toBe(201);
  });
});

describe('task colour', () => {
  it('can be set on create, changed, cleared, and is validated', async () => {
    const { agent } = await signedInAgent();
    const t = await make(agent, { title: 'a', color: '#FF00AA' });
    expect(t.color).toBe('#ff00aa');
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ color: '#00aa00' })).body.task.color).toBe('#00aa00');
    expect((await agent.patch(`/api/tasks/${t.id}`).send({ color: null })).body.task.color).toBeNull();
    for (const bad of ['red', '#12', 'url(x)', '#gggggg', 'javascript:alert(1)']) {
      expect((await agent.patch(`/api/tasks/${t.id}`).send({ color: bad })).status, bad).toBe(400);
    }
  });

  it('defaults to no colour', async () => {
    const { agent } = await signedInAgent();
    expect((await make(agent, { title: 'a' })).color).toBeNull();
  });
});
