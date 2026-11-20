import { isValidObjectId, Types } from 'mongoose';
import { RANK_STEP, SORT, SORT_DIRECTION, TASK_FIELD } from '../../constants/index.js';
import { nextIssueNumber } from './counter.model.js';
import { Task, type TaskDoc, type TaskStatus } from './task.model.js';
import { computedSortPipeline, overdueCondition, usesIndexedSort } from './tasks.filters.js';
import type { TaskLike } from './tasks.mapper.js';
import type { ListQuery } from './tasks.schemas.js';

type Filter = Record<string, unknown>;
const asObjectId = (id: string) => new Types.ObjectId(id);

/** Everything that talks to the tasks collection. No business rules in here, and no caching. */
export const taskRepository = {
  nextIssueNumber,

  findPage(filter: Filter, query: Pick<ListQuery, 'sort' | 'order' | 'page' | 'limit'>, priorityOrder: string[] = []): Promise<TaskLike[]> {
    const dir = query.order === 'asc' ? SORT_DIRECTION.ASC : SORT_DIRECTION.DESC;
    const skip = (query.page - 1) * query.limit;
    // Sorts that match an index go straight through find(): no computed fields, no in-memory sort.
    if (usesIndexedSort(query.sort)) {
      return Task.find(filter).sort({ [query.sort]: dir, _id: dir }).skip(skip).limit(query.limit).lean<TaskLike[]>();
    }
    return Task.aggregate<TaskLike>(computedSortPipeline(filter, query.sort, dir, skip, query.limit, priorityOrder));
  },

  count: (filter: Filter) => Task.countDocuments(filter),

  groupByStatus: (ownerId: string) => Task.aggregate<{ _id: string; n: number }>([{ $match: { owner: asObjectId(ownerId) } }, { $group: { _id: `$${TASK_FIELD.STATUS}`, n: { $sum: 1 } } }]),

  countOverdue: (ownerId: string, doneKeys: string[], today: string, nowTime?: string) =>
    Task.countDocuments({ owner: asObjectId(ownerId), status: { $nin: doneKeys }, ...overdueCondition(today, nowTime) }),

  // A malformed id and a missing task look identical to the caller, so ids cannot be probed.
  async findOwned(ownerId: string, id: string): Promise<TaskDoc | null> {
    if (!isValidObjectId(id)) return null;
    return Task.findOne({ _id: id, owner: ownerId });
  },

  create: (data: Record<string, unknown>) => Task.create(data),

  async deleteOwned(ownerId: string, id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    return (await Task.deleteOne({ _id: id, owner: ownerId })).deletedCount > 0;
  },

  // ----- ordering inside a column
  async lastRank(ownerId: string, status: TaskStatus): Promise<number> {
    const last = await Task.findOne({ owner: ownerId, status }).sort({ [SORT.RANK]: SORT_DIRECTION.DESC }).select(SORT.RANK).lean();
    return last?.rank ?? 0;
  },

  async rankOf(ownerId: string, status: TaskStatus, id: string): Promise<number | undefined> {
    const row = await Task.findOne({ _id: id, owner: ownerId, status }).select(SORT.RANK).lean();
    return row?.rank;
  },

  /** The rank of the card that sits right after `afterRank` in the column (or the first card), ignoring `excludeId`. */
  async nextRank(ownerId: string, status: TaskStatus, excludeId: unknown, afterRank?: number): Promise<number | undefined> {
    const row = await Task.findOne({ owner: ownerId, status, _id: { $ne: excludeId }, ...(afterRank !== undefined ? { rank: { $gt: afterRank } } : {}) })
      .sort({ [SORT.RANK]: SORT_DIRECTION.ASC, _id: SORT_DIRECTION.ASC })
      .select(SORT.RANK)
      .lean();
    return row?.rank;
  },

  /** Renumber one column 1000, 2000, ... keeping its current order. Only runs when ranks run out of room. */
  async renumberColumn(ownerId: string, status: TaskStatus) {
    const rows = await Task.find({ owner: ownerId, status }).sort({ rank: SORT_DIRECTION.ASC, _id: SORT_DIRECTION.ASC }).select('_id').lean();
    if (!rows.length) return;
    await Task.bulkWrite(rows.map((r, i) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { rank: (i + 1) * RANK_STEP } } } })));
  },

  // ----- used when a priority is deleted (priorities module)
  countWithPriority: (ownerId: string, priority: string) => Task.countDocuments({ owner: ownerId, priority }),
  reassignPriority: (ownerId: string, from: string, to: string) => Task.updateMany({ owner: ownerId, priority: from }, { $set: { priority: to } }),

  // ----- used when a whole column is changed or removed (columns module)
  countInColumn: (ownerId: string, status: TaskStatus) => Task.countDocuments({ owner: ownerId, status }),

  /** Finished / reopened together with the column. */
  setCompletedInColumn(ownerId: string, status: TaskStatus, done: boolean) {
    return Task.updateMany({ owner: ownerId, status, completedAt: done ? null : { $ne: null } }, { $set: { completedAt: done ? new Date() : null } });
  },

  /** Moves every task of a column to the bottom of another one, keeping their order. */
  async moveColumnTasks(ownerId: string, from: TaskStatus, to: { key: TaskStatus; isDone: boolean }) {
    const startRank = (await this.lastRank(ownerId, to.key)) + RANK_STEP;
    const moving = await Task.find({ owner: ownerId, status: from }).sort({ rank: SORT_DIRECTION.ASC, _id: SORT_DIRECTION.ASC }).select('_id').lean();
    await Task.bulkWrite(
      moving.map((t, i) => ({
        updateOne: { filter: { _id: t._id }, update: { $set: { status: to.key, rank: startRank + i * RANK_STEP, completedAt: to.isDone ? new Date() : null } } },
      })),
    );
  },
};
