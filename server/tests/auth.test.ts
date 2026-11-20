import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, resetDb, signedInAgent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
beforeEach(resetDb);
afterAll(stopDb);

describe('auth', () => {
  it('registers, sets an httpOnly cookie and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'Asha@Example.com', password: 'longenough1' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Asha', email: 'asha@example.com' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|longenough1/);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/tm_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('rejects a duplicate email, ignoring case', async () => {
    await signedInAgent({ email: 'dup@example.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'DUP@example.com', password: 'longenough1' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('validates registration input with field-level errors', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: '', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['email', 'name', 'password']);
  });

  it('logs in with the right password and rejects the wrong one with the same message as an unknown email', async () => {
    await signedInAgent({ email: 'login@example.com', password: 'right-password-1' });

    const ok = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'right-password-1' });
    expect(ok.status).toBe(200);

    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong-password-1' });
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'wrong-password-1' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('/me needs a session, works with one, and logout ends it', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);

    const { agent, user } = await signedInAgent();
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(user.id);

    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'tm_token=not.a.jwt');
    expect(res.status).toBe(401);
  });
});
