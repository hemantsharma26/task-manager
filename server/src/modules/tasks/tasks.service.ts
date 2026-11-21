import { appUrl, env } from '../../config/env.js';
import { ASSIGNEE_FILTER, DEFAULT_COLUMN_FALLBACK_KEY, issueKey, DEFAULT_PRIORITY_KEY, DUE, ERROR_MESSAGE, RANK_STEP, RICH_TEXT_LIMITS, SORT, VALIDATION_MESSAGE } from '../../constants/index.js';
import { cache, cacheKeys, type Cached } from '../../infra/cache/index.js';
import { assignmentMail, sendMail } from '../../infra/mail/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { cleanNote } from '../../shared/utils/html.js';
import { removeStoredFiles } from '../attachments/attachments.storage.js';
import { todayUtc } from '../../shared/utils/dates.js';
import { rankBetween } from '../../shared/utils/rank.js';
import { columnsOf } from '../columns/columns.service.js';
import { prioritiesOf } from '../priorities/priorities.service.js';
import { assignableIds, boardLabel, peopleByIds } from '../team/team.service.js';
import type { TaskStatus } from './task.model.js';
import { buildFilter } from './tasks.filters.js';
import { toTaskDTO, type TaskLike } from './tasks.mapper.js';
import type { CreateTaskInput, ListQuery, MoveTaskInput, UpdateTaskInput } from './tasks.schemas.js';
import { taskRepository } from './tasks.repository.js';

/** Who is making a change (for emails like "Asha assigned you ..."). */
export interface Actor {
  id: string;
  name: string;
}

type ColumnInfo = { key: string; isDone: boolean };
const doneKeysOf = (columns: ColumnInfo[]) => columns.filter((c) => c.isDone).map((c) => c.key);

/** Tasks as the API shows them: with each assignee's name and email filled in (one lookup for the whole page). */
export async function presentTasks(docs: TaskLike[]) {
  const ids = [...new Set(docs.flatMap((d) => (d.assignees ?? []).map(String)))];
  const people = ids.length ? await peopleByIds(ids) : undefined;
  return docs.map((d) => toTaskDTO(d, people));
}

export const presentTask = async (doc: TaskLike) => (await presentTasks([doc]))[0]!;

// Read side (cached) ---------------------------------------------------------------------------------

/**
 * One page of tasks. The cache key holds the user's version and a hash of the whole query, so a different filter,
 * sort or page is a different entry, and any write by this user makes every entry of theirs unreachable at once.
 */
export async function listTasks(userId: string, rawQuery: ListQuery, viewerId: string = userId): Promise<Cached<ReturnType<typeof buildPage>>> {
  // "Assigned to me" means a different person for every viewer, so it is turned into their id before it can become part of a cache key.
  const query = rawQuery.assignee === ASSIGNEE_FILTER.ME ? { ...rawQuery, assignee: viewerId } : rawQuery;
  const version = await cache.versionOf(userId);
  return cache.remember(cacheKeys.taskList(userId, version, query), env.CACHE_TTL_TASK_LIST_SECONDS, async () => {
    // Only the "overdue" filter needs to know which columns count as finished.
    const doneKeys = query.due === DUE.OVERDUE ? doneKeysOf(await columnsOf(userId)) : [];
    const filter = buildFilter(userId, query, doneKeys);
    // Sorting by priority follows the user's own order of priorities, so that list is needed for it (and only for it).
    const priorityOrder = query.sort === SORT.PRIORITY ? (await prioritiesOf(userId)).map((p) => p.key) : [];
    const [items, total] = await Promise.all([taskRepository.findPage(filter, query, priorityOrder), taskRepository.count(filter)]);
    return buildPage(await presentTasks(items), total, query);
  });
}

