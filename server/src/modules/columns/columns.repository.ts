import { isValidObjectId } from 'mongoose';
import { DEFAULT_COLUMNS, RANK_STEP, SORT_DIRECTION } from '../../constants/index.js';
import { Column } from './column.model.js';

const byPosition = { position: SORT_DIRECTION.ASC, _id: SORT_DIRECTION.ASC } as const;

/** Everything that talks to the columns collection. */
export const columnRepository = {
  findAll: (ownerId: string) => Column.find({ owner: ownerId }).sort(byPosition).lean(),

  /** Inserts the default set. Two requests may race to do this; the unique (owner, key) index makes the loser fail harmlessly. */
  insertDefaults: (ownerId: string) =>
    Column.insertMany(
      DEFAULT_COLUMNS.map((c, i) => ({ ...c, owner: ownerId, position: (i + 1) * RANK_STEP })),
      { ordered: false },
    ),

  create: (data: { owner: string; key: string; name: string; isDone: boolean; color: string | null; position: number }) => Column.create(data),

  async findOwned(ownerId: string, id: string) {
    if (!isValidObjectId(id)) return null;
    return Column.findOne({ _id: id, owner: ownerId });
  },

  namesExcept: (ownerId: string, excludeId: unknown) => Column.find({ owner: ownerId, _id: { $ne: excludeId } }).select('name').lean(),

  async positionOf(ownerId: string, id: string): Promise<number | undefined> {
    const row = await Column.findOne({ _id: id, owner: ownerId }).select('position').lean();
    return row?.position;
  },

  async nextPosition(ownerId: string, excludeId: unknown, afterPosition?: number): Promise<number | undefined> {
    const row = await Column.findOne({ owner: ownerId, _id: { $ne: excludeId }, ...(afterPosition !== undefined ? { position: { $gt: afterPosition } } : {}) })
      .sort(byPosition)
      .select('position')
      .lean();
    return row?.position;
  },

  async renumber(ownerId: string) {
    const rows = await Column.find({ owner: ownerId }).sort(byPosition).select('_id').lean();
    await Column.bulkWrite(rows.map((r, i) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { position: (i + 1) * RANK_STEP } } } })));
  },
};
