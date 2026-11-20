import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRIORITIES, type DueFilter, type ListFilters, type SortField } from '../api/types';

const DUE: readonly DueFilter[] = ['overdue', 'today', 'week', 'none'];
const SORTS: readonly SortField[] = ['createdAt', 'dueDate', 'priority', 'title', 'rank'];
const FILTER_KEYS = ['status', 'priority', 'due', 'q', 'sort', 'order', 'page'];

const pick = <T extends string>(allowed: readonly T[], value: string | null): T | undefined => allowed.find((a) => a === value);

/**
 * Filters live in the URL, not in component state: a filtered view can be bookmarked or shared and the
 * back button steps through filter changes. Anything unrecognised in the URL falls back to a default
 * instead of being sent to the API.
 */
export function useTaskFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<ListFilters>(
    () => ({
      // A column key. Whether it still exists is the server's call (an unknown one just matches nothing).
      status: params.get('status')?.slice(0, 40) || undefined,
      priority: pick(PRIORITIES, params.get('priority')),
      due: pick(DUE, params.get('due')),
      q: (params.get('q') ?? '').slice(0, 100),
      sort: pick(SORTS, params.get('sort')) ?? 'createdAt',
      order: params.get('order') === 'asc' ? 'asc' : 'desc',
      page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
    }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<ListFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          // Any change to what is being shown goes back to the first page.
          if (!('page' in patch)) next.delete('page');
          if (next.get('page') === '1') next.delete('page');
          return next;
        },
        { replace: 'q' in patch },
      );
    },
    [setParams],
  );

  const reset = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        FILTER_KEYS.forEach((k) => next.delete(k));
        return next;
      }),
    [setParams],
  );

  const isFiltered = !!(filters.status || filters.priority || filters.due || filters.q);
  return { filters, update, reset, isFiltered };
}

/** The open issue is part of the URL too (?selected=<id>), so it can be linked to and survives a refresh. */
export function useSelectedIssue() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('selected');
  const select = useCallback(
    (id: string | null) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('selected', id);
        else next.delete('selected');
        return next;
      }),
    [setParams],
  );
  return { selected, select };
}
