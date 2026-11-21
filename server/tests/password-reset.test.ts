import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { flushMail, useMailer, type Mailer, type OutgoingMail } from '../src/infra/mail/index.js';
import { PasswordReset } from '../src/modules/auth/password-reset.model.js';
import { Session } from '../src/modules/auth/session.model.js';
import { app, resetDb, signedInAgent, startDb, STRONG_PASSWORD, stopDb } from './helpers.js';

const outbox: OutgoingMail[] = [];
const capture: Mailer = { kind: 'capture', send: async (m) => void outbox.push(m), close: () => {} };

beforeAll(async () => {
  await startDb();
  useMailer(capture);
});
afterAll(stopDb);
beforeEach(async () => {
  await resetDb();
  await Promise.all([Session.deleteMany({}), PasswordReset.deleteMany({})]);
  outbox.length = 0;
});

const NEW_PASSWORD = 'Brand-New-Kettle-47!';
const forgot = (email: string) => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (token: string, newPassword: string) => request(app).post('/api/auth/reset-password').send({ token, newPassword });
const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });

async function requestLink(email: string) {
  expect((await forgot(email)).status).toBe(202);
  await flushMail();
  const mail = outbox.filter((m) => m.to === email).at(-1);
  return mail ? /\/reset-password\/([\w-]+)/.exec(mail.text)![1]! : undefined;
}

describe('forgot password', () => {
  it('emails a one-time link to a known address', async () => {
    const { user } = await signedInAgent();
    const token = await requestLink(user.email);
    expect(token).toMatch(/^[\w-]{40,}$/);
    expect(outbox[0]!.subject).toBe('Reset your Task Manager password');
    // only a hash is stored
    expect(JSON.stringify(await PasswordReset.find().lean())).not.toContain(token!);
  });

  it('gives the same answer for an address that has no account, and sends nothing', async () => {
    const known = await signedInAgent();
    const a = await forgot(known.user.email);
    const b = await forgot('nobody@example.com');
    expect(b.status).toBe(a.status);
    expect(b.body).toEqual(a.body);
    await flushMail();
    expect(outbox.map((m) => m.to)).toEqual([known.user.email]);
  });

  it('refuses a malformed address like any other form field', async () => {
    expect((await forgot('not-an-email')).status).toBe(400);
    expect((await request(app).post('/api/auth/forgot-password').send({ email: { $ne: '' } })).status).toBe(400);
  });

  it('allows only a few requests per hour per account, still answering the same', async () => {
    const { user } = await signedInAgent();
    for (let i = 0; i < 3; i++) await requestLink(user.email);
    outbox.length = 0;
    expect((await forgot(user.email)).status).toBe(202);
    await flushMail();
    expect(outbox).toHaveLength(0);
  });

  it('a newer link replaces the older one', async () => {
    const { user } = await signedInAgent();
    const first = (await requestLink(user.email))!;
    const second = (await requestLink(user.email))!;
    expect((await reset(first, NEW_PASSWORD)).status).toBe(400);
    expect((await reset(second, NEW_PASSWORD)).status).toBe(204);
  });
});

describe('reset password', () => {
  it('sets the new password, works once, and the old password stops working', async () => {
    const { user } = await signedInAgent();
    const token = (await requestLink(user.email))!;
    expect((await reset(token, NEW_PASSWORD)).status).toBe(204);

    expect((await login(user.email, NEW_PASSWORD)).status).toBe(200);
    expect((await login(user.email, STRONG_PASSWORD)).status).toBe(401);
    const again = await reset(token, 'Another-Fine-Pass-99!');
    expect(again.status).toBe(400);
    expect(again.body.error.message).toMatch(/no longer valid/);
  });

  it('signs every device out, including whoever had the old password', async () => {
    const { agent, user } = await signedInAgent();
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    const token = (await requestLink(user.email))!;
    await reset(token, NEW_PASSWORD);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await agent.post('/api/auth/refresh')).status).toBe(401);
  });

  it('holds the new password to the same rules as registering', async () => {
    const { user } = await signedInAgent();
    const token = (await requestLink(user.email))!;
    expect((await reset(token, 'short')).status).toBe(400);
    expect((await reset(token, 'password1234')).status).toBe(400);
    // a refused password does not use the link up
    expect((await reset(token, NEW_PASSWORD)).status).toBe(204);
  });

  it('rejects a wrong, expired or malformed link', async () => {
    const { user } = await signedInAgent();
    const token = (await requestLink(user.email))!;
    expect((await reset('x'.repeat(43), NEW_PASSWORD)).status).toBe(400);
    expect((await reset('short', NEW_PASSWORD)).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: { $ne: '' }, newPassword: NEW_PASSWORD })).status).toBe(400);
    await PasswordReset.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await reset(token, NEW_PASSWORD)).status).toBe(400);
  });

  it('two simultaneous uses of one link: exactly one wins', async () => {
    const { user } = await signedInAgent();
    const token = (await requestLink(user.email))!;
    const results = await Promise.all([reset(token, NEW_PASSWORD), reset(token, 'Second-Choice-Lamp-31!')]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 400]);
  });
});

describe('signing out', () => {
  it('"other devices" ends every session except this one, which keeps working', async () => {
    const first = await signedInAgent();
    const second = request.agent(app);
    await second.post('/api/auth/login').send({ email: first.user.email, password: STRONG_PASSWORD });
    const third = request.agent(app);
    await third.post('/api/auth/login').send({ email: first.user.email, password: STRONG_PASSWORD });

    expect((await second.post('/api/auth/logout-others')).status).toBe(204);
    expect((await second.get('/api/auth/me')).status).toBe(200);
    expect((await first.agent.get('/api/auth/me')).status).toBe(401);
    expect((await third.get('/api/auth/me')).status).toBe(401);
    expect((await second.get('/api/auth/sessions')).body.sessions).toHaveLength(1);
  });

  it('needs a signed-in account', async () => {
    expect((await request(app).post('/api/auth/logout-others')).status).toBe(401);
  });
});
