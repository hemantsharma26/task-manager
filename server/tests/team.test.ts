import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { flushMail, useMailer, type Mailer, type OutgoingMail } from '../src/infra/mail/index.js';
import { Invitation } from '../src/modules/team/invitation.model.js';
import { app, resetDb, signedInAgent, startDb, stopDb } from './helpers.js';
import { PNG } from './samples.js';

type Agent = Awaited<ReturnType<typeof signedInAgent>>;

const outbox: OutgoingMail[] = [];
const capture: Mailer = { kind: 'capture', send: async (m) => void outbox.push(m), close: () => {} };

beforeAll(async () => {
  await startDb();
  useMailer(capture);
});
afterAll(stopDb);
beforeEach(async () => {
  await resetDb();
  outbox.length = 0;
});

const tokenIn = (mail: OutgoingMail) => /\/join\/([\w-]+)/.exec(mail.text)![1]!;

/** Owner invites someone by email; returns the secret token taken from the email (the only place it travels). */
async function invite(owner: Agent, email: string, role = 'editor') {
  const res = await owner.agent.post('/api/team/invitations').send({ email, role });
  expect(res.status).toBe(201);
  await flushMail();
  const mail = outbox.filter((m) => m.to === email).at(-1)!;
  return { res, token: tokenIn(mail), mail };
}

/** The whole happy path: invited, signed in as that person, accepted. */
async function joinAs(owner: Agent, role: string) {
  const member = await signedInAgent();
  const { token } = await invite(owner, member.user.email, role);
  const accepted = await member.agent.post(`/api/invitations/${token}/accept`);
  expect(accepted.status).toBe(200);
  return member;
}

const onBoard = (a: Agent, owner: Agent) => ({
  get: (url: string) => a.agent.get(url).set('X-Workspace-Id', owner.user.id),
  post: (url: string, body?: object) => a.agent.post(url).set('X-Workspace-Id', owner.user.id).send(body ?? {}),
  patch: (url: string, body: object) => a.agent.patch(url).set('X-Workspace-Id', owner.user.id).send(body),
  del: (url: string) => a.agent.delete(url).set('X-Workspace-Id', owner.user.id),
});

