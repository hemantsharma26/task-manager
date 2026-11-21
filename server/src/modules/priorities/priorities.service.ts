import { env } from '../../config/env.js';
import { ERROR_MESSAGE, MAX_PRIORITIES, MONGO, PRIORITY_KEY_FALLBACK, RANK_STEP } from '../../constants/index.js';
import { cache, cacheKeys, type Cached } from '../../infra/cache/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { rankBetween } from '../../shared/utils/rank.js';
import { sameName, slugify } from '../../shared/utils/text.js';
import { taskRepository } from '../tasks/tasks.repository.js';
import { toPriorityEntity, type PriorityEntity } from './priorities.mapper.js';
import { priorityRepository } from './priorities.repository.js';
import type { CreatePriorityInput, MovePriorityInput, UpdatePriorityInput } from './priorities.schemas.js';

// Read side ------------------------------------------------------------------------------------------

/** The user's priorities, least important first. A new account gets the three classic ones the first time anything asks. */
async function loadPriorities(ownerId: string): Promise<PriorityEntity[]> {
  let rows = await priorityRepository.findAll(ownerId);
  if (rows.length === 0) {
    try {
      await priorityRepository.insertDefaults(ownerId);
    } catch (err) {
      const e = err as { code?: number; writeErrors?: unknown[] };
      if (e.code !== MONGO.DUPLICATE_KEY_CODE && !e.writeErrors) throw err;
    }
    rows = await priorityRepository.findAll(ownerId);
  }
  return rows.map(toPriorityEntity);
}

export async function getPriorities(ownerId: string): Promise<Cached<PriorityEntity[]>> {
  const version = await cache.versionOf(ownerId);
  return cache.remember(cacheKeys.priorities(ownerId, version), env.CACHE_TTL_PRIORITIES_SECONDS, () => loadPriorities(ownerId));
}

export const prioritiesOf = async (ownerId: string) => (await getPriorities(ownerId)).value;

// Write side -----------------------------------------------------------------------------------------

export async function createPriority(ownerId: string, input: CreatePriorityInput) {
  const priorities = await prioritiesOf(ownerId);
  if (priorities.length >= MAX_PRIORITIES) throw HttpError.badRequest(ERROR_MESSAGE.PRIORITY_LIMIT(MAX_PRIORITIES));
  if (priorities.some((p) => sameName(p.name, input.name))) throw HttpError.conflict(ERROR_MESSAGE.PRIORITY_NAME_TAKEN(input.name));

  // A new priority starts as the MOST important one (the end of the list); drag or "move" it to change that.
  const taken = new Set(priorities.map((p) => p.key));
  const base = slugify(input.name, PRIORITY_KEY_FALLBACK);
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;

  const last = priorities[priorities.length - 1];
  await priorityRepository.create({ owner: ownerId, key, name: input.name, color: input.color, position: (last?.position ?? 0) + RANK_STEP });
  await cache.invalidateUser(ownerId);
}

async function requireOwned(ownerId: string, id: string) {
  const row = await priorityRepository.findOwned(ownerId, id);
  if (!row) throw HttpError.notFound(ERROR_MESSAGE.PRIORITY_NOT_FOUND);
  return row;
}

export async function updatePriority(ownerId: string, id: string, input: UpdatePriorityInput) {
  const row = await requireOwned(ownerId, id);
  if (input.name !== undefined) {
    const others = await priorityRepository.namesExcept(ownerId, row._id);
    if (others.some((p) => sameName(p.name, input.name!))) throw HttpError.conflict(ERROR_MESSAGE.PRIORITY_NAME_TAKEN(input.name));
    row.name = input.name;
  }
  if (input.color !== undefined) row.color = input.color;
  await row.save();
  await cache.invalidateUser(ownerId);
}

export async function movePriority(ownerId: string, id: string, input: MovePriorityInput) {
  const row = await requireOwned(ownerId, id);
  const afterId = input.afterId && input.afterId !== id ? input.afterId : null;

  const compute = async () => {
    const prev = afterId ? await priorityRepository.positionOf(ownerId, afterId) : undefined;
    const next = await priorityRepository.nextPosition(ownerId, row._id, prev);
    return rankBetween(prev, next);
  };

  let position = await compute();
  if (position === null) {
    await priorityRepository.renumber(ownerId);
    position = await compute();
  }
  if (position === null) throw HttpError.conflict(ERROR_MESSAGE.PRIORITY_PLACEMENT_FAILED);

  row.position = position;
  await row.save();
  await cache.invalidateUser(ownerId);
}

export async function deletePriority(ownerId: string, id: string, moveTo?: string) {
  const row = await requireOwned(ownerId, id);
  const priorities = await prioritiesOf(ownerId);
  if (priorities.length <= 1) throw HttpError.badRequest(ERROR_MESSAGE.PRIORITY_LAST);

  const count = await taskRepository.countWithPriority(ownerId, row.key);
  if (count > 0) {
    if (!moveTo) throw HttpError.conflict(ERROR_MESSAGE.PRIORITY_HAS_TASKS(count));
    if (!priorities.some((p) => p.key === moveTo && p.key !== row.key)) throw HttpError.badRequest(ERROR_MESSAGE.PRIORITY_BAD_TARGET);
    await taskRepository.reassignPriority(ownerId, row.key, moveTo);
  }

  await row.deleteOne();
  await cache.invalidateUser(ownerId);
}
