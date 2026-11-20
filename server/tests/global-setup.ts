import { MongoMemoryServer } from 'mongodb-memory-server';

// One throwaway mongod for the whole run. Tests that need a real database get an
// isolated copy of it through tests/helpers.ts.
let mongod: MongoMemoryServer | undefined;

export async function setup() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('task-manager-test');
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
}

export async function teardown() {
  await mongod?.stop();
}
