import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The limiters are switched off for the rest of the suite (hundreds of sign-ins from one address). Here they are
// switched back on, with a tiny limit on sign-in. This must happen before the app is first imported.
process.env.RATE_LIMITING_ENABLED = 'true';
process.env.RATE_LIMIT_AUTH_MAX = '3';
process.env.RATE_LIMIT_API_MAX = '30';

describe('sign-in rate limit', () => {
  let h: typeof import('./helpers.js');
  beforeAll(async () => {
    h = await import('./helpers.js');
    await h.startDb();
  });
  afterAll(async () => h.stopDb());

  it('stops a client that hammers the sign-in route, and says so in the standard way', async () => {
    const statuses: number[] = [];
    let last: request.Response | undefined;
    for (let i = 0; i < 5; i++) {
      last = await request(h.app).post('/api/auth/login').send({ email: 'a@example.com', password: 'whatever-it-is' });
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3)).toEqual([429, 429]);
    expect(last!.body.error.code).toBe('RATE_LIMITED');
    expect(Object.keys(last!.headers).some((k) => k.startsWith('ratelimit') || k === 'retry-after')).toBe(true);
  });

  it('never throttles the health check, so monitoring keeps working (the API as a whole allows only 30 requests)', async () => {
    for (let i = 0; i < 40; i++) expect((await request(h.app).get('/api/health')).status).toBe(200);
  });
});
