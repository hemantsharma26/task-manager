import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { MongoMemoryServer } from 'mongodb-memory-server';

// One throwaway mongod for the whole run. Tests get an isolated database from it (see tests/helpers.ts).
// Everything else (JWT secret, log level, TTLs) comes from server/.env.test.
let mongod: MongoMemoryServer | undefined;
// A throwaway redis-server too, when the binary is installed. Tests that need real Redis skip themselves otherwise.
let redis: ChildProcess | undefined;
let uploads: string | undefined;

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });

async function startRedis(): Promise<string | undefined> {
  if (spawnSync('redis-server', ['--version']).status !== 0) return undefined;
  const port = await freePort();
  redis = spawn('redis-server', ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
  // Wait until it accepts connections.
  for (let i = 0; i < 50; i++) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.connect(port, '127.0.0.1', () => (s.destroy(), resolve(true)));
      s.on('error', () => resolve(false));
    });
    if (ok) return `redis://127.0.0.1:${port}`;
    await new Promise((r) => setTimeout(r, 100));
  }
  return undefined;
}

export async function setup() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('task-manager-test');
  // Uploaded files go to a throwaway folder that is deleted when the run ends.
  uploads = mkdtempSync(path.join(tmpdir(), 'task-manager-uploads-'));
  process.env.UPLOAD_DIR = uploads;
  const redisUrl = await startRedis();
  if (redisUrl) process.env.REDIS_TEST_URL = redisUrl;
}

export async function teardown() {
  redis?.kill();
  if (uploads) rmSync(uploads, { recursive: true, force: true });
  await mongod?.stop();
}
