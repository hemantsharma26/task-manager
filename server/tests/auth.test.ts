import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { Session } from '../src/modules/auth/session.model.js';
import { User } from '../src/modules/auth/user.model.js';
import { app, resetDb, signedInAgent, startDb, STRONG_PASSWORD, stopDb } from './helpers.js';

beforeAll(startDb);
beforeEach(async () => {
  await resetDb();
  await Session.deleteMany({});
});
afterAll(stopDb);

const cookieList = (res: { headers: Record<string, unknown> }) => ([] as string[]).concat((res.headers['set-cookie'] as string[] | string | undefined) ?? []);
const find = (cookies: string[], name: string) => cookies.find((c) => c.startsWith(`${name}=`));
const register = (body: Record<string, unknown>) => request(app).post('/api/auth/register').send(body);
const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });
const goodBody = (over: Record<string, unknown> = {}) => ({ name: 'Asha Verma', email: 'asha@example.com', password: STRONG_PASSWORD, ...over });

describe('registration', () => {
  it('creates the account, signs in, and sets two hardened cookies', async () => {
    const res = await register(goodBody());
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Asha Verma', email: 'asha@example.com' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Tr1cky/);
    expect(res.headers['cache-control']).toBe('no-store');

    const cookies = cookieList(res);
    const access = find(cookies, 'tm_at')!;
    const refresh = find(cookies, 'tm_rt')!;
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Lax/i);
    expect(access).toMatch(/Path=\/(;|$)/);
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/SameSite=Strict/i);
    expect(refresh).toMatch(/Path=\/api\/auth/);
  });

  it('folds case and Unicode look-alikes, so one person cannot hold two accounts that look the same', async () => {
    expect((await register(goodBody({ email: 'Asha@Example.com' }))).status).toBe(201);
    expect((await register(goodBody({ email: 'ASHA@example.com' }))).status).toBe(409);
    expect((await register(goodBody({ email: 'ａｓｈａ@example.com' }))).status).toBe(409); // full-width letters
  });

  it('stores a peppered hash: the password alone does not match it', async () => {
    await register(goodBody());
    const user = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash');
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare(STRONG_PASSWORD, user!.passwordHash)).toBe(false);
  });

  it('applies the password policy and reports every field problem', async () => {
    const res = await register({ name: '', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it.each([
    ['too short', 'Ab1!xyz'],
    ['only two character classes', 'alllowercase99'],
    ['a common password in disguise', 'P@ssw0rd2026!'],
    ['containing the email name', 'Asha-Verma-2026!'],
    ['a trivial run', 'abcdefghijkl'],
  ])('refuses a password that is %s', async (_why, password) => {
    const res = await register(goodBody({ password }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d: { field: string }) => d.field === 'password')).toBe(true);
  });

  it('accepts a long passphrase without character-class rules', async () => {
    expect((await register(goodBody({ password: 'correct horse battery staple' }))).status).toBe(201);
  });

  it('rejects objects and arrays where strings belong', async () => {
    expect((await register(goodBody({ email: { $ne: '' } }))).status).toBe(400);
    expect((await register(goodBody({ password: ['a', 'b'] }))).status).toBe(400);
  });
});

describe('login', () => {
  it('signs in with the right password and sets the cookies', async () => {
    await register(goodBody());
    const res = await login('ASHA@example.com', STRONG_PASSWORD);
    expect(res.status).toBe(200);
    expect(find(cookieList(res), 'tm_at')).toBeTruthy();
  });

  it('answers a wrong password and an unknown email identically', async () => {
    await register(goodBody());
    const wrong = await login('asha@example.com', 'Wr0ng-Password-Here!');
    const unknown = await login('ghost@example.com', 'Wr0ng-Password-Here!');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('refuses operator objects instead of treating them as a query', async () => {
    await register(goodBody());
    const res = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
    expect(cookieList(res)).toHaveLength(0);
  });

  it('locks the account for that address after repeated failures, even for the right password, and says when to retry', async () => {
    await register(goodBody({ email: 'lock@example.com' }));
    for (let i = 0; i < env.LOGIN_MAX_ATTEMPTS; i++) {
      const r = await login('lock@example.com', 'Wr0ng-Password-Here!');
      expect(r.status, `attempt ${i + 1}: ${JSON.stringify(r.body)}`).toBe(401);
    }
    const locked = await login('lock@example.com', STRONG_PASSWORD);
    expect(locked.status).toBe(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    expect(cookieList(locked)).toHaveLength(0);
  });

  it('does not let failures against one account lock a different account', async () => {
    await register(goodBody({ email: 'one@example.com' }));
    await register(goodBody({ email: 'two@example.com' }));
    for (let i = 0; i < env.LOGIN_MAX_ATTEMPTS; i++) await login('one@example.com', 'Wr0ng-Password-Here!');
    expect((await login('two@example.com', STRONG_PASSWORD)).status).toBe(200);
  });

  it('forgets earlier failures after a successful sign-in', async () => {
    await register(goodBody({ email: 'reset@example.com' }));
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < env.LOGIN_MAX_ATTEMPTS - 1; i++) await login('reset@example.com', 'Wr0ng-Password-Here!');
      expect((await login('reset@example.com', STRONG_PASSWORD)).status).toBe(200);
    }
  });

  it('counts failures for unknown emails too, so lockouts cannot be used to find out who is registered', async () => {
    for (let i = 0; i < env.LOGIN_MAX_ATTEMPTS; i++) await login('nobody@example.com', 'Wr0ng-Password-Here!');
    expect((await login('nobody@example.com', 'Wr0ng-Password-Here!')).status).toBe(429);
  });
});

describe('access tokens', () => {
  it('/me needs a session and works with one', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const { agent, user } = await signedInAgent();
    expect((await agent.get('/api/auth/me')).body.user.id).toBe(user.id);
  });

  const claims = { sid: '000000000000000000000000', ts: Date.now() };
  const sign = (opts: jwt.SignOptions, payload: object = claims, secret: string = env.JWT_SECRET) =>
    jwt.sign(payload, secret, { subject: '000000000000000000000001', issuer: 'task-manager', audience: 'task-manager-web', ...opts });
  const withToken = (t: string) => request(app).get('/api/auth/me').set('Cookie', `tm_at=${t}`);

  it('rejects tokens that are tampered with, unsigned, signed with another key, for another audience, or algorithm-swapped', async () => {
    expect((await withToken('not.a.jwt')).status).toBe(401);
    expect((await withToken(sign({ algorithm: 'HS256', expiresIn: 60 }, claims, 'some-other-secret-some-other-secret-1'))).status).toBe(401);
    expect((await withToken(sign({ algorithm: 'HS256', expiresIn: 60, audience: 'somebody-else' }))).status).toBe(401);
    expect((await withToken(sign({ algorithm: 'HS512', expiresIn: 60 }))).status).toBe(401);
    // "alg: none": a token that simply claims it needs no signature
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...claims, sub: '000000000000000000000001', iss: 'task-manager', aud: 'task-manager-web', exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url')}.`;
    expect((await withToken(none)).status).toBe(401);
  });

  it('answers an expired token with TOKEN_EXPIRED, which is the client\'s cue to refresh', async () => {
    const res = await withToken(sign({ algorithm: 'HS256', expiresIn: -10 }));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('refresh tokens', () => {
  const refreshOf = (res: { headers: Record<string, unknown> }) => find(cookieList(res), 'tm_rt')!.split(';')[0]!.split('=')[1]!;

  it('trades a refresh token for a new pair, and the old refresh token stops working', async () => {
    const reg = await register(goodBody());
    const oldRefresh = refreshOf(reg);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${oldRefresh}`);
    expect(res.status).toBe(200);
    expect(refreshOf(res)).not.toBe(oldRefresh);
    expect(find(cookieList(res), 'tm_at')).toBeTruthy();
  });

  it('never stores the refresh token itself, only its hash', async () => {
    const reg = await register(goodBody());
    const token = refreshOf(reg);
    const stored = await Session.findOne({}).lean();
    expect(stored!.tokenHash).not.toBe(token);
    expect(stored!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('treats a replayed old token as theft: the whole session is revoked, even for the thief\'s victim', async () => {
    const reg = await register(goodBody());
    const stolen = refreshOf(reg);
    const rotated = await request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${stolen}`);
    const current = refreshOf(rotated);

    // The grace window is for parallel tabs. Push the rotation into the past, as if the replay came later.
    await Session.updateMany({}, { rotatedAt: new Date(Date.now() - 60_000) });
    expect((await request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${stolen}`)).status).toBe(401);
    // ...and now the legitimate holder's newest token is dead too.
    expect((await request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${current}`)).status).toBe(401);
    expect((await Session.findOne({}).lean())!.revokedReason).toBe('refresh_token_reuse');
  });

  it('accepts a parallel refresh from a second tab inside the grace window instead of logging the user out', async () => {
    const reg = await register(goodBody());
    const sameToken = refreshOf(reg);
    const [a, b] = await Promise.all([request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${sameToken}`), request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${sameToken}`)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    // and the session is still alive afterwards
    expect((await request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${refreshOf(b)}`)).status).toBe(200);
  });

  it('rejects missing, unknown, idle-expired and over-age sessions, and clears the cookies', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', 'tm_rt=nonsense')).status).toBe(401);

    const reg = await register(goodBody());
    const token = refreshOf(reg);
    await Session.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const idle = await request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${token}`);
    expect(idle.status).toBe(401);
    expect(cookieList(idle).some((c) => /tm_rt=;/.test(c))).toBe(true);

    await Session.updateMany({}, { expiresAt: new Date(Date.now() + 100_000), absoluteExpiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${token}`)).status).toBe(401);
  });

  it('never extends a session past its absolute limit, however often it is used', async () => {
    const reg = await register(goodBody());
    const hardLimit = new Date(Date.now() + 60_000);
    await Session.updateMany({}, { absoluteExpiresAt: hardLimit });
    await request(app).post('/api/auth/refresh').set('Cookie', `tm_rt=${refreshOf(reg)}`);
    expect((await Session.findOne({}).lean())!.expiresAt.getTime()).toBeLessThanOrEqual(hardLimit.getTime());
  });
});

describe('signing out', () => {
  it('kills the access token at once (not after it expires) and the refresh token', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await agent.post('/api/auth/refresh')).status).toBe(401);
  });

  it('a copied access token stops working after logout, even though it has not expired', async () => {
    const reg = await register(goodBody());
    const stolenAccess = find(cookieList(reg), 'tm_at')!.split(';')[0]!;
    const stolenRefresh = find(cookieList(reg), 'tm_rt')!.split(';')[0]!;
    expect((await request(app).get('/api/auth/me').set('Cookie', stolenAccess)).status).toBe(200);
    await request(app).post('/api/auth/logout').set('Cookie', `${stolenAccess}; ${stolenRefresh}`);
    expect((await request(app).get('/api/auth/me').set('Cookie', stolenAccess)).status).toBe(401);
  });

  it('always succeeds, even with no cookies at all', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });

  it('"sign out everywhere" ends every device, not just this one', async () => {
    const user = await register(goodBody());
    const other = request.agent(app);
    await other.post('/api/auth/login').send({ email: 'asha@example.com', password: STRONG_PASSWORD });
    const here = request.agent(app);
    await here.post('/api/auth/login').send({ email: 'asha@example.com', password: STRONG_PASSWORD });
    expect(user.status).toBe(201);

    expect((await here.post('/api/auth/logout-all')).status).toBe(204);
    expect((await here.get('/api/auth/me')).status).toBe(401);
    expect((await other.get('/api/auth/me')).status).toBe(401);
    expect((await other.post('/api/auth/refresh')).status).toBe(401);
    // a fresh sign-in afterwards works
    expect((await login('asha@example.com', STRONG_PASSWORD)).status).toBe(200);
  });
});

describe('changing the password', () => {
  const change = (agent: ReturnType<typeof request.agent>, currentPassword: string, newPassword: string) => agent.post('/api/auth/password').send({ currentPassword, newPassword });

  it('needs the current password', async () => {
    const { agent } = await signedInAgent();
    const res = await change(agent, 'Wr0ng-Password-Here!', 'Another-Strong-1!');
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/current password/i);
  });

  it('applies the same policy to the new password', async () => {
    const { agent } = await signedInAgent();
    expect((await change(agent, STRONG_PASSWORD, 'short')).status).toBe(400);
    expect((await change(agent, STRONG_PASSWORD, 'Password123!')).status).toBe(400);
  });

  it('switches the password, keeps this device signed in, and signs out all the others', async () => {
    await register(goodBody());
    const here = request.agent(app);
    const other = request.agent(app);
    await here.post('/api/auth/login').send({ email: 'asha@example.com', password: STRONG_PASSWORD });
    await other.post('/api/auth/login').send({ email: 'asha@example.com', password: STRONG_PASSWORD });

    const res = await change(here, STRONG_PASSWORD, 'Brand-New-Secret-7!');
    expect(res.status).toBe(200);
    expect(await here.get('/api/auth/me').then((r) => r.status)).toBe(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
    expect((await other.post('/api/auth/refresh')).status).toBe(401);

    expect((await login('asha@example.com', STRONG_PASSWORD)).status).toBe(401);
    expect((await login('asha@example.com', 'Brand-New-Secret-7!')).status).toBe(200);
  });

  it('counts wrong "current password" guesses like wrong sign-ins, so it cannot be used to brute-force', async () => {
    const { agent, user } = await signedInAgent();
    for (let i = 0; i < env.LOGIN_MAX_ATTEMPTS; i++) await change(agent, 'Wr0ng-Password-Here!', 'Another-Strong-1!');
    expect((await change(agent, STRONG_PASSWORD, 'Another-Strong-1!')).status).toBe(429);
    expect(user.id).toBeTruthy();
  });
});

describe('sessions', () => {
  it('lists this user\'s devices, marks the current one, and can end another', async () => {
    await register(goodBody());
    const a = request.agent(app);
    const b = request.agent(app);
    await a.post('/api/auth/login').send({ email: 'asha@example.com', password: STRONG_PASSWORD });
    await b.post('/api/auth/login').send({ email: 'asha@example.com', password: STRONG_PASSWORD });

    const list = (await a.get('/api/auth/sessions')).body.sessions as { id: string; current: boolean }[];
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.filter((s) => s.current)).toHaveLength(1);
    const other = list.find((s) => !s.current)!;

    expect((await a.delete(`/api/auth/sessions/${other.id}`)).status).toBe(204);
    expect(((await a.get('/api/auth/sessions')).body.sessions as unknown[]).length).toBe(list.length - 1);
  });

  it('will not end or even reveal another user\'s session', async () => {
    const alice = await signedInAgent();
    const bob = await signedInAgent();
    const aliceSession = ((await alice.agent.get('/api/auth/sessions')).body.sessions as { id: string }[])[0]!;
    expect((await bob.agent.delete(`/api/auth/sessions/${aliceSession.id}`)).status).toBe(404);
    expect(JSON.stringify((await bob.agent.get('/api/auth/sessions')).body)).not.toContain(aliceSession.id);
  });
});
