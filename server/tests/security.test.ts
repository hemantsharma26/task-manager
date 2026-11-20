import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, resetDb, signedInAgent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
beforeEach(resetDb);
afterAll(stopDb);

describe('response headers', () => {
  it('sends the protective headers on every response, API or error', async () => {
    for (const res of [await request(app).get('/api/health'), await request(app).get('/api/nope'), await request(app).get('/api/auth/me')]) {
      const csp = String(res.headers['content-security-policy']);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).not.toContain('unsafe-eval');
      expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(String(res.headers['permissions-policy'])).toContain('camera=()');
      expect(res.headers['x-powered-by']).toBeUndefined();
    }
  });

  it('does not send HSTS unless it is switched on (it belongs to whatever terminates TLS)', async () => {
    expect((await request(app).get('/api/health')).headers['strict-transport-security']).toBeUndefined();
  });

  it('gives each request its own id, and ignores one supplied by the client', async () => {
    const a = await request(app).get('/api/health').set('X-Request-Id', 'forged-by-the-client');
    const b = await request(app).get('/api/health');
    expect(a.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
    expect(a.headers['x-request-id']).not.toBe('forged-by-the-client');
  });

  it('never leaks internals in an error', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"broken');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at |node_modules|SyntaxError|Unexpected/);
  });
});

describe('cross-site request forgery', () => {
  const asHost = (r: request.Test) => r.set('Host', 'app.example');

  it('refuses a write that says it comes from another site, even with valid cookies', async () => {
    const { agent } = await signedInAgent();
    const evil = await asHost(agent.post('/api/tasks')).set('Origin', 'https://evil.example').send({ title: 'planted' });
    expect(evil.status).toBe(403);
    expect(evil.body.error.code).toBe('FORBIDDEN');
    expect((await agent.get('/api/tasks')).body.total).toBe(0);
  });

  it('refuses a browser-flagged cross-site write even without an Origin header', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').set('Sec-Fetch-Site', 'cross-site').send({ title: 'x' })).status).toBe(403);
    expect((await agent.post('/api/auth/logout').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
  });

  it('allows writes from the app\'s own origin', async () => {
    const { agent } = await signedInAgent();
    const ok = await asHost(agent.post('/api/tasks')).set('Origin', 'http://app.example').set('Sec-Fetch-Site', 'same-origin').send({ title: 'mine' });
    expect(ok.status).toBe(201);
  });

  it('does not interfere with reads from anywhere, or with non-browser clients that send no Origin', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.get('/api/tasks').set('Origin', 'https://other.example')).status).toBe(200);
    expect((await agent.post('/api/tasks').send({ title: 'script' })).status).toBe(201);
  });
});

describe('request bodies', () => {
  it.each([
    ['text/plain', 'title=x'],
    ['application/x-www-form-urlencoded', 'title=x'],
    ['multipart/form-data; boundary=x', '--x--'],
  ])('refuses a write sent as %s (what a plain HTML form can send)', async (type, body) => {
    const { agent } = await signedInAgent();
    const res = await agent.post('/api/tasks').set('Content-Type', type).send(body);
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('still allows a bodiless POST (sign out, for example)', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });

  it('caps the size of a sign-in body far below the general limit, and the general body too', async () => {
    const big = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(6000) });
    expect(big.status).toBe(413);
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').send({ title: 'x', description: 'y'.repeat(60_000) })).status).toBe(413);
  });

  it('rejects arrays or scalars as the body instead of guessing', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').send(JSON.stringify([1, 2])).set('Content-Type', 'application/json')).status).toBe(400);
  });
});

describe('injection', () => {
  it('refuses MongoDB operators anywhere in the body, query or nested objects', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').send({ title: { $ne: null } })).status).toBe(400);
    expect((await agent.post('/api/tasks').send({ title: 'x', extra: { nested: { $where: '1==1' } } })).status).toBe(400);
    expect((await agent.get('/api/tasks?status[$ne]=done')).status).toBe(400);
    expect((await agent.get('/api/tasks?q[$regex]=.*')).status).toBe(400);
  });

  it('refuses dotted keys and prototype-pollution keys', async () => {
    const { agent } = await signedInAgent();
    expect((await agent.post('/api/tasks').send({ title: 'x', 'owner.id': 1 })).status).toBe(400);
    expect((await agent.post('/api/tasks').set('Content-Type', 'application/json').send('{"title":"x","__proto__":{"isAdmin":true}}')).status).toBe(400);
    expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined();
  });

  it('treats a "$" or "." in an ordinary VALUE as the plain text it is', async () => {
    const { agent } = await signedInAgent();
    const res = await agent.post('/api/tasks').send({ title: 'Pay $5.00 to a.b@c.com', description: '{"$ne": 1}' });
    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Pay $5.00 to a.b@c.com');
  });

  it('keeps a regex search literal, so it cannot be used as a denial-of-service pattern', async () => {
    const { agent } = await signedInAgent();
    await agent.post('/api/tasks').send({ title: 'plain' });
    const res = await agent.get(`/api/tasks?q=${encodeURIComponent('(a+)+$')}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('does not run script from stored text: it comes back as inert JSON', async () => {
    const { agent } = await signedInAgent();
    const created = await agent.post('/api/tasks').send({ title: '<img src=x onerror=alert(1)>' });
    expect(created.headers['content-type']).toMatch(/application\/json/);
    expect(created.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('authorisation', () => {
  it('protects every data route without a session', async () => {
    for (const [method, path] of [['get', '/api/tasks'], ['post', '/api/tasks'], ['get', '/api/tasks/stats'], ['get', '/api/columns'], ['post', '/api/columns'], ['get', '/api/auth/me'], ['post', '/api/auth/logout-all'], ['get', '/api/auth/sessions']] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });
});
