import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// With Redis, the count is shared: two separate app instances (two servers behind a load balancer) add up to ONE limit.
const redisUrl = process.env.REDIS_TEST_URL;
if (redisUrl) process.env.REDIS_URL = redisUrl;
process.env.RATE_LIMITING_ENABLED = 'true';
process.env.RATE_LIMIT_AUTH_MAX = '4';

describe.skipIf(!redisUrl)('rate limits shared through Redis', () => {
  let createApp: typeof import('../src/app.js').createApp;
  let cacheMod: typeof import('../src/infra/cache/index.js');

  beforeAll(async () => {
    ({ createApp } = await import('../src/app.js'));
    cacheMod = await import('../src/infra/cache/index.js');
  });
  afterAll(async () => cacheMod.cache.close());

  it('counts requests across instances', async () => {
    const serverA = createApp();
    const serverB = createApp();
    // An invalid body is answered with 400 straight away (no database needed), but it still counts against the limit.
    const body = {};
    const statuses = [
      (await request(serverA).post('/api/auth/login').send(body)).status,
      (await request(serverB).post('/api/auth/login').send(body)).status,
      (await request(serverA).post('/api/auth/login').send(body)).status,
      (await request(serverB).post('/api/auth/login').send(body)).status,
      (await request(serverA).post('/api/auth/login').send(body)).status, // 5th overall, limit is 4
      (await request(serverB).post('/api/auth/login').send(body)).status,
    ];
    expect(statuses.slice(0, 4)).toEqual([400, 400, 400, 400]);
    expect(statuses.slice(4)).toEqual([429, 429]);
  });
});
