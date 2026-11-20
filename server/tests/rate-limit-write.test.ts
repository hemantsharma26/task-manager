import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.RATE_LIMITING_ENABLED = 'true';
process.env.RATE_LIMIT_WRITE_MAX = '3';
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.RATE_LIMIT_API_MAX = '1000';

describe('write rate limit (per user)', () => {
  let h: typeof import('./helpers.js');
  beforeAll(async () => {
    h = await import('./helpers.js');
    await h.startDb();
  });
  afterAll(async () => h.stopDb());

  it('limits one user\'s writes, not another user\'s, and never limits reads', async () => {
    const a = await h.signedInAgent();
    const b = await h.signedInAgent();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await a.agent.post('/api/tasks').send({ title: `t${i}` })).status);

    expect(statuses.filter((s) => s === 201)).toHaveLength(3);
    expect(statuses.slice(3)).toEqual([429, 429, 429]);
    expect((await b.agent.post('/api/tasks').send({ title: 'another user' })).status).toBe(201);
    for (let i = 0; i < 10; i++) expect((await a.agent.get('/api/tasks')).status).toBe(200);
  });
});
