// Creates a demo account with a realistic spread of tasks. Safe to re-run: it resets the demo user.
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Counter } from '../src/models/Counter.js';
import { Task } from '../src/models/Task.js';
import { User } from '../src/models/User.js';
import type { CreateTaskInput } from '../src/schemas/task.js';
import { createTask } from '../src/services/task.service.js';

const DEMO = { name: 'Demo User', email: 'demo@taskmanager.test', password: 'Demo@12345' };

const isoOffset = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

await connectDb(env.MONGODB_URI);

const existing = await User.findOne({ email: DEMO.email });
if (existing) {
  await Task.deleteMany({ owner: existing._id });
  await Counter.deleteOne({ _id: String(existing._id) });
  await existing.deleteOne();
}

const user = await User.create({
  name: DEMO.name,
  email: DEMO.email,
  passwordHash: await bcrypt.hash(DEMO.password, 12),
});

type SeedTask = Pick<CreateTaskInput, 'title' | 'priority' | 'status' | 'dueDate'> & { description?: string };

const tasks: SeedTask[] = [
  { title: 'Fix login redirect bug', description: 'Users land on a blank page after the OAuth callback on Safari.', priority: 'high', status: 'in_progress', dueDate: isoOffset(1) },
  { title: 'Submit quarterly expense report', description: 'Attach the cab and hotel receipts from the Pune trip.', priority: 'high', status: 'todo', dueDate: isoOffset(-2) },
  { title: 'Review pull request #142', priority: 'medium', status: 'todo', dueDate: isoOffset(0) },
  { title: 'Write API docs for the orders endpoints', description: 'Cover pagination, filters and error shapes.', priority: 'medium', status: 'todo', dueDate: isoOffset(5) },
  { title: 'Renew domain and SSL certificate', priority: 'high', status: 'todo', dueDate: isoOffset(12) },
  { title: 'Clean up unused feature flags', priority: 'low', status: 'todo', dueDate: null },
  { title: 'Book dentist appointment', priority: 'low', status: 'todo', dueDate: isoOffset(9) },
  { title: 'Set up CI cache for node_modules', description: 'Build time is 6 min, should drop below 3.', priority: 'medium', status: 'done', dueDate: isoOffset(-4) },
  { title: 'Upgrade MongoDB driver', priority: 'medium', status: 'done', dueDate: isoOffset(-7) },
  { title: 'Plan sprint retrospective', priority: 'low', status: 'in_progress', dueDate: isoOffset(3) },
  { title: 'Reply to vendor about invoice mismatch', priority: 'high', status: 'todo', dueDate: isoOffset(-1) },
  { title: 'Read the Postgres indexing chapter', priority: 'low', status: 'todo', dueDate: null },
];

// Go through the same service the API uses, so numbers, ranks and completedAt are set exactly as in real use.
for (const t of tasks) await createTask(String(user._id), { description: '', ...t });

console.log(`Seeded ${tasks.length} tasks for ${DEMO.email} (password: ${DEMO.password})`);
await disconnectDb();