function buildPage<T>(items: T[], total: number, query: Pick<ListQuery, 'page' | 'limit'>) {
  return { items, page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
}

export async function getStats(userId: string, today = todayUtc(), nowTime?: string) {
  const version = await cache.versionOf(userId);
  return cache.remember(cacheKeys.taskStats(userId, version, { today, nowTime }), env.CACHE_TTL_TASK_STATS_SECONDS, async () => {
    const columns = await columnsOf(userId);
    const [grouped, overdue] = await Promise.all([taskRepository.groupByStatus(userId), taskRepository.countOverdue(userId, doneKeysOf(columns), today, nowTime)]);
    // Every current column gets a number (0 if empty), keyed by the column key.
    const byStatus = Object.fromEntries(columns.map((c) => [c.key, grouped.find((g) => g._id === c.key)?.n ?? 0]));
    const total = Object.values(byStatus).reduce((x, y) => x + y, 0);
    return { byStatus, total, overdue };
  });
}

export async function getTask(userId: string, id: string) {
  return presentTask(await requireOwned(userId, id));
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

/** The priority a new task gets when none is given: Medium if it still exists, otherwise the middle one. */
async function defaultPriority(userId: string) {
  const priorities = await prioritiesOf(userId);
  return (priorities.find((p) => p.key === DEFAULT_PRIORITY_KEY) ?? priorities[Math.floor(priorities.length / 2)])!.key;
}

async function requirePriority(userId: string, key: string) {
  if (!(await prioritiesOf(userId)).some((p) => p.key === key)) throw HttpError.badRequest(ERROR_MESSAGE.UNKNOWN_PRIORITY(key));
  return key;
}

/** Cleans a note and checks how much visible text it holds. */
function note(raw: string) {
  const { html, text } = cleanNote(raw);
  if (text.length > RICH_TEXT_LIMITS.TEXT_MAX) throw HttpError.badRequest(VALIDATION_MESSAGE.NOTE_TOO_LONG(RICH_TEXT_LIMITS.TEXT_MAX));
  return { description: html, descriptionText: text };
}

/** Only the board's owner and the people who joined it can be given a task. */
async function requireAssignable(workspaceId: string, ids: string[]) {
  if (ids.length === 0) return;
  const allowed = await assignableIds(workspaceId);
  if (ids.some((id) => !allowed.has(id))) throw HttpError.badRequest(ERROR_MESSAGE.ASSIGNEE_NOT_ON_TEAM);
}

const dueText = (t: { dueDate: string | null; dueTime: string | null; startTime: string | null }) =>
  !t.dueDate ? null : `${t.dueDate}${t.dueTime ? (t.startTime ? ` ${t.startTime}-${t.dueTime}` : ` by ${t.dueTime}`) : ''}`;

/** Tells the people who were just given a task. Never the person who did the assigning, and never blocks the request. */
async function notifyAssigned(workspaceId: string, actor: Actor, task: { id: string; number: number; title: string; dueDate: string | null; dueTime: string | null; startTime: string | null }, added: string[]) {
  const recipients = added.filter((id) => id !== actor.id);
  if (recipients.length === 0) return;
  const [people, board] = await Promise.all([peopleByIds(recipients), boardLabel(workspaceId)]);
  for (const person of people.values()) {
    void sendMail(assignmentMail({ to: person.email, assignerName: actor.name, taskKey: issueKey(task.number), taskTitle: task.title, projectName: board, dueText: dueText(task), url: `${appUrl}/?board=${workspaceId}&task=${task.id}` }));
  }
}

const endRank = async (userId: string, status: TaskStatus) => (await taskRepository.lastRank(userId, status)) + RANK_STEP;

export async function createTask(userId: string, input: CreateTaskInput, actor: Actor = { id: userId, name: '' }) {
  const columns = await columnsOf(userId);
  const column = input.status ? columns.find((c) => c.key === input.status) : columns[0];
  if (!column) throw HttpError.badRequest(ERROR_MESSAGE.UNKNOWN_COLUMN(input.status ?? DEFAULT_COLUMN_FALLBACK_KEY));

  await requireAssignable(userId, input.assignees);
  const priority = input.priority ? await requirePriority(userId, input.priority) : await defaultPriority(userId);
  const [number, rank] = await Promise.all([taskRepository.nextIssueNumber(userId), endRank(userId, column.key)]);
  const task = await taskRepository.create({ ...input, ...note(input.description), status: column.key, priority, owner: userId, number, rank, completedAt: column.isDone ? new Date() : null });
  await cache.invalidateUser(userId);
  void notifyAssigned(userId, actor, { id: String(task._id), number, title: task.title, dueDate: task.dueDate, dueTime: task.dueTime, startTime: task.startTime }, input.assignees);
  return presentTask(task);
}

export async function updateTask(userId: string, id: string, input: UpdateTaskInput, actor: Actor = { id: userId, name: '' }) {
  const task = await requireOwned(userId, id);
  // Changing status through the form (not a drag) lands the task at the bottom of its new column.
  if (input.status && input.status !== task.status) {
    const column = await requireColumn(userId, input.status);
    task.rank = await endRank(userId, column.key);
    task.completedAt = column.isDone ? new Date() : null;
  }
  if (input.priority) await requirePriority(userId, input.priority);
  const before = task.assignees.map(String);
  if (input.assignees) await requireAssignable(userId, input.assignees);

  // A time only means something on a date: clearing the date clears the time, and a time without a date is refused.
  const dueDate = input.dueDate === undefined ? task.dueDate : input.dueDate;
  const dueTime = dueDate === null ? null : input.dueTime === undefined ? task.dueTime : input.dueTime;
  if (input.dueTime && dueDate === null) throw HttpError.badRequest(VALIDATION_MESSAGE.TIME_NEEDS_DATE);
  // The window: a start needs an end, and the end must come after it. Removing the end removes the start with it.
  const startTime = dueTime === null ? null : input.startTime === undefined ? task.startTime : input.startTime;
  if (input.startTime && dueTime === null) throw HttpError.badRequest(VALIDATION_MESSAGE.START_NEEDS_END);
  if (startTime !== null && dueTime !== null && startTime >= dueTime) throw HttpError.badRequest(VALIDATION_MESSAGE.END_AFTER_START);

  task.set({ ...input, ...(input.description !== undefined ? note(input.description) : {}), dueDate, dueTime, startTime });
  await task.save();
  await cache.invalidateUser(userId);
  if (input.assignees) void notifyAssigned(userId, actor, { id: String(task._id), number: task.number, title: task.title, dueDate: task.dueDate, dueTime: task.dueTime, startTime: task.startTime }, input.assignees.filter((a) => !before.includes(a)));
  return presentTask(task);
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
  return presentTask(task);
}

export async function deleteTask(userId: string, id: string) {
  const task = await taskRepository.findOwned(userId, id);
  if (!task || !(await taskRepository.deleteOwned(userId, id))) throw HttpError.notFound(ERROR_MESSAGE.TASK_NOT_FOUND);
  // The files go with the task, so nothing is left behind on disk.
  await removeStoredFiles(userId, task.attachments.map((a) => a.storedName));
  await cache.invalidateUser(userId);
}