describe('invitations', () => {
  it('emails a private link, and never puts the token in the API response', async () => {
    const owner = await signedInAgent({ name: 'Asha Verma' });
    const { res, mail } = await invite(owner, 'sam@example.com');
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    expect(mail.subject).toContain('Asha Verma invited you');
    expect(mail.text).toMatch(/\/join\/[\w-]{40,}/);
  });

  it('lets anyone read what the link is for, without signing in, and nothing more', async () => {
    const owner = await signedInAgent({ name: 'Asha Verma' });
    const { token } = await invite(owner, 'sam@example.com', 'viewer');
    const info = await request(app).get(`/api/invitations/${token}`);
    expect(info.status).toBe(200);
    expect(info.body.invitation).toEqual({ boardName: "Asha Verma's tasks", invitedBy: 'Asha Verma', role: 'viewer', roleLabel: 'Viewer', email: 'sam@example.com' });
    expect((await request(app).get('/api/invitations/not-a-real-token')).status).toBe(404);
  });

  it('can only be accepted by the account it was sent to', async () => {
    const owner = await signedInAgent();
    const stranger = await signedInAgent();
    const { token } = await invite(owner, 'someone.else@example.com');
    const res = await stranger.agent.post(`/api/invitations/${token}/accept`);
    expect(res.status).toBe(403);
    expect((await stranger.agent.get('/api/workspaces')).body.shared).toHaveLength(0);
    // and it still works for the right person afterwards (the wrong attempt did not use it up)
    const right = await signedInAgent({ email: 'someone.else@example.com' });
    expect((await right.agent.post(`/api/invitations/${token}/accept`)).status).toBe(200);
  });

  it('needs a signed-in account to accept', async () => {
    const owner = await signedInAgent();
    const { token } = await invite(owner, 'sam@example.com');
    expect((await request(app).post(`/api/invitations/${token}/accept`)).status).toBe(401);
  });

  it('works once: the link is dead after it is used', async () => {
    const owner = await signedInAgent();
    const member = await signedInAgent();
    const { token } = await invite(owner, member.user.email);
    expect((await member.agent.post(`/api/invitations/${token}/accept`)).status).toBe(200);
    expect((await member.agent.post(`/api/invitations/${token}/accept`)).status).toBe(404);
    expect((await request(app).get(`/api/invitations/${token}`)).status).toBe(404);
  });

  it('expires', async () => {
    const owner = await signedInAgent();
    const member = await signedInAgent();
    const { token } = await invite(owner, member.user.email);
    await Invitation.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await member.agent.post(`/api/invitations/${token}/accept`)).status).toBe(404);
  });

  it('can be revoked by the owner', async () => {
    const owner = await signedInAgent();
    const member = await signedInAgent();
    const { token, res } = await invite(owner, member.user.email);
    expect((await owner.agent.delete(`/api/team/invitations/${res.body.invitation.id}`)).status).toBe(204);
    expect((await member.agent.post(`/api/invitations/${token}/accept`)).status).toBe(404);
    expect((await owner.agent.get('/api/team/invitations')).body.invitations).toHaveLength(0);
  });

  it('a newer invitation to the same address replaces the older link', async () => {
    const owner = await signedInAgent();
    const member = await signedInAgent();
    const first = await invite(owner, member.user.email, 'viewer');
    const second = await invite(owner, member.user.email, 'editor');
    expect((await member.agent.post(`/api/invitations/${first.token}/accept`)).status).toBe(404);
    expect((await member.agent.post(`/api/invitations/${second.token}/accept`)).status).toBe(200);
    expect((await owner.agent.get('/api/team/members')).body.members.find((m: { userId: string }) => m.userId === member.user.id).role).toBe('editor');
  });

  it('refuses inviting yourself, someone already on the team, a bad address or a bad role', async () => {
    const owner = await signedInAgent();
    expect((await owner.agent.post('/api/team/invitations').send({ email: owner.user.email, role: 'editor' })).status).toBe(400);
    const member = await joinAs(owner, 'editor');
    expect((await owner.agent.post('/api/team/invitations').send({ email: member.user.email, role: 'viewer' })).status).toBe(409);
    expect((await owner.agent.post('/api/team/invitations').send({ email: 'nope', role: 'viewer' })).status).toBe(400);
    expect((await owner.agent.post('/api/team/invitations').send({ email: 'a@example.com', role: 'owner' })).status).toBe(400);
  });
});

