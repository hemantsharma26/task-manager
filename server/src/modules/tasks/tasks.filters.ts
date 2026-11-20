import { Types, type PipelineStage } from 'mongoose';
import { COMPUTED_FIELD, DUE, PRIORITY, PRIORITY_WEIGHT, SORT, SORT_DIRECTION, WEEK_SPAN_DAYS, type SortField } from '../../constants/index.js';
import { addDays, todayUtc } from '../../shared/utils/dates.js';
import { escapeRegex } from '../../shared/utils/text.js';
import type { ListQuery } from './tasks.schemas.js';

type Filterable = Pick<ListQuery, 'status' | 'priority' | 'due' | 'q' | 'today'>;

/** The MongoDB filter for a list request. `doneKeys` are the user's "done" columns: finished tasks are never overdue. */
export function buildFilter(userId: string, q: Filterable, doneKeys: string[]) {
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
    case DUE.OVERDUE:
      filter.dueDate = { $lt: today };
      filter.status = q.status ?? { $nin: doneKeys };
      break;
    case DUE.TODAY:
      filter.dueDate = today;
      break;
    case DUE.WEEK:
      filter.dueDate = { $gte: today, $lte: addDays(today, WEEK_SPAN_DAYS) };
      break;
    case DUE.NONE:
      filter.dueDate = null;
      break;
  }
  return filter;
}

/** Sorts that match an index can go straight through find(); the others need a computed key. */
export const usesIndexedSort = (sort: SortField) => sort === SORT.CREATED_AT || sort === SORT.RANK;

const PRIORITY_WEIGHT_EXPR = {
  $switch: {
    branches: [
      { case: { $eq: ['$priority', PRIORITY.HIGH] }, then: PRIORITY_WEIGHT[PRIORITY.HIGH] },
      { case: { $eq: ['$priority', PRIORITY.MEDIUM] }, then: PRIORITY_WEIGHT[PRIORITY.MEDIUM] },
    ],
    default: PRIORITY_WEIGHT[PRIORITY.LOW],
  },
};

/**
 * Aggregation is only used for the sorts that need a computed key:
 *  - priority is a string but must order low < medium < high
 *  - dueDate must put tasks WITHOUT a date last, in both directions
 *  - title must sort case-insensitively (without a collation on the whole query)
 */
export function computedSortPipeline(filter: Record<string, unknown>, sort: SortField, dir: 1 | -1, skip: number, limit: number): PipelineStage[] {
  const sortKeys: Partial<Record<SortField, Record<string, 1 | -1>>> = {
    [SORT.DUE_DATE]: { [COMPUTED_FIELD.NO_DUE_DATE]: SORT_DIRECTION.ASC, dueDate: dir },
    [SORT.PRIORITY]: { [COMPUTED_FIELD.PRIORITY_WEIGHT]: dir, createdAt: SORT_DIRECTION.DESC },
    [SORT.TITLE]: { [COMPUTED_FIELD.TITLE_LOWER]: dir },
  };

  return [
    { $match: filter },
    {
      $addFields: {
        [COMPUTED_FIELD.PRIORITY_WEIGHT]: PRIORITY_WEIGHT_EXPR,
        [COMPUTED_FIELD.NO_DUE_DATE]: { $cond: [{ $eq: [{ $ifNull: ['$dueDate', null] }, null] }, 1, 0] },
        [COMPUTED_FIELD.TITLE_LOWER]: { $toLower: '$title' },
      },
    },
    // _id as the last key keeps pagination stable when the other keys tie.
    { $sort: { ...sortKeys[sort], _id: dir } },
    { $skip: skip },
    { $limit: limit },
    // Drop the helper fields so they never leak into the response.
    { $project: { [COMPUTED_FIELD.PRIORITY_WEIGHT]: 0, [COMPUTED_FIELD.NO_DUE_DATE]: 0, [COMPUTED_FIELD.TITLE_LOWER]: 0 } },
  ];
}
