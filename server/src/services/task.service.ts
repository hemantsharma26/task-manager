import { isValidObjectId, Types, type PipelineStage } from 'mongoose';
import { nextIssueNumber } from '../models/Counter.js';
import { Task, type ITask, type TaskDoc, type TaskStatus } from '../models/Task.js';
import type { CreateTaskInput, ListQuery, MoveTaskInput, UpdateTaskInput } from '../schemas/task.js';
import { HttpError } from '../utils/httpError.js';
import { columnsFor } from './column.service.js';
import { RANK_STEP, rankBetween } from '../utils/rank.js';

type TaskLike = Omit<ITask, 'owner'> & { _id: unknown; owner: unknown };

export const toTaskDTO = (t: TaskLike) => ({
  id: String(t._id),
  number: t.number,
  key: `TM-${t.number}`,
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

/** Keys of the user's "done" columns: tasks in them are finished, so they are never overdue. */
const doneKeysOf = (columns: { key: string; isDone: boolean }[]) => columns.filter((c) => c.isDone).map((c) => c.key);

function buildFilter(userId: string, q: Pick<ListQuery, 'status' | 'priority' | 'due' | 'q' | 'today'>, doneKeys: string[]) {
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
      filter.status = q.status ?? { $nin: doneKeys }; // a finished task is never "overdue"
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
  const doneKeys = query.due === 'overdue' ? doneKeysOf(await columnsFor(userId)) : [];
  const filter = buildFilter(userId, query, doneKeys);
  const dir = query.order === 'asc' ? 1 : -1;
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    query.sort === 'createdAt' || query.sort === 'rank'
      ? // Sorts that match an index go straight through find(): no computed fields, no in-memory sort.
        Task.find(filter)
          .sort({ [query.sort]: dir, _id: dir })
          .skip(skip)
          .limit(query.limit)
          .lean<TaskLike[]>()
      : Task.aggregate<TaskLike>(computedSortPipeline(filter, query.sort, dir, skip, query.limit)),
    Task.countDocuments(filter),
  ]);

  return {
    items: items.map(toTaskDTO),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

/**
 * Aggregation is only used for the sorts that need a computed key:
 *  - priority is a string but must order low < medium < high
 *  - dueDate must put tasks WITHOUT a date last, in both directions
 *  - title must sort case-insensitively (without a collation on the whole query)
 */
function computedSortPipeline(filter: Record<string, unknown>, sort: 'dueDate' | 'priority' | 'title', dir: 1 | -1, skip: number, limit: number): PipelineStage[] {
  const sortKeys = {
    dueDate: { _noDueDate: 1, dueDate: dir },
    priority: { _priorityRank: dir, createdAt: -1 },
    title: { _titleLower: dir },
  } as const;

  return [
    { $match: filter },
    {
      $addFields: {
        _priorityRank: PRIORITY_RANK,
        _noDueDate: { $cond: [{ $eq: [{ $ifNull: ['$dueDate', null] }, null] }, 1, 0] },
        _titleLower: { $toLower: '$title' },
      },
    },
    // _id as the last key keeps pagination stable when the other keys tie.
    { $sort: { ...sortKeys[sort], _id: dir } },
    { $skip: skip },
    { $limit: limit },
    // Drop the helper fields so they never leak into the response.
    { $project: { _priorityRank: 0, _noDueDate: 0, _titleLower: 0 } },
  ];
}

export async function getStats(userId: string, today = todayUtc()) {
  const owner = new Types.ObjectId(userId);
  const columns = await columnsFor(userId);
  const [grouped, overdue] = await Promise.all([
    Task.aggregate<{ _id: string; n: number }>([{ $match: { owner } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Task.countDocuments({ owner, status: { $nin: doneKeysOf(columns) }, dueDate: { $lt: today } }),
  ]);
  // Every current column gets a number (0 if empty), keyed by the column key.
  const byStatus = Object.fromEntries(columns.map((c) => [c.key, grouped.find((g) => g._id === c.key)?.n ?? 0]));
  const total = Object.values(byStatus).reduce((x, y) => x + y, 0);
  return { byStatus, total, overdue };
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

/** Rank that puts a task at the bottom of a column. */
async function endRank(ownerId: string, status: TaskStatus): Promise<number> {
  const last = await Task.findOne({ owner: ownerId, status }).sort({ rank: -1 }).select('rank').lean();
  return (last?.rank ?? 0) + RANK_STEP;
}

/** The column a status key points at, or a 400 if the user has no such column. */
async function requireColumn(userId: string, key: string) {
  const column = (await columnsFor(userId)).find((c) => c.key === key);
  if (!column) throw HttpError.badRequest(`There is no column "${key}" on your board`);
  return column;
}

export async function createTask(userId: string, input: CreateTaskInput) {
  const columns = await columnsFor(userId);
  const column = input.status ? columns.find((c) => c.key === input.status) : columns[0];
  if (!column) throw HttpError.badRequest(`There is no column "${input.status}" on your board`);

  const [number, rank] = await Promise.all([nextIssueNumber(userId), endRank(userId, column.key)]);
  const task = await Task.create({ ...input, status: column.key, owner: userId, number, rank, completedAt: column.isDone ? new Date() : null });
  return toTaskDTO(task);
}

export async function updateTask(userId: string, id: string, input: UpdateTaskInput) {
  const task = await findOwned(userId, id);
  // Changing status through the form (not a drag) lands the task at the bottom of its new column.
  if (input.status && input.status !== task.status) {
    const column = await requireColumn(userId, input.status);
    task.rank = await endRank(userId, column.key);
    task.completedAt = column.isDone ? new Date() : null;
  }
  task.set(input);
  await task.save();
  return toTaskDTO(task);
}

/** Renumber one column 1000, 2000, ... keeping its current order. Only runs when ranks run out of room. */
async function rebalanceColumn(ownerId: string, status: TaskStatus) {
  const rows = await Task.find({ owner: ownerId, status }).sort({ rank: 1, _id: 1 }).select('_id').lean();
  if (!rows.length) return;
  await Task.bulkWrite(
    rows.map((r, i) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { rank: (i + 1) * RANK_STEP } } } })),
  );
}

/**
 * Drag and drop: put the task into `status`, directly below `afterId` (or at the top when absent).
 * Both neighbours are looked up here, on the server, from the real data, so the result is right even if
 * the client has only loaded the first page of a long column.
 */
export async function moveTask(userId: string, id: string, input: MoveTaskInput) {
  const task = await findOwned(userId, id);
  const column = await requireColumn(userId, input.status);
  const status = column.key;
  const afterId = input.afterId && input.afterId !== id ? input.afterId : null;

  const compute = async (): Promise<number | null> => {
    const prev = afterId ? await Task.findOne({ _id: afterId, owner: userId, status }).select('rank').lean() : null;
    const nextQuery = { owner: userId, status, _id: { $ne: task._id }, ...(prev ? { rank: { $gt: prev.rank } } : {}) };
    const next = await Task.findOne(nextQuery).sort({ rank: 1, _id: 1 }).select('rank').lean();
    return rankBetween(prev?.rank, next?.rank);
  };

  let rank = await compute();
  if (rank === null) {
    await rebalanceColumn(userId, status);
    rank = await compute();
  }
  if (rank === null) throw HttpError.conflict('Could not place the task, please try again');

  // Entering a done column finishes the task (keeping the original time if it was already finished); leaving reopens it.
  task.completedAt = column.isDone ? (task.completedAt ?? new Date()) : null;
  task.status = status;
  task.rank = rank;
  await task.save();
  return toTaskDTO(task);
}

export async function deleteTask(userId: string, id: string) {
  const res = isValidObjectId(id) ? await Task.deleteOne({ _id: id, owner: userId }) : { deletedCount: 0 };
  if (res.deletedCount === 0) throw HttpError.notFound('Task not found');
}
