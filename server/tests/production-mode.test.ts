import { spawnSync } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The app as it runs on a server: NODE_ENV=production. Set before anything is imported.
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'production-test-jwt-secret-not-a-placeholder-1234';
process.env.PASSWORD_PEPPER = 'production-test-pepper-not-a-placeholder-1234';
process.env.REDIS_URL = '';

const cookies = (res: { headers: Record<string, unknown> }) => ([] as string[]).concat((res.headers['set-cookie'] as string[] | string | undefined) ?? []);

describe('production mode', () => {
  let h: typeof import('./helpers.js');
  beforeAll(async () => {
    h = await import('./helpers.js');
    await h.startDb();
  });
  afterAll(async () => h.stopDb());

  it('uses browser-enforced cookie prefixes and the Secure flag', async () => {
    const res = await request(h.app).post('/api/auth/register').send({ name: 'Prod User', email: 'prod@example.com', password: 'Tr1cky-Harbor-Lamp!' });
    expect(res.status).toBe(201);
    const [access, refresh] = [cookies(res).find((c) => c.startsWith('__Host-tm_at='))!, cookies(res).find((c) => c.startsWith('__Secure-tm_rt='))!];

    // __Host-: Secure, Path=/, and NO Domain attribute, so a sibling subdomain cannot overwrite it
    expect(access).toMatch(/; Secure/);
    expect(access).toMatch(/Path=\/(;|$)/);
    expect(access).not.toMatch(/Domain=/i);
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Lax/);

    expect(refresh).toMatch(/; Secure/);
    expect(refresh).toMatch(/Path=\/api\/auth/);
    expect(refresh).toMatch(/SameSite=Strict/);
    expect(refresh).toMatch(/HttpOnly/);
  });

  it('is not sent HSTS by the app unless asked (the reverse proxy owns that)', async () => {
    expect((await request(h.app).get('/api/health')).headers['strict-transport-security']).toBeUndefined();
  });

  it('refuses to start with a placeholder secret copied from .env.example', () => {
    const run = (secret: string, pepper: string) =>
      spawnSync(process.execPath, ['--import', 'tsx', '-e', "await import('./src/config/env.ts')"], {
        cwd: path.resolve(import.meta.dirname, '..'),
        env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: secret, PASSWORD_PEPPER: pepper, MONGODB_URI: 'mongodb://127.0.0.1/x' },
        encoding: 'utf8',
      });
    const bad = run('change-me-to-a-long-random-string-of-32-plus-chars', 'production-test-pepper-not-a-placeholder-1234');
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/JWT_SECRET still has the placeholder/);
    const badPepper = run('production-test-jwt-secret-not-a-placeholder-1234', 'change-me-pepper-a-different-long-random-string-32chars');
    expect(badPepper.status).toBe(1);
    expect(badPepper.stderr).toMatch(/PASSWORD_PEPPER still has the placeholder/);
    expect(run('production-test-jwt-secret-not-a-placeholder-1234', 'production-test-pepper-not-a-placeholder-1234').status).toBe(0);
  }, 30000);
});
