import { env } from '../../config/env.js';
import { ERROR_MESSAGE, MAX_COLUMNS, MONGO, RANK_STEP } from '../../constants/index.js';
import { cache, cacheKeys, type Cached } from '../../infra/cache/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { rankBetween } from '../../shared/utils/rank.js';
import { sameName, slugify } from '../../shared/utils/text.js';
import { taskRepository } from '../tasks/tasks.repository.js';
import { columnRepository } from './columns.repository.js';
import { toColumnEntity, type ColumnEntity } from './columns.mapper.js';
import type { CreateColumnInput, MoveColumnInput, UpdateColumnInput } from './columns.schemas.js';

// Read side ------------------------------------------------------------------------------------------

/**
 * A user's columns in board order. The first time anything asks, the default set is created, so accounts that
 * existed before columns became editable simply get the same five they always had.
 */
async function loadColumns(ownerId: string): Promise<ColumnEntity[]> {
  let rows = await columnRepository.findAll(ownerId);
  if (rows.length === 0) {
    try {
      await columnRepository.insertDefaults(ownerId);
    } catch (err) {
      const e = err as { code?: number; writeErrors?: unknown[] };
      if (e.code !== MONGO.DUPLICATE_KEY_CODE && !e.writeErrors) throw err;
    }
    rows = await columnRepository.findAll(ownerId);
  }
  return rows.map(toColumnEntity);
}

/** The columns, from the cache when possible. Every task operation needs them, so this is the hottest read. */
export async function getColumns(ownerId: string): Promise<Cached<ColumnEntity[]>> {
  const version = await cache.versionOf(ownerId);
  return cache.remember(cacheKeys.columns(ownerId, version), env.CACHE_TTL_COLUMNS_SECONDS, () => loadColumns(ownerId));
}

export const columnsOf = async (ownerId: string) => (await getColumns(ownerId)).value;

// Write side -----------------------------------------------------------------------------------------

export async function createColumn(ownerId: string, input: CreateColumnInput) {
  const columns = await columnsOf(ownerId);
  if (columns.length >= MAX_COLUMNS) throw HttpError.badRequest(ERROR_MESSAGE.COLUMN_LIMIT(MAX_COLUMNS));
  if (columns.some((c) => sameName(c.name, input.name))) throw HttpError.conflict(ERROR_MESSAGE.COLUMN_NAME_TAKEN(input.name));

  // Keys never change after creation, so a renamed column keeps its tasks. A deleted column's key can be reused.
  const taken = new Set(columns.map((c) => c.key));
  const base = slugify(input.name);
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;

  const last = columns[columns.length - 1];
  await columnRepository.create({ owner: ownerId, key, name: input.name, isDone: input.isDone, color: input.color, position: (last?.position ?? 0) + RANK_STEP });
  await cache.invalidateUser(ownerId);
}

async function requireOwned(ownerId: string, id: string) {
  const col = await columnRepository.findOwned(ownerId, id);
  if (!col) throw HttpError.notFound(ERROR_MESSAGE.COLUMN_NOT_FOUND);
  return col;
}

export async function updateColumn(ownerId: string, id: string, input: UpdateColumnInput) {
  const col = await requireOwned(ownerId, id);

  if (input.name !== undefined) {
    const others = await columnRepository.namesExcept(ownerId, col._id);
    if (others.some((c) => sameName(c.name, input.name!))) throw HttpError.conflict(ERROR_MESSAGE.COLUMN_NAME_TAKEN(input.name));
    col.name = input.name;
  }

  if (input.color !== undefined) col.color = input.color;

  const doneChanged = input.isDone !== undefined && input.isDone !== col.isDone;
  if (input.isDone !== undefined) col.isDone = input.isDone;
  await col.save();

  // Tasks already in the column follow it: they become finished (or reopened) together.
  if (doneChanged) await taskRepository.setCompletedInColumn(ownerId, col.key, col.isDone);
  await cache.invalidateUser(ownerId);
}

export async function moveColumn(ownerId: string, id: string, input: MoveColumnInput) {
  const col = await requireOwned(ownerId, id);
  const afterId = input.afterId && input.afterId !== id ? input.afterId : null;

  const compute = async () => {
    const prev = afterId ? await columnRepository.positionOf(ownerId, afterId) : undefined;
    const next = await columnRepository.nextPosition(ownerId, col._id, prev);
    return rankBetween(prev, next);
  };

  let position = await compute();
  if (position === null) {
    await columnRepository.renumber(ownerId);
    position = await compute();
  }
  if (position === null) throw HttpError.conflict(ERROR_MESSAGE.COLUMN_PLACEMENT_FAILED);

  col.position = position;
  await col.save();
  await cache.invalidateUser(ownerId);
}

export async function deleteColumn(ownerId: string, id: string, moveTo?: string) {
  const col = await requireOwned(ownerId, id);
  const columns = await columnsOf(ownerId);
  if (columns.length <= 1) throw HttpError.badRequest(ERROR_MESSAGE.COLUMN_LAST);

  const count = await taskRepository.countInColumn(ownerId, col.key);
  if (count > 0) {
    if (!moveTo) throw HttpError.conflict(ERROR_MESSAGE.COLUMN_HAS_TASKS(count));
    const target = columns.find((c) => c.key === moveTo && c.key !== col.key);
    if (!target) throw HttpError.badRequest(ERROR_MESSAGE.COLUMN_BAD_TARGET);
    await taskRepository.moveColumnTasks(ownerId, col.key, target);
  }

  await col.deleteOne();
  await cache.invalidateUser(ownerId);
}

