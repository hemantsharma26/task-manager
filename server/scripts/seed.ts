// Creates a demo account with a realistic spread of tasks. Safe to re-run: it resets the demo user.
import { env } from '../src/config/env.js';
import { connectDb, disconnectDb } from '../src/infra/database/connection.js';
import { cache } from '../src/infra/cache/index.js';
import { hashPassword } from '../src/modules/auth/password.service.js';
import { Session } from '../src/modules/auth/session.model.js';
import { User } from '../src/modules/auth/user.model.js';
import { Column } from '../src/modules/columns/column.model.js';
import { Counter } from '../src/modules/tasks/counter.model.js';
import { Task } from '../src/modules/tasks/task.model.js';
import type { CreateTaskInput } from '../src/modules/tasks/tasks.schemas.js';
import { createTask } from '../src/modules/tasks/tasks.service.js';

const DEMO = { name: 'Demo User', email: 'demo@taskmanager.test', password: 'Demo-Board-2026!' };

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
  await Column.deleteMany({ owner: existing._id });
  await Session.deleteMany({ user: existing._id });
  await cache.invalidateUser(String(existing._id));
  await existing.deleteOne();
}

const user = await User.create({
  name: DEMO.name,
  email: DEMO.email,
  passwordHash: await hashPassword(DEMO.password),
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
  { title: 'Payment webhook fails on retry', description: 'Duplicate events create two invoices when the gateway retries.', priority: 'high', status: 'issue', dueDate: isoOffset(0) },
  { title: 'Staging build is red after the Node upgrade', priority: 'medium', status: 'issue', dueDate: isoOffset(2) },
  { title: 'Rewrite onboarding emails after review', description: 'Legal asked for shorter copy and an unsubscribe link.', priority: 'medium', status: 'rework', dueDate: isoOffset(4) },
  { title: 'Reply to vendor about invoice mismatch', priority: 'high', status: 'todo', dueDate: isoOffset(-1) },
  { title: 'Read the Postgres indexing chapter', priority: 'low', status: 'todo', dueDate: null },
];

// Go through the same service the API uses, so numbers, ranks and completedAt are set exactly as in real use.
for (const t of tasks) await createTask(String(user._id), { description: '', ...t });

console.log(`Seeded ${tasks.length} tasks for ${DEMO.email} (password: ${DEMO.password})`);
await Promise.all([disconnectDb(), cache.close()]);
