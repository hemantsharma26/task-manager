import { env } from '../../config/env.js';
import { DUE, ERROR_MESSAGE, RANK_STEP, DEFAULT_COLUMN_FALLBACK_KEY } from '../../constants/index.js';
import { cache, cacheKeys, type Cached } from '../../infra/cache/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { todayUtc } from '../../shared/utils/dates.js';
import { rankBetween } from '../../shared/utils/rank.js';
import { columnsOf } from '../columns/columns.service.js';
import type { TaskStatus } from './task.model.js';
import { buildFilter } from './tasks.filters.js';
import { toTaskDTO } from './tasks.mapper.js';
import type { CreateTaskInput, ListQuery, MoveTaskInput, UpdateTaskInput } from './tasks.schemas.js';
import { taskRepository } from './tasks.repository.js';

type ColumnInfo = { key: string; isDone: boolean };
const doneKeysOf = (columns: ColumnInfo[]) => columns.filter((c) => c.isDone).map((c) => c.key);

// Read side (cached) ---------------------------------------------------------------------------------

/**
 * One page of tasks. The cache key holds the user's version and a hash of the whole query, so a different filter,
 * sort or page is a different entry, and any write by this user makes every entry of theirs unreachable at once.
 */
export async function listTasks(userId: string, query: ListQuery): Promise<Cached<ReturnType<typeof buildPage>>> {
  const version = await cache.versionOf(userId);
  return cache.remember(cacheKeys.taskList(userId, version, query), env.CACHE_TTL_TASK_LIST_SECONDS, async () => {
    // Only the "overdue" filter needs to know which columns count as finished.
    const doneKeys = query.due === DUE.OVERDUE ? doneKeysOf(await columnsOf(userId)) : [];
    const filter = buildFilter(userId, query, doneKeys);
    const [items, total] = await Promise.all([taskRepository.findPage(filter, query), taskRepository.count(filter)]);
    return buildPage(items.map(toTaskDTO), total, query);
  });
}

function buildPage<T>(items: T[], total: number, query: Pick<ListQuery, 'page' | 'limit'>) {
  return { items, page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
}

export async function getStats(userId: string, today = todayUtc()) {
  const version = await cache.versionOf(userId);
  return cache.remember(cacheKeys.taskStats(userId, version, { today }), env.CACHE_TTL_TASK_STATS_SECONDS, async () => {
    const columns = await columnsOf(userId);
    const [grouped, overdue] = await Promise.all([taskRepository.groupByStatus(userId), taskRepository.countOverdue(userId, doneKeysOf(columns), today)]);
    // Every current column gets a number (0 if empty), keyed by the column key.
    const byStatus = Object.fromEntries(columns.map((c) => [c.key, grouped.find((g) => g._id === c.key)?.n ?? 0]));
    const total = Object.values(byStatus).reduce((x, y) => x + y, 0);
    return { byStatus, total, overdue };
  });
}

export async function getTask(userId: string, id: string) {
  return toTaskDTO(await requireOwned(userId, id));
}

// Write side (always invalidates the user's cached reads, after the database write has committed) ----

async function requireOwned(userId: string, id: string) {
  const task = await taskRepository.findOwned(userId, id);
  if (!task) throw HttpError.notFound(ERROR_MESSAGE.TASK_NOT_FOUND);
  return task;
}

/** The column a status key points at, or a 400 if the user has no such column. */
async function requireColumn(userId: string, key: TaskStatus) {
  const column = (await columnsOf(userId)).find((c) => c.key === key);
  if (!column) throw HttpError.badRequest(ERROR_MESSAGE.UNKNOWN_COLUMN(key));
  return column;
}

const endRank = async (userId: string, status: TaskStatus) => (await taskRepository.lastRank(userId, status)) + RANK_STEP;

export async function createTask(userId: string, input: CreateTaskInput) {
  const columns = await columnsOf(userId);
  const column = input.status ? columns.find((c) => c.key === input.status) : columns[0];
  if (!column) throw HttpError.badRequest(ERROR_MESSAGE.UNKNOWN_COLUMN(input.status ?? DEFAULT_COLUMN_FALLBACK_KEY));

  const [number, rank] = await Promise.all([taskRepository.nextIssueNumber(userId), endRank(userId, column.key)]);
  const task = await taskRepository.create({ ...input, status: column.key, owner: userId, number, rank, completedAt: column.isDone ? new Date() : null });
  await cache.invalidateUser(userId);
  return toTaskDTO(task);
}

export async function updateTask(userId: string, id: string, input: UpdateTaskInput) {
  const task = await requireOwned(userId, id);
  // Changing status through the form (not a drag) lands the task at the bottom of its new column.
  if (input.status && input.status !== task.status) {
    const column = await requireColumn(userId, input.status);
    task.rank = await endRank(userId, column.key);
    task.completedAt = column.isDone ? new Date() : null;
  }
  task.set(input);
  await task.save();
  await cache.invalidateUser(userId);
  return toTaskDTO(task);
}

/**
 * Drag and drop: put the task into a column, directly below `afterId` (or at the top when absent).
 * Both neighbours are looked up here, on the server, from the real data, so the result is right even if
 * the client has only loaded the first page of a long column.
 */
export async function moveTask(userId: string, id: string, input: MoveTaskInput) {
  const task = await requireOwned(userId, id);
  const column = await requireColumn(userId, input.status);
  const status = column.key;
  const afterId = input.afterId && input.afterId !== id ? input.afterId : null;

  const compute = async (): Promise<number | null> => {
    const prev = afterId ? await taskRepository.rankOf(userId, status, afterId) : undefined;
    const next = await taskRepository.nextRank(userId, status, task._id, prev);
    return rankBetween(prev, next);
  };

  let rank = await compute();
  if (rank === null) {
    await taskRepository.renumberColumn(userId, status);
    rank = await compute();
  }
  if (rank === null) throw HttpError.conflict(ERROR_MESSAGE.TASK_PLACEMENT_FAILED);

  // Entering a done column finishes the task (keeping the original time if it was already finished); leaving reopens it.
  task.completedAt = column.isDone ? (task.completedAt ?? new Date()) : null;
  task.status = status;
  task.rank = rank;
  await task.save();
  await cache.invalidateUser(userId);
  return toTaskDTO(task);
}

export async function deleteTask(userId: string, id: string) {
  if (!(await taskRepository.deleteOwned(userId, id))) throw HttpError.notFound(ERROR_MESSAGE.TASK_NOT_FOUND);
  await cache.invalidateUser(userId);
}
