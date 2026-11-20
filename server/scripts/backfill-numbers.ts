// One-off migration for data created before issue keys and board ranks existed.
// Gives every task without a `number` the next number for its owner (oldest first), gives every task
// without a `rank` a place at the bottom of its column in creation order, and syncs the per-user counter.
//
// Run it BEFORE starting the new API: the unique (owner, number) index cannot be built while tasks without
// a number exist. It is safe to run more than once.
//
//   npm run migrate:numbers
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { RANK_STEP } from '../src/constants/index.js';
import { Counter } from '../src/modules/tasks/counter.model.js';
import { Task } from '../src/modules/tasks/task.model.js';

type Row = { _id: mongoose.Types.ObjectId; owner: mongoose.Types.ObjectId; status: string; number?: number | null; rank?: number | null };

await mongoose.connect(env.MONGODB_URI);
// The raw collections behind the models: this script must not rely on schema defaults or index syncing.
const tasks = Task.collection as unknown as mongoose.mongo.Collection<Row>;
const counters = Counter.collection as unknown as mongoose.mongo.Collection<{ _id: string; seq: number }>;

const owners = await tasks.distinct('owner', { $or: [{ number: { $exists: false } }, { number: null }, { rank: { $exists: false } }] });
let touched = 0;

for (const owner of owners) {
  const rows = await tasks.find({ owner }).sort({ createdAt: 1, _id: 1 }).toArray();

  let maxNumber = rows.reduce((m, r) => Math.max(m, r.number ?? 0), 0);
  const maxRank: Record<string, number> = {};
  for (const r of rows) if (r.rank !== undefined) maxRank[r.status] = Math.max(maxRank[r.status] ?? 0, r.rank as number);

  const ops = [];
  for (const r of rows) {
    const set: Partial<Row> = {};
    if (r.number == null) set.number = ++maxNumber;
    if (r.rank == null) {
      maxRank[r.status] = (maxRank[r.status] ?? 0) + RANK_STEP;
      set.rank = maxRank[r.status];
    }
    if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: r._id }, update: { $set: set } } });
  }
  if (ops.length) {
    await tasks.bulkWrite(ops);
    touched += ops.length;
  }
  await counters.updateOne({ _id: String(owner) }, { $max: { seq: maxNumber } }, { upsert: true });
}

console.log(`Backfilled ${touched} task(s) across ${owners.length} user(s).`);
await mongoose.disconnect();
