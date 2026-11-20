import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Task } from '../src/models/Task.js';
import { User } from '../src/models/User.js';

export const app = createApp();

export async function startDb() {
  await connectDb(process.env.MONGODB_URI!);
}

export async function resetDb() {
  await Promise.all([User.deleteMany({}), Task.deleteMany({})]);
}

export async function stopDb() {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}

let counter = 0;

/** Registers a fresh user and returns a supertest agent that carries its session cookie. */
export async function signedInAgent(overrides: { email?: string; password?: string; name?: string } = {}) {
  const agent = request.agent(app);
  const email = overrides.email ?? `user${++counter}@example.com`;
  const res = await agent
    .post('/api/auth/register')
    .send({ name: overrides.name ?? 'Test User', email, password: overrides.password ?? 'correct-horse-9' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user as { id: string; email: string; name: string } };
}
