import { isValidObjectId, Types, type PipelineStage } from 'mongoose';
import { Task, type ITask, type TaskDoc } from '../models/Task.js';
import type { CreateTaskInput, ListQuery, UpdateTaskInput } from '../schemas/task.js';
import { HttpError } from '../utils/httpError.js';

type TaskLike = Omit<ITask, 'owner'> & { _id: unknown; owner: unknown };

export const toTaskDTO = (t: TaskLike) => ({
  id: String(t._id),
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate ?? null,
  completedAt: t.completedAt ?? null,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const todayUtc = () => new Date().toISOString().slice(0, 10);

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildFilter(userId: string, q: Pick<ListQuery, 'status' | 'priority' | 'due' | 'q' | 'today'>) {
  const today = q.today ?? todayUtc();
  const filter: Record<string, unknown> = { owner: new Types.ObjectId(userId) };

  if (q.status) filter.status = q.status;
  if (q.priority) filter.priority = q.priority;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ title: rx }, { description: rx }];
  }

  // YYYY-MM-DD strings compare correctly as plain strings.
  switch (q.due) {
    case 'overdue':
      filter.dueDate = { $lt: today };
      filter.status = q.status ?? { $ne: 'done' }; // a finished task is never "overdue"
      break;
    case 'today':
      filter.dueDate = today;
      break;
    case 'week':
      filter.dueDate = { $gte: today, $lte: addDays(today, 6) };
      break;
    case 'none':
      filter.dueDate = null;
      break;
  }
  return filter;
}

const PRIORITY_RANK = {
  $switch: {
    branches: [
      { case: { $eq: ['$priority', 'high'] }, then: 3 },
      { case: { $eq: ['$priority', 'medium'] }, then: 2 },
    ],
    default: 1,
  },
};

export async function listTasks(userId: string, query: ListQuery) {
  const filter = buildFilter(userId, query);
  const dir = query.order === 'asc' ? 1 : -1;

  // Aggregation rather than find() because some sorts need computed keys:
  //  - priority is a string but must order low < medium < high
  //  - dueDate must put tasks WITHOUT a date last, in both directions
  //  - title must sort case-insensitively (without needing a collation on the whole query)
  const sortKeys: Record<ListQuery['sort'], Record<string, 1 | -1>> = {
    createdAt: { createdAt: dir },
    dueDate: { _noDueDate: 1, dueDate: dir },
    priority: { _priorityRank: dir, createdAt: -1 },
    title: { _titleLower: dir },
  };

  const pipeline: PipelineStage[] = [
    { $match: filter },
    {
      $addFields: {
        _priorityRank: PRIORITY_RANK,
        _noDueDate: { $cond: [{ $eq: [{ $ifNull: ['$dueDate', null] }, null] }, 1, 0] },
        _titleLower: { $toLower: '$title' },
      },
    },
    // _id as the last key keeps pagination stable when the other keys tie.
    { $sort: { ...sortKeys[query.sort], _id: dir } },
    { $skip: (query.page - 1) * query.limit },
    { $limit: query.limit },
  ];

  const [items, total] = await Promise.all([Task.aggregate<TaskLike>(pipeline), Task.countDocuments(filter)]);

  return {
    items: items.map(toTaskDTO),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getStats(userId: string, today = todayUtc()) {
  const owner = new Types.ObjectId(userId);
  const [byStatus, overdue] = await Promise.all([
    Task.aggregate<{ _id: string; n: number }>([{ $match: { owner } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Task.countDocuments({ owner, status: { $ne: 'done' }, dueDate: { $lt: today } }),
  ]);
  const count = (s: string) => byStatus.find((b) => b._id === s)?.n ?? 0;
  const stats = { todo: count('todo'), in_progress: count('in_progress'), done: count('done') };
  return { ...stats, total: stats.todo + stats.in_progress + stats.done, overdue };
}

// A malformed id and a missing task look identical to the caller, and a task that
// belongs to someone else is also a 404, so ids cannot be probed.
async function findOwned(userId: string, id: string): Promise<TaskDoc> {
  if (!isValidObjectId(id)) throw HttpError.notFound('Task not found');
  const task = await Task.findOne({ _id: id, owner: userId });
  if (!task) throw HttpError.notFound('Task not found');
  return task;
}

export async function getTask(userId: string, id: string) {
  return toTaskDTO(await findOwned(userId, id));
}

export async function createTask(userId: string, input: CreateTaskInput) {
  const task = await Task.create({ ...input, owner: userId });
  return toTaskDTO(task);
}

export async function updateTask(userId: string, id: string, input: UpdateTaskInput) {
  const task = await findOwned(userId, id);
  task.set(input);
  await task.save();
  return toTaskDTO(task);
}

export async function deleteTask(userId: string, id: string) {
  const res = isValidObjectId(id) ? await Task.deleteOne({ _id: id, owner: userId }) : { deletedCount: 0 };
  if (res.deletedCount === 0) throw HttpError.notFound('Task not found');
}
