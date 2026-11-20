import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { todayLocal } from '../lib/dates';
import { appendToColumnCaches, findTaskInCaches, moveTaskBetweenColumnCaches, patchTaskInCaches, removeTaskFromCaches, restoreSnapshot, takeSnapshot, TASKS_KEY } from './cache';
import { http } from './http';
import type { CommonFilters, ListFilters, Task, TaskInput, TaskPage, TaskStats, TaskStatus } from './types';

export const COLUMN_PAGE_SIZE = 20;
export const LIST_PAGE_SIZE = 15;

const keys = {
  column: (status: TaskStatus, f: CommonFilters, today: string) => ['tasks', 'column', status, f, today] as const,
  list: (f: ListFilters, today: string) => ['tasks', 'list', f, today] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  stats: (today: string) => ['stats', today] as const,
};

function params(base: Record<string, string>, f: CommonFilters) {
  const p = new URLSearchParams(base);
  if (f.priority) p.set('priority', f.priority);
  if (f.due) p.set('due', f.due);
  if (f.q) p.set('q', f.q);
  return p;
}

/** One board column. Loads COLUMN_PAGE_SIZE cards, then more on demand, always in rank order. */
export function useColumn(status: TaskStatus, filters: CommonFilters) {
  const today = todayLocal();
  return useInfiniteQuery({
    queryKey: keys.column(status, filters, today),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      http<TaskPage>(
        `/tasks?${params({ status, sort: 'rank', order: 'asc', limit: String(COLUMN_PAGE_SIZE), page: String(pageParam), today }, filters)}`,
        { signal },
      ),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    // Typing in search or changing a filter keeps the old cards on screen (dimmed) until the new ones arrive,
    // instead of flashing skeletons.
    placeholderData: keepPreviousData,
    select: (data: InfiniteData<TaskPage>) => ({
      total: data.pages[0]?.total ?? 0,
      // Pages are offsets, so a card moved while paging can show up twice. Keep the first copy.
      items: [...new Map(data.pages.flatMap((p) => p.items).map((t) => [t.id, t])).values()],
    }),
  });
}

export function useTasks(filters: ListFilters) {
  const today = todayLocal();
  return useQuery({
    queryKey: keys.list(filters, today),
    queryFn: ({ signal }) => {
      const p = params({ sort: filters.sort, order: filters.order, page: String(filters.page), limit: String(LIST_PAGE_SIZE), today }, filters);
      if (filters.status) p.set('status', filters.status);
      return http<TaskPage>(`/tasks?${p}`, { signal });
    },
    // Keep showing the old page while the next one loads, so sorting and paging never flash empty.
    placeholderData: keepPreviousData,
  });
}

export function useTask(id: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    enabled: !!id,
    // Opening a card from the board is instant: it already has the data in the cache.
    initialData: () => (id ? findTaskInCaches(qc, id) : undefined),
    queryFn: ({ signal }) => http<{ task: Task }>(`/tasks/${id}`, { signal }).then((r) => r.task),
  });
}

export function useStats() {
  const today = todayLocal();
  return useQuery({
    queryKey: keys.stats(today),
    queryFn: ({ signal }) => http<TaskStats>(`/tasks/stats?today=${today}`, { signal }),
  });
}

/**
 * Refetch only what a change can actually have affected. Queries nobody is looking at are just marked
 * stale (and refetched when next shown), so nothing is requested for screens that are not open.
 */
function useRefresh() {
  const qc = useQueryClient();
  return {
    /** Everything: used after create/delete, where counts and every column can change. */
    all: () => Promise.all([qc.invalidateQueries({ queryKey: TASKS_KEY }), qc.invalidateQueries({ queryKey: ['stats'] })]),
    /** Only the board columns for these statuses (plus the list, which spans all of them) and the counts. */
    columns: (statuses: TaskStatus[], withStats: boolean) =>
      Promise.all([
        qc.invalidateQueries({
          predicate: ({ queryKey: k }) => k[0] === 'tasks' && (k[1] === 'list' || (k[1] === 'column' && statuses.includes(k[2] as TaskStatus))),
        }),
        withStats ? qc.invalidateQueries({ queryKey: ['stats'] }) : undefined,
      ]),
  };
}

export function useCreateTask() {
  const qc = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: Partial<TaskInput> & { title: string }) => http<{ task: Task }>('/tasks', { method: 'POST', body: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const snapshot = takeSnapshot(qc);
      const status = input.status ?? 'todo';
      const now = new Date().toISOString();
      // The card shows up at once, greyed out, with a placeholder key. The server's answer (real key, real position)
      // replaces it a moment later.
      appendToColumnCaches(qc, status, {
        id: `temp-${Date.now()}`,
        number: 0,
        key: 'TM-…',
        title: input.title,
        description: input.description ?? '',
        status,
        priority: input.priority ?? 'medium',
        dueDate: input.dueDate ?? null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      return { snapshot };
    },
    onError: (_e, _v, ctx) => restoreSnapshot(qc, ctx?.snapshot),
    onSettled: (_res, _err, input) => refresh.columns([input.status ?? 'todo'], true),
  });
}

type Changes = Partial<TaskInput>;

export function useUpdateTask() {
  const qc = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Changes }) => http<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: changes }),
    onMutate: async ({ id, changes }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const snapshot = takeSnapshot(qc);
      const before = findTaskInCaches(qc, id);
      // A status change moves the card to the other column straight away, instead of leaving it behind until the refetch.
      if (before && changes.status && changes.status !== before.status) moveTaskBetweenColumnCaches(qc, before, changes.status);
      patchTaskInCaches(qc, id, changes);
      return { snapshot };
    },
    onError: (_e, _v, ctx) => restoreSnapshot(qc, ctx?.snapshot),
    onSuccess: ({ task }, { changes }) => {
      // The server's copy is the truth (it sets updatedAt, completedAt, ...), so write it straight into every cache.
      patchTaskInCaches(qc, task.id, task);
      // Title and description edits change nothing about where the card sits or the counts, so no refetch.
      // Status moves it to another column, a due date changes the overdue count, and priority can change filter results.
      if ('status' in changes || 'dueDate' in changes || 'priority' in changes) {
        void refresh.columns(['todo', 'in_progress', 'done'], 'status' in changes || 'dueDate' in changes);
      }
    },
  });
}

export function useMoveTask() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, status, afterId }: { id: string; status: TaskStatus; afterId: string | null; from: TaskStatus }) =>
      http<{ task: Task }>(`/tasks/${id}/move`, { method: 'POST', body: { status, afterId } }),
    // Only the column it left and the column it entered can have changed. Returning the promise keeps the mutation
    // "pending" until the server's order is back, and the board shows its own draft order until then, so the card
    // never flickers to a stale position.
    onSettled: (_res, _err, { status, from }) => refresh.columns([...new Set([status, from])], status !== from),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => http<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const snapshot = takeSnapshot(qc);
      removeTaskFromCaches(qc, id);
      return { snapshot };
    },
    onError: (_e, _v, ctx) => restoreSnapshot(qc, ctx?.snapshot),
    onSettled: refresh.all,
  });
}