describe('who can see and do what', () => {
  it('shows the joined board in the list of boards', async () => {
    const owner = await signedInAgent({ name: 'Asha Verma' });
    const member = await joinAs(owner, 'editor');
    const res = await member.agent.get('/api/workspaces');
    expect(res.body.shared).toEqual([{ id: owner.user.id, name: "Asha Verma's tasks", role: 'editor' }]);
    expect(res.body.own.id).toBe(member.user.id);
  });

  it('keeps boards apart: with no header it is your own board, and an outsider cannot open someone else’s', async () => {
    const owner = await signedInAgent();
    const member = await joinAs(owner, 'editor');
    const outsider = await signedInAgent();
    await owner.agent.post('/api/tasks').send({ title: 'Owner only task' });

    expect((await member.agent.get('/api/tasks')).body.total).toBe(0);
    expect((await onBoard(member, owner).get('/api/tasks')).body.total).toBe(1);
    expect((await onBoard(outsider, owner).get('/api/tasks')).status).toBe(404);
    expect((await outsider.agent.get('/api/tasks').set('X-Workspace-Id', 'not-an-id')).status).toBe(404);
  });

  it('viewers can look, not touch', async () => {
    const owner = await signedInAgent();
    const viewer = await joinAs(owner, 'viewer');
    const task = (await owner.agent.post('/api/tasks').send({ title: 'T' })).body.task;
    const b = onBoard(viewer, owner);
    expect((await b.get('/api/tasks')).status).toBe(200);
    expect((await b.get('/api/columns')).status).toBe(200);
    expect((await b.post('/api/tasks', { title: 'x' })).status).toBe(403);
    expect((await b.patch(`/api/tasks/${task.id}`, { title: 'x' })).status).toBe(403);
    expect((await b.post(`/api/tasks/${task.id}/move`, { status: 'done' })).status).toBe(403);
    expect((await b.del(`/api/tasks/${task.id}`)).status).toBe(403);
    expect((await b.post('/api/columns', { name: 'Blocked' })).status).toBe(403);
    expect((await b.post('/api/team/invitations', { email: 'a@example.com', role: 'viewer' })).status).toBe(403);
  });

  it('editors work on tasks but cannot delete them or change the board or the team', async () => {
    const owner = await signedInAgent();
    const editor = await joinAs(owner, 'editor');
    const b = onBoard(editor, owner);
    const created = await b.post('/api/tasks', { title: 'From editor' });
    expect(created.status).toBe(201);
    const id = created.body.task.id;
    expect((await b.patch(`/api/tasks/${id}`, { title: 'Renamed' })).status).toBe(200);
    expect((await b.del(`/api/tasks/${id}`)).status).toBe(403);
    expect((await b.post('/api/priorities', { name: 'Urgent', color: '#ff0000' })).status).toBe(403);
    expect((await b.get('/api/team/invitations')).status).toBe(403);
    expect((await b.patch(`/api/team/members/${owner.user.id}`, { role: 'viewer' })).status).toBe(403);
  });

  it('admins can do everything on the board, including the team', async () => {
    const owner = await signedInAgent();
    const admin = await joinAs(owner, 'admin');
    const b = onBoard(admin, owner);
    const task = (await b.post('/api/tasks', { title: 'T' })).body.task;
    expect((await b.del(`/api/tasks/${task.id}`)).status).toBe(204);
    expect((await b.post('/api/columns', { name: 'Blocked' })).status).toBe(201);
    expect((await b.post('/api/team/invitations', { email: 'new@example.com', role: 'viewer' })).status).toBe(201);
  });

  it('files on a shared board are visible to everyone on it, and can only be added by people who may edit', async () => {
    const owner = await signedInAgent();
    const viewer = await joinAs(owner, 'viewer');
    const editor = await joinAs(owner, 'editor');
    const task = (await owner.agent.post('/api/tasks').send({ title: 'With file' })).body.task;

    expect((await onBoard(viewer, owner).post(`/api/tasks/${task.id}/attachments`)).status).toBe(403);
    const up = await editor.agent.post(`/api/tasks/${task.id}/attachments`).set('X-Workspace-Id', owner.user.id).attach('files', PNG, { filename: 'pic.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    const att = up.body.task.attachments[0];
    const download = await onBoard(viewer, owner).get(`/api/tasks/${task.id}/attachments/${att.id}`);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toBe('image/png');
    // <img> and <video> cannot send headers, so a GET may name the board in the URL instead
    expect((await viewer.agent.get(`/api/tasks/${task.id}/attachments/${att.id}?workspace=${owner.user.id}`)).status).toBe(200);
    expect((await viewer.agent.get(`/api/tasks/${task.id}/attachments/${att.id}`)).status).toBe(404);
  });
});

describe('members', () => {
  it('lists the owner first, then everyone who joined', async () => {
    const owner = await signedInAgent({ name: 'Asha Verma' });
    const member = await joinAs(owner, 'editor');
    const res = await member.agent.get('/api/team/members').set('X-Workspace-Id', owner.user.id);
    expect(res.body.members.map((m: { userId: string; role: string; isOwner: boolean }) => [m.userId, m.role, m.isOwner])).toEqual([
      [owner.user.id, 'owner', true],
      [member.user.id, 'editor', false],
    ]);
    expect(res.body.you).toMatchObject({ role: 'editor', canManage: false });
  });

  it('lets the owner change a role, and the new role applies at once', async () => {
    const owner = await signedInAgent();
    const member = await joinAs(owner, 'editor');
    const b = onBoard(member, owner);
    expect((await b.post('/api/tasks', { title: 'ok' })).status).toBe(201);
    expect((await owner.agent.patch(`/api/team/members/${member.user.id}`).send({ role: 'viewer' })).status).toBe(200);
    expect((await b.post('/api/tasks', { title: 'now refused' })).status).toBe(403);
  });

  it('removing someone cuts their access and takes them off every task', async () => {
    const owner = await signedInAgent();
    const member = await joinAs(owner, 'editor');
    const task = (await owner.agent.post('/api/tasks').send({ title: 'Shared', assignees: [member.user.id, owner.user.id] })).body.task;
    expect(task.assignees).toHaveLength(2);

    expect((await owner.agent.delete(`/api/team/members/${member.user.id}`)).status).toBe(204);
    expect((await onBoard(member, owner).get('/api/tasks')).status).toBe(404);
    const after = (await owner.agent.get(`/api/tasks/${task.id}`)).body.task;
    expect(after.assignees.map((a: { id: string }) => a.id)).toEqual([owner.user.id]);
    // the cached board shows the same, not a stale copy
    expect((await owner.agent.get('/api/tasks')).body.items[0].assignees).toHaveLength(1);
  });

  it('lets a member leave, but nobody remove the owner or a stranger', async () => {
    const owner = await signedInAgent();
    const member = await joinAs(owner, 'viewer');
    const other = await joinAs(owner, 'viewer');
    expect((await onBoard(member, owner).del(`/api/team/members/${other.user.id}`)).status).toBe(403);
    expect((await owner.agent.delete(`/api/team/members/${owner.user.id}`)).status).toBe(400);
    expect((await onBoard(member, owner).del(`/api/team/members/${member.user.id}`)).status).toBe(204);
    expect((await onBoard(member, owner).get('/api/tasks')).status).toBe(404);
    expect((await owner.agent.delete(`/api/team/members/${member.user.id}`)).status).toBe(404);
  });
});

describe('assigning tasks', () => {
  it('assigns several people at once and shows who they are', async () => {
    const owner = await signedInAgent({ name: 'Asha Verma' });
    const a = await joinAs(owner, 'editor');
    const b = await joinAs(owner, 'viewer');
    const res = await owner.agent.post('/api/tasks').send({ title: 'Ship it', assignees: [a.user.id, b.user.id, owner.user.id, a.user.id] });
    expect(res.status).toBe(201);
    expect(res.body.task.assignees.map((p: { id: string }) => p.id).sort()).toEqual([a.user.id, b.user.id, owner.user.id].sort());
    expect(res.body.task.assignees[0]).toEqual(expect.objectContaining({ name: expect.any(String), email: expect.stringContaining('@') }));
  });

  it('only the people on the team can be assigned', async () => {
    const owner = await signedInAgent();
    const outsider = await signedInAgent();
    const res = await owner.agent.post('/api/tasks').send({ title: 'x', assignees: [outsider.user.id] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/on this board's team/);
    const bad = await owner.agent.post('/api/tasks').send({ title: 'x', assignees: ['nope'] });
    expect(bad.status).toBe(400);
  });

  it('a person who accepted an invitation appears as assignable, one who has not does not', async () => {
    const owner = await signedInAgent();
    const pending = await signedInAgent();
    await invite(owner, pending.user.email);
    expect((await owner.agent.post('/api/tasks').send({ title: 'x', assignees: [pending.user.id] })).status).toBe(400);
    const { token } = { token: tokenIn(outbox.at(-1)!) };
    await pending.agent.post(`/api/invitations/${token}/accept`);
    expect((await owner.agent.post('/api/tasks').send({ title: 'x', assignees: [pending.user.id] })).status).toBe(201);
  });

  it('can be changed and cleared on an existing task', async () => {
    const owner = await signedInAgent();
    const a = await joinAs(owner, 'editor');
    const id = (await owner.agent.post('/api/tasks').send({ title: 'T', assignees: [a.user.id] })).body.task.id;
    expect((await owner.agent.patch(`/api/tasks/${id}`).send({ assignees: [] })).body.task.assignees).toEqual([]);
    expect((await owner.agent.patch(`/api/tasks/${id}`).send({ assignees: [owner.user.id] })).body.task.assignees).toHaveLength(1);
    // editing something else leaves the assignees alone
    expect((await owner.agent.patch(`/api/tasks/${id}`).send({ title: 'Renamed' })).body.task.assignees).toHaveLength(1);
  });

  it('filters by "assigned to me", "unassigned" and one person, and never leaks one viewer’s "me" to another', async () => {
    const owner = await signedInAgent();
    const a = await joinAs(owner, 'editor');
    await owner.agent.post('/api/tasks').send({ title: 'Mine', assignees: [owner.user.id] });
    await owner.agent.post('/api/tasks').send({ title: 'Theirs', assignees: [a.user.id] });
    await owner.agent.post('/api/tasks').send({ title: 'Nobody' });
    const titles = (r: request.Response) => r.body.items.map((t: { title: string }) => t.title).sort();

    expect(titles(await owner.agent.get('/api/tasks?assignee=me'))).toEqual(['Mine']);
    // same query, same board, different viewer: must be that viewer's tasks, not the cached ones from the owner
    expect(titles(await onBoard(a, owner).get('/api/tasks?assignee=me'))).toEqual(['Theirs']);
    expect(titles(await owner.agent.get('/api/tasks?assignee=unassigned'))).toEqual(['Nobody']);
    expect(titles(await owner.agent.get(`/api/tasks?assignee=${a.user.id}`))).toEqual(['Theirs']);
    expect((await owner.agent.get('/api/tasks?assignee=bogus')).status).toBe(400);
  });

  it('emails each newly assigned person, but not the one who assigned and not people who were already assigned', async () => {
    const owner = await signedInAgent({ name: 'Asha Verma' });
    const a = await joinAs(owner, 'editor');
    const b = await joinAs(owner, 'editor');
    outbox.length = 0;

    const created = await owner.agent.post('/api/tasks').send({ title: 'Fix login', dueDate: '2026-12-01', startTime: '10:00', dueTime: '12:30', assignees: [a.user.id, owner.user.id] });
    await flushMail();
    expect(outbox.map((m) => m.to)).toEqual([a.user.email]);
    expect(outbox[0]!.subject).toContain('Asha Verma assigned you "Fix login"');
    expect(outbox[0]!.text).toContain('2026-12-01 10:00-12:30');
    expect(outbox[0]!.text).toContain(`board=${owner.user.id}&task=${created.body.task.id}`);

    outbox.length = 0;
    await owner.agent.patch(`/api/tasks/${created.body.task.id}`).send({ assignees: [a.user.id, b.user.id] });
    await flushMail();
    expect(outbox.map((m) => m.to)).toEqual([b.user.email]);

    outbox.length = 0;
    await owner.agent.patch(`/api/tasks/${created.body.task.id}`).send({ title: 'Fix login page' });
    await flushMail();
    expect(outbox).toHaveLength(0);
  });

  it('a failing mail server never breaks the request', async () => {
    const owner = await signedInAgent();
    const a = await joinAs(owner, 'editor');
    useMailer({ kind: 'broken', send: async () => Promise.reject(new Error('smtp down')), close: () => {} });
    try {
      expect((await owner.agent.post('/api/tasks').send({ title: 'T', assignees: [a.user.id] })).status).toBe(201);
    } finally {
      useMailer(capture);
    }
  });
});
