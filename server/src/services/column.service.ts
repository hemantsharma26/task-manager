import { isValidObjectId } from 'mongoose';
import { Column, DEFAULT_COLUMNS, MAX_COLUMNS, type IColumn } from '../models/Column.js';
import { Task } from '../models/Task.js';
import type { CreateColumnInput, MoveColumnInput, UpdateColumnInput } from '../schemas/column.js';
import { HttpError } from '../utils/httpError.js';
import { RANK_STEP, rankBetween } from '../utils/rank.js';

type ColumnLike = Pick<IColumn, 'key' | 'name' | 'isDone'> & { _id: unknown };

export const toColumnDTO = (c: ColumnLike) => ({ id: String(c._id), key: c.key, name: c.name, isDone: c.isDone });

/**
 * A user's columns in board order. The first time anything asks, the default set is created, so accounts that
 * existed before columns became editable simply get the same five they always had.
 */
export async function columnsFor(ownerId: string) {
  const existing = await Column.find({ owner: ownerId }).sort({ position: 1, _id: 1 }).lean();
  if (existing.length > 0) return existing;

  try {
    await Column.insertMany(
      DEFAULT_COLUMNS.map((c, i) => ({ ...c, owner: ownerId, position: (i + 1) * RANK_STEP })),
      { ordered: false },
    );
  } catch (err) {
    // Two requests can race to create the defaults; the unique (owner, key) index makes the loser fail harmlessly.
    if ((err as { code?: number }).code !== 11000 && !(err as { writeErrors?: unknown[] }).writeErrors) throw err;
  }
  return Column.find({ owner: ownerId }).sort({ position: 1, _id: 1 }).lean();
}

export async function listColumns(ownerId: string) {
  return (await columnsFor(ownerId)).map(toColumnDTO);
}

/** Turns a name into a key: "QA review!" -> "qa_review". */
function slugify(name: string) {
  const s = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
  return s || 'column';
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function createColumn(ownerId: string, input: CreateColumnInput) {
  const columns = await columnsFor(ownerId);
  if (columns.length >= MAX_COLUMNS) throw HttpError.badRequest(`You can have at most ${MAX_COLUMNS} columns`);
  if (columns.some((c) => sameName(c.name, input.name))) throw HttpError.conflict(`There is already a column called "${input.name}"`);

  // Keys never change after creation, so a renamed column keeps its tasks. A deleted column's key can be reused.
  const taken = new Set(columns.map((c) => c.key));
  const base = slugify(input.name);
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;

  const last = columns[columns.length - 1];
  const col = await Column.create({ owner: ownerId, key, name: input.name, isDone: input.isDone, position: (last?.position ?? 0) + RANK_STEP });
  return toColumnDTO(col);
}

async function findOwned(ownerId: string, id: string) {
  if (!isValidObjectId(id)) throw HttpError.notFound('Column not found');
  const col = await Column.findOne({ _id: id, owner: ownerId });
  if (!col) throw HttpError.notFound('Column not found');
  return col;
}

export async function updateColumn(ownerId: string, id: string, input: UpdateColumnInput) {
  const col = await findOwned(ownerId, id);

  if (input.name !== undefined) {
    const others = await Column.find({ owner: ownerId, _id: { $ne: col._id } }).select('name').lean();
    if (others.some((c) => sameName(c.name, input.name!))) throw HttpError.conflict(`There is already a column called "${input.name}"`);
    col.name = input.name;
  }

  const doneChanged = input.isDone !== undefined && input.isDone !== col.isDone;
  if (input.isDone !== undefined) col.isDone = input.isDone;
  await col.save();

  // Tasks already in the column follow it: they become finished (or reopened) together.
  if (doneChanged) {
    await Task.updateMany(
      { owner: ownerId, status: col.key, completedAt: col.isDone ? null : { $ne: null } },
      { $set: { completedAt: col.isDone ? new Date() : null } },
    );
  }
  return toColumnDTO(col);
}

export async function moveColumn(ownerId: string, id: string, input: MoveColumnInput) {
  const col = await findOwned(ownerId, id);
  const afterId = input.afterId && input.afterId !== id ? input.afterId : null;

  const compute = async () => {
    const prev = afterId ? await Column.findOne({ _id: afterId, owner: ownerId }).select('position').lean() : null;
    const next = await Column.findOne({ owner: ownerId, _id: { $ne: col._id }, ...(prev ? { position: { $gt: prev.position } } : {}) })
      .sort({ position: 1, _id: 1 })
      .select('position')
      .lean();
    return rankBetween(prev?.position, next?.position);
  };

  let position = await compute();
  if (position === null) {
    const rows = await Column.find({ owner: ownerId }).sort({ position: 1, _id: 1 }).select('_id').lean();
    await Column.bulkWrite(rows.map((r, i) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { position: (i + 1) * RANK_STEP } } } })));
    position = await compute();
  }
  if (position === null) throw HttpError.conflict('Could not place the column, please try again');

  col.position = position;
  await col.save();
  return listColumns(ownerId);
}

export async function deleteColumn(ownerId: string, id: string, moveTo?: string) {
  const col = await findOwned(ownerId, id);
  const columns = await columnsFor(ownerId);
  if (columns.length <= 1) throw HttpError.badRequest('A board needs at least one column');

  const count = await Task.countDocuments({ owner: ownerId, status: col.key });
  if (count > 0) {
    if (!moveTo) throw HttpError.conflict(`This column has ${count} ${count === 1 ? 'task' : 'tasks'}. Choose a column to move them to.`);
    const target = columns.find((c) => c.key === moveTo && c.key !== col.key);
    if (!target) throw HttpError.badRequest('Pick a different, existing column to move the tasks to');

    // Keep their order, and put them below whatever is already in the target column.
    const last = await Task.findOne({ owner: ownerId, status: target.key }).sort({ rank: -1 }).select('rank').lean();
    const moving = await Task.find({ owner: ownerId, status: col.key }).sort({ rank: 1, _id: 1 }).select('_id').lean();
    const start = (last?.rank ?? 0) + RANK_STEP;
    await Task.bulkWrite(
      moving.map((t, i) => ({
        updateOne: { filter: { _id: t._id }, update: { $set: { status: target.key, rank: start + i * RANK_STEP, completedAt: target.isDone ? new Date() : null } } },
      })),
    );
  }

  await col.deleteOne();
}
