import { Types, type PipelineStage } from 'mongoose';
import { COMPUTED_FIELD, DUE, NO_TIME_SORT_KEY, SORT, SORT_DIRECTION, WEEK_SPAN_DAYS, type SortField } from '../../constants/index.js';
import { addDays, todayUtc } from '../../shared/utils/dates.js';
import { escapeRegex } from '../../shared/utils/text.js';
import type { ListQuery } from './tasks.schemas.js';

type Filterable = Pick<ListQuery, 'status' | 'priority' | 'due' | 'q' | 'today' | 'nowTime'>;

/** Due before today, or due today at a time that has already passed. */
export function overdueCondition(today: string, nowTime?: string) {
  const before = { dueDate: { $lt: today } };
  // A task due today with no time is not overdue until the day is over; one with a time is, once that time has passed.
  return nowTime ? { $or: [before, { dueDate: today, dueTime: { $lt: nowTime } }] } : before;
}

/** The MongoDB filter for a list request. `doneKeys` are the user's "done" columns: finished tasks are never overdue. */
export function buildFilter(userId: string, q: Filterable, doneKeys: string[]) {
  const today = q.today ?? todayUtc();
  const filter: Record<string, unknown> = { owner: new Types.ObjectId(userId) };
  const all: Record<string, unknown>[] = [];

  if (q.status) filter.status = q.status;
  if (q.priority) filter.priority = q.priority;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    // The visible text of the note is searched, never its HTML markup. Tasks from before the note had a text field are matched on their plain description.
    all.push({ $or: [{ title: rx }, { descriptionText: rx }, { descriptionText: { $exists: false }, description: rx }] });
  }

  // YYYY-MM-DD strings compare correctly as plain strings.
  switch (q.due) {
    case DUE.OVERDUE:
      all.push(overdueCondition(today, q.nowTime));
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
  if (all.length) filter.$and = all;
  return filter;
}

/** Sorts that match an index can go straight through find(); the others need a computed key. */
export const usesIndexedSort = (sort: SortField) => sort === SORT.CREATED_AT || sort === SORT.RANK;

/** A task's weight is where its priority sits in the user's list (0 = least important); an unknown key sorts last. */
const priorityWeightExpr = (orderedKeys: string[]) => ({ $indexOfArray: [orderedKeys, '$priority'] });

/**
 * Aggregation is only used for the sorts that need a computed key:
 *  - priority must order by the user's own list (low < medium < high, or whatever they made)
 *  - dueDate must put tasks WITHOUT a date last, in both directions
 *  - title must sort case-insensitively (without a collation on the whole query)
 */
export function computedSortPipeline(filter: Record<string, unknown>, sort: SortField, dir: 1 | -1, skip: number, limit: number, priorityOrder: string[] = []): PipelineStage[] {
  const sortKeys: Partial<Record<SortField, Record<string, 1 | -1>>> = {
    // Within one date the earliest window comes first, and tasks without a time come last.
    [SORT.DUE_DATE]: { [COMPUTED_FIELD.NO_DUE_DATE]: SORT_DIRECTION.ASC, dueDate: dir, [COMPUTED_FIELD.NO_TIME]: SORT_DIRECTION.ASC, [COMPUTED_FIELD.TIME_OF_DAY]: dir },
    [SORT.PRIORITY]: { [COMPUTED_FIELD.PRIORITY_WEIGHT]: dir, createdAt: SORT_DIRECTION.DESC },
    [SORT.TITLE]: { [COMPUTED_FIELD.TITLE_LOWER]: dir },
  };

  return [
    { $match: filter },
    {
      $addFields: {
        [COMPUTED_FIELD.PRIORITY_WEIGHT]: priorityWeightExpr(priorityOrder),
        [COMPUTED_FIELD.NO_DUE_DATE]: { $cond: [{ $eq: [{ $ifNull: ['$dueDate', null] }, null] }, 1, 0] },
        [COMPUTED_FIELD.TITLE_LOWER]: { $toLower: '$title' },
        [COMPUTED_FIELD.NO_TIME]: { $cond: [{ $eq: [{ $ifNull: ['$dueTime', null] }, null] }, 1, 0] },
        [COMPUTED_FIELD.TIME_OF_DAY]: { $ifNull: ['$startTime', { $ifNull: ['$dueTime', NO_TIME_SORT_KEY] }] },
      },
    },
    // _id as the last key keeps pagination stable when the other keys tie.
    { $sort: { ...sortKeys[sort], _id: dir } },
    { $skip: skip },
    { $limit: limit },
    // Drop the helper fields so they never leak into the response.
    { $project: { [COMPUTED_FIELD.PRIORITY_WEIGHT]: 0, [COMPUTED_FIELD.NO_DUE_DATE]: 0, [COMPUTED_FIELD.TITLE_LOWER]: 0, [COMPUTED_FIELD.TIME_OF_DAY]: 0, [COMPUTED_FIELD.NO_TIME]: 0 } },
  ];
}
