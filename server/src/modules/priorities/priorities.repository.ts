import { isValidObjectId } from 'mongoose';
import { DEFAULT_PRIORITIES, RANK_STEP, SORT_DIRECTION } from '../../constants/index.js';
import { Priority } from './priority.model.js';

const byPosition = { position: SORT_DIRECTION.ASC, _id: SORT_DIRECTION.ASC } as const;

export const priorityRepository = {
  findAll: (ownerId: string) => Priority.find({ owner: ownerId }).sort(byPosition).lean(),

  /** Two requests may race to create the defaults; the unique (owner, key) index makes the loser fail harmlessly. */
  insertDefaults: (ownerId: string) => Priority.insertMany(DEFAULT_PRIORITIES.map((p, i) => ({ ...p, owner: ownerId, position: (i + 1) * RANK_STEP })), { ordered: false }),

  create: (data: { owner: string; key: string; name: string; color: string; position: number }) => Priority.create(data),

  async findOwned(ownerId: string, id: string) {
    if (!isValidObjectId(id)) return null;
    return Priority.findOne({ _id: id, owner: ownerId });
  },

  namesExcept: (ownerId: string, excludeId: unknown) => Priority.find({ owner: ownerId, _id: { $ne: excludeId } }).select('name').lean(),

  async positionOf(ownerId: string, id: string): Promise<number | undefined> {
    return (await Priority.findOne({ _id: id, owner: ownerId }).select('position').lean())?.position;
  },

  async nextPosition(ownerId: string, excludeId: unknown, afterPosition?: number): Promise<number | undefined> {
    const row = await Priority.findOne({ owner: ownerId, _id: { $ne: excludeId }, ...(afterPosition !== undefined ? { position: { $gt: afterPosition } } : {}) })
      .sort(byPosition)
      .select('position')
      .lean();
    return row?.position;
  },

  async renumber(ownerId: string) {
    const rows = await Priority.find({ owner: ownerId }).sort(byPosition).select('_id').lean();
    await Priority.bulkWrite(rows.map((r, i) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { position: (i + 1) * RANK_STEP } } } })));
  },
};
